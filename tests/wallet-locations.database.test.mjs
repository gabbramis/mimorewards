// In-memory PostgreSQL only. Never reads .env or connects to Supabase.
// Setup: npm install --prefix .tmp/wallet-validation --cache .npm-cache --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.12
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../.tmp/wallet-validation/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
after(() => db.close());
const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const merchantA = '11111111-1111-4111-8111-111111111111';
const merchantB = '22222222-2222-4222-8222-222222222222';
const staffA = '33333333-3333-4333-8333-333333333333';
const admin = '44444444-4444-4444-8444-444444444444';
const cardA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const location = (overrides = {}) => ({ id, name: 'Coffe Dreams', address: 'Dirección de prueba', latitude: -34.9056557, longitude: -56.1706692, enabled: true, appleRelevantText: 'Local cercano', ...overrides });

await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users(id UUID PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::UUID $$;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  CREATE TABLE public.businesses(id UUID PRIMARY KEY, name TEXT);
  CREATE TABLE public.nfc_tags(id UUID PRIMARY KEY, business_id UUID REFERENCES public.businesses(id));
  CREATE TABLE public.loyalty_cards(id UUID PRIMARY KEY, business_id UUID REFERENCES public.businesses(id), current_stamps INTEGER DEFAULT 7, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
  CREATE TABLE public.wallet_registrations(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), business_id UUID, serial_number TEXT, push_token TEXT, pass_type_identifier TEXT);
  CREATE TABLE public.wallet_devices(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), serial_number TEXT, push_token TEXT, pass_type_identifier TEXT);
`);
await db.exec(await readFile(new URL('../database_migrations/004_access_control.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../database_migrations/020_wallet_locations_pilot.sql', import.meta.url), 'utf8'));
await db.exec(`
  INSERT INTO auth.users VALUES ('${merchantA}'), ('${merchantB}'), ('${staffA}'), ('${admin}');
  INSERT INTO profiles(id, role) VALUES ('${merchantA}', 'merchant'), ('${merchantB}', 'merchant'), ('${staffA}', 'staff'), ('${admin}', 'superadmin');
  INSERT INTO businesses(id, name) VALUES ('${a}', 'Pilot A'), ('${b}', 'Business B');
  INSERT INTO business_members(user_id, business_id, role) VALUES ('${merchantA}', '${a}', 'merchant'), ('${merchantB}', '${b}', 'merchant'), ('${staffA}', '${a}', 'staff');
  INSERT INTO loyalty_cards(id, business_id) VALUES ('${cardA}', '${a}');
  INSERT INTO wallet_registrations(business_id, serial_number, push_token, pass_type_identifier)
    SELECT '${a}', '${cardA}', 'token_' || x, 'pass.test' FROM generate_series(1, 12) x;
  INSERT INTO wallet_devices(serial_number, push_token, pass_type_identifier) VALUES ('${cardA}', 'token_1', 'pass.test');
  INSERT INTO wallet_registrations(business_id, serial_number, push_token, pass_type_identifier) VALUES ('${b}', '${cardA}', 'wrong_tenant', 'pass.test');
`);

async function save(businessId, revision, locations, enabled = true) {
  return db.query('SELECT save_wallet_locations($1::UUID, $2, $3, $4::JSONB) AS revision', [businessId, enabled, revision, JSON.stringify(locations)]);
}
async function asUser(userId, operation) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('SET ROLE authenticated');
  try { return await operation(); } finally { await db.exec('RESET ROLE'); }
}

test('migration defaults off; atomic save queues Google and deduplicated Apple without altering stamps', async () => {
  assert.equal((await db.query('SELECT wallet_locations_enabled FROM businesses WHERE id = $1', [a])).rows[0].wallet_locations_enabled, false);
  assert.equal((await save(a, 0, [location()])).rows[0].revision, 1);
  const jobs = (await db.query('SELECT channel, count(*)::INTEGER AS total FROM wallet_location_sync_jobs WHERE business_id = $1 GROUP BY channel', [a])).rows;
  assert.equal(jobs.find((row) => row.channel === 'apple').total, 12);
  assert.equal(jobs.find((row) => row.channel === 'google').total, 1);
  assert.equal((await db.query('SELECT count(*)::INTEGER AS total FROM wallet_location_sync_jobs WHERE business_id = $1', [b])).rows[0].total, 0);
  assert.equal((await db.query('SELECT current_stamps FROM loyalty_cards WHERE id = $1', [cardA])).rows[0].current_stamps, 7);
});

test('stale saves, cross-tenant identifiers and invalid coordinates roll back every change', async () => {
  await assert.rejects(save(a, 0, []), /revision_conflict/);
  await assert.rejects(save(b, 0, [location()]), /location_scope_mismatch/);
  await assert.rejects(save(a, 1, [location({ latitude: 91 })]), /check constraint/);
  await assert.rejects(save(a, 1, Array.from({ length: 11 }, () => location())), /too_many_locations/);
  const row = (await db.query('SELECT latitude FROM branch_wallet_locations WHERE business_id = $1', [a])).rows[0];
  assert.equal(row.latitude, -34.9056557);
  assert.equal((await db.query('SELECT wallet_location_revision FROM businesses WHERE id = $1', [a])).rows[0].wallet_location_revision, 1);
});

test('RLS isolates businesses, denies staff, protects device tokens and prevents direct mutation/RPC calls', async () => {
  await asUser(merchantA, async () => assert.equal((await db.query('SELECT * FROM branch_wallet_locations')).rows.length, 1));
  for (const user of [merchantB, staffA]) await asUser(user, async () => assert.equal((await db.query('SELECT * FROM branch_wallet_locations')).rows.length, 0));
  await asUser(admin, async () => assert.equal((await db.query('SELECT * FROM branch_wallet_locations')).rows.length, 1));
  await asUser(merchantA, async () => {
    await assert.rejects(db.query("UPDATE branch_wallet_locations SET name = 'Hacked'"), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM wallet_location_sync_jobs'), /permission denied/);
    await assert.rejects(db.query('SELECT save_wallet_locations($1, true, 1, $2)', [a, '[]']), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM claim_wallet_location_jobs($1)', [a]), /permission denied/);
  });
});

test('queue claims bounded batches with leases; a second worker cannot process the same business', async () => {
  const first = await db.query('SELECT * FROM claim_wallet_location_jobs($1)', [a]);
  assert.equal(first.rows.length, 10);
  assert.ok(first.rows.every((row) => row.attempts === 1 && row.status === 'processing' && row.lease_token));
  const second = await db.query('SELECT * FROM claim_wallet_location_jobs($1)', [a]);
  assert.equal(second.rows.length, 0);
  await db.exec("UPDATE wallet_location_sync_jobs SET status = 'accepted', locked_until = NULL WHERE status = 'processing'");
  assert.equal((await db.query('SELECT * FROM claim_wallet_location_jobs($1)', [a])).rows.length, 3);
  await db.exec("UPDATE wallet_location_sync_jobs SET locked_until = now() - interval '1 minute', attempts = 3 WHERE status = 'processing'");
  await db.query('SELECT * FROM claim_wallet_location_jobs($1)', [a]);
  assert.equal((await db.query("SELECT count(*)::INTEGER AS total FROM wallet_location_sync_jobs WHERE status = 'failed'")).rows[0].total, 3);
});

test('disabling proximity clears saved locations and creates a new revision with observable results', async () => {
  assert.equal((await save(a, 1, [], false)).rows[0].revision, 2);
  assert.equal((await db.query('SELECT * FROM branch_wallet_locations WHERE business_id = $1', [a])).rows.length, 0);
  assert.equal((await db.query('SELECT wallet_locations_enabled FROM businesses WHERE id = $1', [a])).rows[0].wallet_locations_enabled, false);
  const summary = (await db.query('SELECT wallet_location_sync_summary($1, 2) AS summary', [a])).rows[0].summary;
  assert.equal(summary.counts.pending, 13);
  assert.equal(JSON.stringify(summary).includes('push_token'), false);
});

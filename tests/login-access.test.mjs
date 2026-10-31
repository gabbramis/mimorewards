import test from 'node:test';
import assert from 'node:assert/strict';
import { getLoginDestination, getPanelRedirect, getUserRole } from '../src/lib/login-access.ts';

const user = { id: 'user-1', email: 'Owner@Example.com' };
const member = (id, active = true, array = false) => ({
  business_id: id, businesses: array ? [{ id, active }] : { id, active },
});

function database({ whitelist = null, role = null, memberships = [], errors = {} } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const result = { data: { admin_whitelist: whitelist, profiles: role ? { role } : null, business_members: memberships }[table], error: errors[table] || null };
      const query = {
        select() { return query; },
        eq(...args) { calls.push([table, 'eq', ...args]); return query; },
        ilike(...args) { calls.push([table, 'ilike', ...args]); return query; },
        limit() { return query; },
        order() { return Promise.resolve(result); },
        maybeSingle() { return Promise.resolve(result); },
      };
      return query;
    },
  };
}

test('existing profile superadmins can sign in without a whitelist entry or membership', async () => {
  assert.equal(await getLoginDestination(database({ role: 'superadmin' }), user), '/admin');
});

test('legacy installations without admin_whitelist preserve existing profile roles', async () => {
  for (const code of ['42P01', 'PGRST205']) {
    assert.equal(await getLoginDestination(database({ role: 'superadmin', errors: { admin_whitelist: { code } } }), user), '/admin');
  }
});

test('Google accounts on the admin whitelist receive the same role as panel authorization', async () => {
  const db = database({ whitelist: { id: 'admin-1' } });
  assert.equal(await getUserRole(db, user), 'superadmin');
  assert.equal(await getLoginDestination(db, user, '/admin/accesos'), '/admin/accesos');
});

test('whitelist email lookup is normalized and escapes SQL pattern wildcards', async () => {
  const db = database();
  await getUserRole(db, { ...user, email: ' A_B%Name@example.com ' });
  assert.deepEqual(db.calls[0], ['admin_whitelist', 'ilike', 'email', 'a\\_b\\%name@example.com']);
});

test('merchant and staff go to their first active commerce for either authentication method', async () => {
  for (const role of ['merchant', 'staff', null]) {
    const db = database({ role, memberships: [member('inactive', false), { business_id: 'deleted', businesses: null }, member('active', true, true)] });
    assert.equal(await getLoginDestination(db, user), '/comercio/active');
    assert.ok(db.calls.some(call => call[0] === 'business_members' && call[2] === 'user_id' && call[3] === user.id));
  }
});

test('a requested commerce destination must belong to the signed-in user', async () => {
  const db = database({ memberships: [member('a'), member('b')] });
  assert.equal(await getLoginDestination(db, user, '/comercio/b/clientes?q=test'), '/comercio/b/clientes?q=test');
  for (const next of ['/comercio/other', '/comercio/a-other', '/admin', 'https://evil.example']) {
    assert.equal(await getLoginDestination(db, user, next), '/comercio/a');
  }
});

test('accounts without an active associated commerce go to the access request page', async () => {
  assert.equal(await getLoginDestination(database(), user), '/#acceso');
  assert.equal(await getLoginDestination(database({ memberships: [member('inactive', false)] }), user), '/#acceso');
  assert.equal(await getLoginDestination(database(), user, '/admin'), '/#acceso');
});

test('database outages are errors instead of incorrectly reporting an unregistered account', async () => {
  for (const table of ['admin_whitelist', 'profiles', 'business_members']) {
    await assert.rejects(getLoginDestination(database({ errors: { [table]: new Error('database unavailable') } }), user), /database unavailable/);
  }
});

test('rejects external URLs, malformed input, login loops and encoded traversal', () => {
  for (const next of [null, '', '/', '/login', '/auth/callback', '//evil.example', '/\\evil.example', 'https://evil.example', '/admin/../../login', '/admin/%2e%2e/login', '/admin%2f..%2flogin', '/admin\n', '/admin%5cevil', '/admin/%']) {
    assert.equal(getPanelRedirect(next), null, String(next));
  }
  assert.equal(getPanelRedirect('/admin/contactos?page=2'), '/admin/contactos?page=2');
});

// Runtime provider checks with ephemeral signing material and a fake Google API.
// This file never reads .env and never calls a provider or Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, extname } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { EventEmitter } from 'node:events';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const forge = createRequire(require.resolve('passkit-generator'))('node-forge');
const cache = new Map();
const location = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Pilot', address: 'Test reference', latitude: -34.9056557, longitude: -56.1706692, enabled: true, appleRelevantText: 'Local cercano' };
let locations = [location];
const requests = [];
const googleAPI = {
  loyaltyclass: {
    get: async () => { throw Object.assign(new Error('Not found'), { code: 404 }); },
    insert: async (request) => { requests.push(['insert', request]); },
    patch: async (request) => { requests.push(['patch', request]); },
  },
  loyaltyobject: {
    patch: async (request) => { requests.push(['points', request]); },
    addmessage: async () => { throw new Error('Unexpected push notification'); },
  },
};
const mocks = {
  'server-only': {},
  '@/lib/wallet/location-store': { readWalletLocations: async () => locations },
  './location-store': { readWalletLocations: async () => locations },
  googleapis: { google: { auth: { GoogleAuth: class { async getClient() { return {}; } } }, walletobjects: () => googleAPI } },
};

test('stamp Wallet updates wait for provider completion in the Next after callback', async () => {
  const callbacks = [];
  const completed = [];
  let cardPlatform = 'GOOGLE';
  mocks['next/server'] = { after: (callback) => callbacks.push(callback) };
  mocks['@/lib/supabase/admin'] = { createAdminClient: () => ({ from: (table) => {
    const query = {
      select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: { name: 'Pilot' } }),
      then: (resolve) => Promise.resolve({ data: table === 'loyalty_cards' ? [{ id: 'test-card', wallet_platform: cardPlatform }] : null }).then(resolve),
    };
    return query;
  } }) };
  mocks['@/lib/wallet/apns'] = {
    sendCustomerPassUpdate: async () => { await Promise.resolve(); completed.push('apple'); return { sent: 1, failed: 0 }; },
  };
  mocks['@/lib/wallet/googleWallet'] = {
    updateLoyaltyPoints: async () => { await Promise.resolve(); completed.push('google'); return { success: true }; },
  };
  mocks['@/lib/wallet/sync-template'] = { updateWalletTemplate: async () => ({}) };
  const notifications = load('src/lib/wallet-notifications.ts');
  notifications.scheduleCustomerWalletUpdate({ customerId: 'test-customer', businessId: 'test-business', currentStamps: 3 });
  assert.equal(callbacks.length, 1);
  assert.deepEqual(completed, []);
  await callbacks[0]();
  assert.deepEqual(completed, ['apple', 'google']);
  completed.length = 0;
  cardPlatform = 'APPLE';
  notifications.scheduleCustomerWalletUpdate({ customerId: 'test-customer', businessId: 'test-business', currentStamps: 4 });
  await callbacks[1]();
  assert.deepEqual(completed, ['apple'], 'Apple-only cards must not attempt a Google API call');
});

function load(relative) {
  const filename = resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
    if (name.startsWith('.')) return load(resolve(dirname(filename), name + (extname(name) ? '' : '.ts')));
    return require(name);
  };
  new Function('require', 'module', 'exports', '__filename', '__dirname', compiled)(localRequire, loadedModule, loadedModule.exports, filename, dirname(filename));
  return loadedModule.exports;
}

function passJSON(zip) {
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8);
    const size = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extraLength;
    if (name === 'pass.json') {
      const payload = zip.subarray(start, start + size);
      return JSON.parse((method === 8 ? inflateRawSync(payload) : payload).toString());
    }
    offset = start + size;
  }
  throw new Error('pass.json not found');
}

test('actual signed Apple pass preserves proximity and never includes promotional changeMessage', async () => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = '01';
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date(Date.now() + 86_400_000);
  certificate.setSubject([{ name: 'commonName', value: 'Ephemeral Wallet Test' }]);
  certificate.setIssuer(certificate.subject.attributes);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  const cert = forge.pki.certificateToPem(certificate);
  const privateKey = forge.pki.privateKeyToPem(keys.privateKey);
  const overrides = {
    APPLE_WALLET_SIGNER_CERT_BASE64: Buffer.from(cert).toString('base64'),
    APPLE_WALLET_SIGNER_KEY_BASE64: Buffer.from(privateKey).toString('base64'),
    APPLE_WALLET_WWDR_CERT_BASE64: Buffer.from(cert).toString('base64'),
    WALLET_AUTH_SECRET: 'ephemeral-test-only', GOOGLE_WALLET_ISSUER_ID: '999999',
    GOOGLE_WALLET_CLIENT_EMAIL: 'test@example.invalid', GOOGLE_WALLET_PRIVATE_KEY: privateKey,
  };
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  try {
    const apple = load('src/lib/wallet/appleWallet.ts');
    assert.equal(apple.appleWalletConfigured(), true);
    const pass = passJSON(await apple.createAppleWalletPass({
      id: 'test-card', customerName: 'Test Customer', customerCode: 'CLI-TEST', businessName: 'Pilot',
      currentStamps: 2, targetStamps: 5, rewardDescription: 'Test reward', locations,
      activeCampaignMessage: 'This promotion must not appear',
      webServiceURL: 'https://mimorewards.com/api/apple-wallet',
    }));
    assert.deepEqual(pass.locations, [{ latitude: -34.9056557, longitude: -56.1706692, relevantText: 'Local cercano' }]);
    assert.equal(pass.storeCard.headerFields[0].changeMessage, '¡Sumaste un sello! Tenés %@ sellos.');
    assert.equal(pass.webServiceURL, 'https://www.mimorewards.com/api/apple-wallet');
    assert.equal(JSON.stringify(pass).includes('This promotion must not appear'), false);
    assert.equal(apple.verifyPassAuthToken('test-card', pass.authenticationToken), true);

    const google = load('src/lib/wallet/googleWallet.ts');
    await google.createOrUpdateLoyaltyClass('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Pilot');
    assert.deepEqual(requests.find(([kind]) => kind === 'insert')[1].requestBody.merchantLocations, [{ latitude: -34.9056557, longitude: -56.1706692 }]);
    locations = [];
    const updated = await google.patchGoogleWalletLoyaltyClass('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { businessName: 'Pilot' });
    assert.equal(updated.success, true);
    assert.deepEqual(requests.find(([kind]) => kind === 'patch')[1].requestBody.merchantLocations, []);
    assert.equal((await google.updateLoyaltyPoints('test-card', 3)).success, true);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('Wallet APNs updates use an empty payload and background-compatible priority', async () => {
  const actualHttp2 = require('node:http2');
  let capturedHeaders;
  let payload = '';
  const stream = new EventEmitter();
  stream.setTimeout = () => stream;
  stream.write = (chunk) => { payload += chunk; };
  stream.end = () => queueMicrotask(() => {
    stream.emit('response', { ':status': 200 });
    stream.emit('end');
  });
  const session = new EventEmitter();
  session.request = (headers) => { capturedHeaders = headers; return stream; };
  session.close = () => {};
  mocks['node:http2'] = { constants: actualHttp2.constants, connect: () => session };
  mocks['./appleWallet'] = { certificate: () => Buffer.from('test-only'), PASS_TYPE_ID: 'pass.test' };
  const apns = load('src/lib/wallet/apns.ts');
  const result = await apns.sendApnsNotification('test-device-token', 'pass.test');
  assert.equal(result.success, true);
  assert.equal(capturedHeaders['apns-priority'], '5');
  assert.equal(capturedHeaders['apns-push-type'], 'background');
  assert.equal(capturedHeaders['apns-topic'], 'pass.test');
  assert.equal(payload, JSON.stringify({ aps: {} }));
});

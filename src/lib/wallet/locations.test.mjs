import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWalletLocations, applePassLocations, googleMerchantLocations, canManageWalletLocations } from './locations.ts';
import { certificateEnvironment } from './apple-certificates.ts';

const location = (overrides = {}) => ({
  id: '11111111-1111-4111-8111-111111111111', name: 'Coffe Dreams', address: 'Dirección de prueba',
  latitude: -34.9056557, longitude: -56.1706692, enabled: true, appleRelevantText: 'Local cercano', ...overrides,
});

test('Apple uses relevantText; Google receives coordinates only; inactive locations never reach either provider', () => {
  const input = validateWalletLocations([location(), location({ id: '22222222-2222-4222-8222-222222222222', enabled: false })]);
  assert.deepEqual(applePassLocations(input), [{ latitude: -34.9056557, longitude: -56.1706692, relevantText: 'Local cercano' }]);
  assert.deepEqual(googleMerchantLocations(input), [{ latitude: -34.9056557, longitude: -56.1706692 }]);
  assert.deepEqual(applePassLocations([]), []);
  assert.deepEqual(googleMerchantLocations([]), []);
});

test('coordinates reject blank strings, numeric strings, NaN, infinity and out-of-range values', () => {
  for (const latitude of ['', '0', null, NaN, Infinity, -90.01, 90.01]) assert.throws(() => validateWalletLocations([location({ latitude })]));
  for (const longitude of ['', '0', null, NaN, Infinity, -180.01, 180.01]) assert.throws(() => validateWalletLocations([location({ longitude })]));
  assert.equal(validateWalletLocations([location({ latitude: 0, longitude: 0 })])[0].latitude, 0);
  assert.doesNotThrow(() => validateWalletLocations([location({ latitude: -90, longitude: 180 })]));
});

test('rejects more than ten locations and duplicate or invalid identifiers', () => {
  assert.throws(() => validateWalletLocations(Array.from({ length: 11 }, () => location())));
  assert.throws(() => validateWalletLocations([location(), location()]));
  assert.throws(() => validateWalletLocations([location({ id: 'another-business' })]));
  assert.throws(() => validateWalletLocations(null));
});

test('location text is bounded and trimmed, and state must be a boolean', () => {
  assert.equal(validateWalletLocations([location({ name: '  Café  ' })])[0].name, 'Café');
  for (const overrides of [{ name: '' }, { address: ' ' }, { appleRelevantText: 'x'.repeat(121) }, { enabled: 'true' }]) {
    assert.throws(() => validateWalletLocations([location(overrides)]));
  }
});

test('only a superadmin or merchant membership can configure locations', () => {
  assert.equal(canManageWalletLocations('superadmin', null), true);
  assert.equal(canManageWalletLocations('staff', 'merchant'), true);
  assert.equal(canManageWalletLocations('merchant', null), false);
  assert.equal(canManageWalletLocations('merchant', 'staff'), false);
  assert.equal(canManageWalletLocations(null, null), false);
});

test('Apple certificate loader accepts documented production aliases and existing names', () => {
  assert.equal(certificateEnvironment('APPLE_SIGNER_CERT', { APPLE_WALLET_SIGNER_CERT_BASE64: 'cert' }), 'cert');
  assert.equal(certificateEnvironment('APPLE_PRIVATE_KEY', { APPLE_WALLET_SIGNER_KEY_BASE64: 'key' }), 'key');
  assert.equal(certificateEnvironment('APPLE_WWDR_CERT', { APPLE_WALLET_WWDR_CERT_BASE64: 'wwdr' }), 'wwdr');
  assert.equal(certificateEnvironment('APPLE_SIGNER_CERT', { APPLE_SIGNER_CERT: 'legacy', APPLE_WALLET_SIGNER_CERT_BASE64: 'other' }), 'legacy');
  assert.equal(certificateEnvironment('APPLE_SIGNER_CERT', { APPLE_SIGNER_CERT_BASE64: 'legacy-base64' }), 'legacy-base64');
  assert.equal(certificateEnvironment('APPLE_SIGNER_CERT', {}), '');
});

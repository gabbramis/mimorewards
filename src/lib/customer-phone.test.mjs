import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTRY_CODES,
  formatCustomerSubmitPhone,
  normalizeCustomerPhone,
  normalizeUruguayMobile,
  getUruguayMobileVariants
} from './customer-phone.ts';

test('COUNTRY_CODES contains default +598 and regional codes', () => {
  assert.equal(COUNTRY_CODES[0].code, '+598');
  assert.ok(COUNTRY_CODES.some(c => c.code === '+54'));
  assert.ok(COUNTRY_CODES.some(c => c.code === '+55'));
  assert.ok(COUNTRY_CODES.some(c => c.code === '+56'));
  assert.ok(COUNTRY_CODES.some(c => c.code === '+1'));
});

test('formatCustomerSubmitPhone: +598 strips leading 0 to produce +5989...', () => {
  assert.equal(formatCustomerSubmitPhone('095123456', '+598'), '+59895123456');
  assert.equal(formatCustomerSubmitPhone('099 123 456', '+598'), '+59899123456');
  assert.equal(formatCustomerSubmitPhone('95123456', '+598'), '+59895123456');
  assert.equal(formatCustomerSubmitPhone('+598095123456', '+598'), '+59895123456');
  assert.equal(formatCustomerSubmitPhone('+59895123456', '+598'), '+59895123456');
});

test('formatCustomerSubmitPhone: concatenates international codes (+54, +55, +56, +1)', () => {
  assert.equal(formatCustomerSubmitPhone('1123456789', '+54'), '+541123456789');
  assert.equal(formatCustomerSubmitPhone('01123456789', '+54'), '+541123456789');
  assert.equal(formatCustomerSubmitPhone('11987654321', '+55'), '+5511987654321');
  assert.equal(formatCustomerSubmitPhone('912345678', '+56'), '+56912345678');
  assert.equal(formatCustomerSubmitPhone('2025550143', '+1'), '+12025550143');
});

test('normalizeCustomerPhone handles Uruguay (+598) and international numbers with +', () => {
  assert.equal(normalizeCustomerPhone('+59895123456'), '+59895123456');
  assert.equal(normalizeCustomerPhone('095123456'), '+59895123456');
  assert.equal(normalizeCustomerPhone('+5491112345678'), '+5491112345678');
  assert.equal(normalizeCustomerPhone('+12025550143'), '+12025550143');
  assert.equal(normalizeCustomerPhone(''), null);
  assert.equal(normalizeCustomerPhone('invalid-phone'), null);
});

test('getUruguayMobileVariants generates variants including legacy and canonical + formats', () => {
  const variants = getUruguayMobileVariants('+59895123456');
  assert.ok(variants.includes('+59895123456'), 'Must include canonical +598');
  assert.ok(variants.includes('095123456'), 'Must include legacy 095... for backward compatibility');
  assert.ok(variants.includes('95123456'), 'Must include 95... variant');
});

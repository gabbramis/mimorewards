import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUruguayMobile } from './customer-phone.ts';

test('unifies local and international forms of one Uruguayan mobile', () => {
  for (const input of ['+598 99 123 456', '+598 099 123 456', '59899123456', '00598 99 123 456', '099 123 456', '99-123-456']) {
    assert.equal(normalizeUruguayMobile(input), '+59899123456');
  }
});

test('rejects incomplete, non-mobile, and foreign numbers', () => {
  for (const input of ['', '09123', '+54 9 11 1234 5678', '2400 1234', 'abc099123456', '099123456+']) {
    assert.equal(normalizeUruguayMobile(input), null);
  }
});

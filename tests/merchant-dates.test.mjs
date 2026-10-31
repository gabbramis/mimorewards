import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { formatMerchantDate, merchantDateKey } from '../src/lib/merchant-dates.ts';

test('formats the reported timestamp with identical, ordinary AM/PM spaces', () => {
  const date = '2026-10-31T04:49:49Z';
  assert.equal(formatMerchantDate(date), '31-oct, 01:49 a. m.');
  assert.equal(formatMerchantDate(date, true), '31 de oct de 2026, 01:49:49 a. m.');
  assert.doesNotMatch(formatMerchantDate(date, true), /[\u00a0\u202f]/);
});

test('uses business midnight, noon, and calendar day consistently', () => {
  assert.equal(formatMerchantDate('2026-11-01T02:59:00Z'), '31-oct, 11:59 p. m.');
  assert.equal(merchantDateKey('2026-11-01T02:59:00Z'), '2026-10-31');
  assert.equal(formatMerchantDate('2026-11-01T03:00:00Z'), '01-nov, 12:00 a. m.');
  assert.equal(merchantDateKey('2026-11-01T03:00:00Z'), '2026-11-01');
  assert.equal(formatMerchantDate('2026-11-01T15:00:00Z'), '01-nov, 12:00 p. m.');
});

test('handles missing and invalid visit dates', () => {
  assert.equal(formatMerchantDate(null), 'Sin visitas');
  assert.equal(formatMerchantDate('invalid-date'), 'invalid-date');
});

test('matches across server and browser machine timezones and locales', () => {
  const moduleUrl = new URL('../src/lib/merchant-dates.ts', import.meta.url).href;
  const script = `import {formatMerchantDate, merchantDateKey} from ${JSON.stringify(moduleUrl)};
    const date = '2026-11-01T02:59:49Z';
    console.log(JSON.stringify([formatMerchantDate(date), formatMerchantDate(date, true), merchantDateKey(date)]));`;
  const outputs = ['UTC', 'America/Montevideo', 'America/Los_Angeles', 'Asia/Tokyo'].map(TZ =>
    execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--experimental-strip-types', '--input-type=module', '-e', script], {
      env: { ...process.env, TZ, LANG: TZ === 'UTC' ? 'en_US.UTF-8' : 'es_AR.UTF-8' },
      encoding: 'utf8',
    }).trim()
  );
  assert.equal(new Set(outputs).size, 1);
  assert.deepEqual(JSON.parse(outputs[0]), ['31-oct, 11:59 p. m.', '31 de oct de 2026, 11:59:49 p. m.', '2026-10-31']);
});

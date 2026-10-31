import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLeadPhone, parseLandingLead } from '../src/lib/landing-leads.ts';

const inquiry = {
  name: '  Sofía Pérez  ', business: '  Café de la esquina  ', phone: '099 123 456',
  plan: 'profesional', consent: true,
};

test('normalizes Uruguayan mobile numbers and explicit international prefixes', () => {
  for (const value of ['099 123 456', '99 123 456', '+598 (99) 123-456', '59899123456']) {
    assert.equal(normalizeLeadPhone(value), '+59899123456');
  }
  assert.equal(normalizeLeadPhone('+54 9 11 1234 5678'), '+5491112345678');
});

test('rejects ambiguous, malformed or oversized WhatsApp numbers', () => {
  for (const value of ['', '123', 'hola099123456', '12345678', '+000000000', '++59899123456', '+1234567890123456789']) {
    assert.equal(normalizeLeadPhone(value), null, value);
  }
});

test('normalizes the three contact fields and selected plan', () => {
  const result = parseLandingLead(inquiry);
  assert.deepEqual(result.lead, {
    name: 'Sofía Pérez', business: 'Café de la esquina', phone: '+59899123456',
    plan: 'profesional',
  });
});

test('allows inquiries without a selected plan', () => {
  assert.ok(parseLandingLead({ ...inquiry, plan: '' }).lead);
});

test('includes the requested access email without changing existing contact submissions', () => {
  assert.equal(parseLandingLead({ ...inquiry, email: ' owner@example.com ' }).lead.email, 'owner@example.com');
  assert.equal(Object.hasOwn(parseLandingLead(inquiry).lead, 'email'), false);
});

test('rejects malformed access emails and header injection', () => {
  for (const email of ['owner', 'owner@example.com\nBcc:other@example.com', 'a b@example.com', 'x'.repeat(255) + '@example.com']) {
    assert.ok(parseLandingLead({ ...inquiry, email }).error);
  }
});


test('requires explicit WhatsApp consent', () => {
  for (const consent of [false, 'true', 'on', undefined, 1]) {
    assert.ok(parseLandingLead({ ...inquiry, consent }).error);
  }
});

test('rejects missing identity, excessive lengths and control characters', () => {
  for (const bad of [{ name: ' ' }, { business: '' }, { name: 'x'.repeat(101) }, { business: 'x'.repeat(151) }, { name: 'Sofía\nInjected' }]) {
    assert.ok(parseLandingLead({ ...inquiry, ...bad }).error);
  }
});

test('rejects unsupported plans', () => {
  for (const bad of [{ plan: 'superadmin' }, { plan: '__proto__' }]) {
    assert.ok(parseLandingLead({ ...inquiry, ...bad }).error);
  }
});

test('rejects malformed request bodies', () => {
  for (const body of [null, [], 'string', 123]) assert.ok(parseLandingLead(body).error);
});

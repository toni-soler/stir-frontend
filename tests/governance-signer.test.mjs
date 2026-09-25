import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalText, digestOf, sha256Hex, messageForStoredPayload, messageForOwnPayload,
  DOMAIN, GUARDIAN_DOMAIN, POSSESSION_DOMAIN, BOOTSTRAP_DOMAIN, INITIAL_CONSTITUTION } from '../src/governance-signer.js';

// Golden vector shared with stir-backend's SevenKeysCryptoTest.initialConstitutionDigestMatchesTheSharedFrontendVector:
// same fixed constitution object, same RFC 8785 canonical bytes and SHA-256 hex on both sides of
// the JCS boundary. If this ever diverges, the frontend and backend disagree on what a signer
// is actually attesting to at bootstrap time - the single most safety-critical byte string in
// the whole ceremony.
test('INITIAL_CONSTITUTION canonicalizes and digests identically to the Java backend', async () => {
  const expectedText = '{"concentrationChecksRequired":true,"constitutionalThreshold":7,"guardianMayGovern":false,'
    + '"historyImmutable":true,"independenceChecksRequired":true,"maximumParticipantShareCeiling":"0.50",'
    + '"minimumObservationFloor":5,"minimumParticipantFloor":6,"provenanceRequired":true,"schema":"STIR-MARKET-CONSTITUTION-1"}';
  assert.equal(canonicalText(INITIAL_CONSTITUTION), expectedText);
  assert.equal(await digestOf(INITIAL_CONSTITUTION), '8254b12fba01df8b2527a3583302573fe8a47d6ba30696003731e22200c79da5');
});

test('canonicalization is deterministic and independent of key insertion order', () => {
  const a = { z: 1, a: 'x', nested: { b: true, a: null } };
  const b = { nested: { a: null, b: true }, a: 'x', z: 1 };
  assert.equal(canonicalText(a), canonicalText(b));
});

test('sha256Hex matches a known SHA-256 test vector', async () => {
  assert.equal(await sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('domain-separated message bytes are UTF8(domain) || 0x00 || UTF8(payload text), never re-canonicalized', () => {
  const text = '{"a":1}';
  const message = messageForStoredPayload(DOMAIN, text);
  const domainBytes = new TextEncoder().encode(DOMAIN);
  assert.equal(message.length, domainBytes.length + 1 + new TextEncoder().encode(text).length);
  assert.equal(message[domainBytes.length], 0);
  assert.deepEqual(message.slice(0, domainBytes.length), domainBytes);
  assert.deepEqual(message.slice(domainBytes.length + 1), new TextEncoder().encode(text));
});

test('messageForOwnPayload canonicalizes then applies the same domain-separated construction', () => {
  const value = { b: 2, a: 1 };
  assert.deepEqual(messageForOwnPayload(GUARDIAN_DOMAIN, value), messageForStoredPayload(GUARDIAN_DOMAIN, canonicalText(value)));
});

test('the four domains are distinct so a signature can never be replayed across action kinds', () => {
  const domains = [DOMAIN, GUARDIAN_DOMAIN, POSSESSION_DOMAIN, BOOTSTRAP_DOMAIN];
  assert.equal(new Set(domains).size, domains.length);
  for (const d of domains) assert.match(d, /^STIR:MARKET:[A-Z]+:V1$/);
});

test('every gov* key referenced by governance.jsx and extension.jsx exists and is non-empty in every locale', () => {
  const bundles = JSON.parse(fs.readFileSync(new URL('../src/locales.json', import.meta.url), 'utf8'));
  const sources = ['../src/governance.jsx', '../src/extension.jsx'].map((p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8')).join('\n');
  const keys = new Set([...sources.matchAll(/t\('(gov[A-Za-z0-9_]+)'\)/g)].map((m) => m[1]));
  for (const action of ['AMEND_CONSTITUTION', 'APPOINT_GUARDIAN', 'REMOVE_GUARDIAN', 'ROTATE_CREDENTIAL', 'REPLACE_CONTROLLER']) keys.add('gov' + action);
  for (const state of ['ACTIVATED', 'PROPOSED', 'PARTIALLY_SIGNED']) keys.add('govState' + state);
  assert.ok(keys.size > 60, 'sanity check: expected a large gov* key set, found ' + keys.size);
  for (const [locale, bundle] of Object.entries(bundles)) for (const key of keys) assert.ok(bundle[key]?.trim(), locale + ': ' + key);
});

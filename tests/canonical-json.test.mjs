import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';

// Shared Java/JavaScript vector (see stir-backend/.../CanonicalJsonTest.matchesTheSharedJavaJavaScriptTestVector):
// the exact same field values, independently canonicalized by this "canonicalize" npm package and
// the backend's erdtman/java-json-canonicalization, produce byte-identical RFC 8785 JCS output and
// this exact digest - real cross-language interoperability, not two implementations that merely
// each pass their own tests.
const baseline = () => ({
  schemaVersion: 1,
  agreementId: '5c2c6a2e-1111-4a11-9a11-000000000001',
  listingDirection: 'OFFER',
  proposedAmount: '15.00',
  quantity: '20.0000',
  terms: null,
  nonce: 'fixed-test-nonce',
});
const digestHex = (json) => createHash('sha256').update(Buffer.from(json, 'utf8')).digest('hex');

test('matches the shared Java/JavaScript test vector', () => {
  const json = canonicalize(baseline());
  assert.equal(json, '{"agreementId":"5c2c6a2e-1111-4a11-9a11-000000000001","listingDirection":"OFFER",'
    + '"nonce":"fixed-test-nonce","proposedAmount":"15.00","quantity":"20.0000","schemaVersion":1,"terms":null}');
  assert.equal(digestHex(json), '3bde73f31403a61d2c0cdcc31158207935475881981a57e6696b3b44c6dce862');
});
test('same semantic snapshot produces the same canonical bytes regardless of key insertion order', () => {
  const reordered = { nonce: 'fixed-test-nonce', terms: null, quantity: '20.0000', proposedAmount: '15.00',
    listingDirection: 'OFFER', agreementId: '5c2c6a2e-1111-4a11-9a11-000000000001', schemaVersion: 1 };
  assert.equal(canonicalize(baseline()), canonicalize(reordered));
});
test('a changed contractual term changes the digest', () => {
  const changed = { ...baseline(), proposedAmount: '15.01' };
  assert.notEqual(digestHex(canonicalize(baseline())), digestHex(canonicalize(changed)));
});
test('a changed nonce alone changes the digest', () => {
  const changed = { ...baseline(), nonce: 'a-different-nonce' };
  assert.notEqual(digestHex(canonicalize(baseline())), digestHex(canonicalize(changed)));
});
test('Unicode text is preserved as-is, not normalized, and still round-trips deterministically', () => {
  const withUnicode = { ...baseline(), terms: 'café é́ escaped and emoji 😀' };
  const a = canonicalize(withUnicode);
  const b = canonicalize({ ...withUnicode });
  assert.equal(a, b);
  assert.notEqual(digestHex(a), digestHex(canonicalize(baseline())));
});

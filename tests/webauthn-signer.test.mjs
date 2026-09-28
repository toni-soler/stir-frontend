import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBase64url, challengeFor, isWebAuthnAvailable } from '../src/webauthn-signer.js';
import { base64url } from '../src/signer.js';

test('decodeBase64url round-trips through base64url for arbitrary byte lengths', () => {
  for (const length of [0, 1, 2, 3, 4, 16, 31, 32, 33]) {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) bytes[i] = (i * 37 + 11) % 256;
    const encoded = base64url(bytes);
    assert.deepEqual(Array.from(decodeBase64url(encoded)), Array.from(bytes));
  }
});

test('decodeBase64url handles values requiring every padding remainder', () => {
  // base64url with no '=' padding characters; lengths 1/2/3 mod 4 all occur across these inputs.
  assert.deepEqual(Array.from(decodeBase64url('QQ')), [65]);
  assert.deepEqual(Array.from(decodeBase64url('QUI')), [65, 66]);
  assert.deepEqual(Array.from(decodeBase64url('QUJD')), [65, 66, 67]);
});

test('challengeFor is the base64url SHA-256 digest of the exact message bytes, never the message itself', async () => {
  const message = new TextEncoder().encode('STIR:MARKET:CONSTITUTION:V1\u0000{"a":1}');
  const challenge = await challengeFor(message);
  const expectedDigest = await crypto.subtle.digest('SHA-256', message);
  assert.equal(challenge, base64url(expectedDigest));
  assert.notEqual(challenge, base64url(message));
});

test('challengeFor differs for any difference in the domain-separated message - the whole point of binding the WebAuthn challenge to it', async () => {
  const a = await challengeFor(new TextEncoder().encode('STIR:MARKET:CONSTITUTION:V1\u0000{"a":1}'));
  const b = await challengeFor(new TextEncoder().encode('STIR:MARKET:CONSTITUTION:V1\u0000{"a":2}'));
  const c = await challengeFor(new TextEncoder().encode('STIR:MARKET:GUARDIAN:V1\u0000{"a":1}'));
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.notEqual(b, c);
});

test('isWebAuthnAvailable reflects whether the browser API surface is present, never throws', () => {
  assert.equal(typeof isWebAuthnAvailable(), 'boolean');
});

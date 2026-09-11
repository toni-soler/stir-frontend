import test from 'node:test';
import assert from 'node:assert/strict';
import { base64url, authorizationMessageBytes } from '../src/signer.js';

test('base64url encodes without padding or unsafe characters', () => {
  const encoded = base64url(new Uint8Array([251, 255, 191, 254]));
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(encoded, /=/);
});
test('base64url of an empty buffer is empty', () => {
  assert.equal(base64url(new Uint8Array([])), '');
});
test('authorizationMessageBytes matches the exact osTRIS wire construction', () => {
  const payload = '{"a":1}';
  const bytes = authorizationMessageBytes(payload);
  const decoder = new TextDecoder();
  const domainBytes = bytes.slice(0, 17);
  assert.equal(decoder.decode(domainBytes), 'OSTRIS:TX:AUTH:V1');
  assert.equal(bytes[17], 0x00);
  assert.equal(decoder.decode(bytes.slice(18)), payload);
  assert.equal(bytes.length, 17 + 1 + new TextEncoder().encode(payload).length);
});
test('authorizationMessageBytes is deterministic for the same payload text', () => {
  const a = authorizationMessageBytes('{"x":"y"}');
  const b = authorizationMessageBytes('{"x":"y"}');
  assert.deepEqual([...a], [...b]);
});
test('authorizationMessageBytes differs when the canonical payload text differs', () => {
  const a = authorizationMessageBytes('{"amount":"900"}');
  const b = authorizationMessageBytes('{"amount":"901"}');
  assert.notDeepEqual([...a], [...b]);
});

// Client-side Ed25519 signing key for osTRIS AccountAuthorization (section 10 of the 0.3 brief).
// The private key is generated with WebCrypto's Ed25519 (verified supported in this project's
// target browsers - see VALIDATION.md) as extractable:false and persisted as a live CryptoKey via
// IndexedDB structured clone, so it is never readable as bytes/text by this or any other page -
// not exported, not serialized, not sent anywhere. Only the public key (always extractable per the
// WebCrypto spec, regardless of the pair's extractable flag) ever leaves this module, to be
// registered with osTRIS via STIR's own activation endpoint. STIR's backend never sees, generates
// or stores a private key.

const DB_NAME = 'stir-signing-keys';
const STORE = 'keys';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function idbSet(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function base64url(bytes) {
  let binary = '';
  const array = new Uint8Array(bytes);
  for (let i = 0; i < array.length; i++) binary += String.fromCharCode(array[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Exact osTRIS wire bytes: UTF8(domain) || 0x00 || UTF8(canonical payload text). Public protocol
 * constant, not reconstructed JSON - STIR/the client never re-derives AuthorizationPayload itself,
 * it only ever signs the exact canonical text the server returned (see PUBLIC_APPLICATION_API_V1.md). */
export function authorizationMessageBytes(authorizationPayloadText) {
  const encoder = new TextEncoder();
  const domain = encoder.encode('OSTRIS:TX:AUTH:V1');
  const payload = encoder.encode(authorizationPayloadText);
  const message = new Uint8Array(domain.length + 1 + payload.length);
  message.set(domain, 0);
  message[domain.length] = 0x00;
  message.set(payload, domain.length + 1);
  return message;
}

async function loadOrCreateKeyPair(storageKey) {
  const db = await openDb();
  const stored = await idbGet(db, storageKey);
  if (stored && stored.privateKey && stored.publicKey) return stored;
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
  await idbSet(db, storageKey, keyPair);
  return keyPair;
}

export async function hasSigningKey(tenantId, userId) {
  const db = await openDb();
  return Boolean(await idbGet(db, tenantId + ':' + userId));
}

/** { publicKeyBase64url, sign(messageBytes) -> signatureBase64url }. Creates the key on first use. */
export async function getSigner(tenantId, userId) {
  const keyPair = await loadOrCreateKeyPair(tenantId + ':' + userId);
  const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  return {
    publicKeyBase64url: base64url(rawPublicKey),
    async sign(messageBytes) {
      const signature = await crypto.subtle.sign('Ed25519', keyPair.privateKey, messageBytes);
      return base64url(signature);
    },
  };
}

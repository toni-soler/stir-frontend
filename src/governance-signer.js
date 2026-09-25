// Client-side Ed25519 for Seven Keys constitutional governance (SEVEN_KEYS_GOVERNANCE.md).
// Same non-extractable WebCrypto custody model as signer.js: a seat/guardian/incoming-credential
// private key is generated with extractable:false and persisted as a live CryptoKey via IndexedDB
// structured clone - never readable as bytes/text by this or any other page, never sent to STIR.
// STIR's backend never sees, generates or stores a Seven Keys private key (PRIVACY_MODEL /
// SEVEN_KEYS_GOVERNANCE.md section 39 of the market-integrity handoff: no server-side custody).
//
// What "non-extractable" does and does not guarantee (GOVERNANCE_CAPTURE_THREAT_MODEL.md): the
// raw key bytes cannot be exported/read out of the CryptoKey handle by this or any other page -
// that part is real. It does NOT mean the key is unusable by a compromised client: any code
// running with access to this origin's IndexedDB and the WebCrypto API (a malicious browser
// extension, a supply-chain-compromised dependency, a compromised OS) can still ask the CryptoKey
// to produce a signature over an attacker-chosen message, exactly as this module does. The
// guarantee is "cannot be exfiltrated as bytes," not "cannot be misused in place." Treat this
// module's custody as protecting against network/server-side exposure, not against a fully
// compromised endpoint - a hardware-backed credential (WebAuthn or similar) would be needed for
// that, which this module does not implement.
//
// This module also does not by itself make eight independent custodians real. Running the
// bootstrap wizard's "generate/sign here" shortcuts for more than one seat in the same browser
// (as the local dev/E2E/demo/stir-pruebas flow does) produces one device holding several
// credentials, not seven independent ones - see the same-device-ceremony warning surfaced in the
// bootstrap UI. For an actual community, each seat and the Guardian must run this module on their
// own separate device via the paste-a-task/paste-a-signature relay.
//
// Two payload sources exist, and this module never blurs them:
//  - PROPOSAL signing (ordinary amendments, guardian appointment/removal, recovery): the backend
//    already computed and stored the exact canonical payload text (`payloadJson`); this module
//    only ever signs that exact string, the same "never re-derive, only sign what the server
//    handed back" rule as authorizationMessageBytes() in signer.js.
//  - BOOTSTRAP and EMERGENCY SUSPENSION: no payload exists server-side yet, so the coordinator
//    must independently construct the exact same RFC 8785 (JCS) bytes the backend will
//    reconstruct from the same fields, using the `canonicalize` package - the same JCS library
//    (cross-verified against the Java erdtman implementation) STIR's CanonicalJson.java already
//    documents as its JS counterpart.
import canonicalize from 'canonicalize';
import { base64url } from './signer.js';

export const DOMAIN = 'STIR:MARKET:CONSTITUTION:V1';
export const GUARDIAN_DOMAIN = 'STIR:MARKET:GUARDIAN:V1';
export const POSSESSION_DOMAIN = 'STIR:MARKET:POSSESSION:V1';
export const BOOTSTRAP_DOMAIN = 'STIR:MARKET:BOOTSTRAP:V1';

// The fixed floor SevenKeysService.initialConstitution() bootstraps every new authority with.
// A public, hardcoded protocol constant - not something the client invents or negotiates.
export const INITIAL_CONSTITUTION = {
  schema: 'STIR-MARKET-CONSTITUTION-1',
  provenanceRequired: true,
  historyImmutable: true,
  independenceChecksRequired: true,
  concentrationChecksRequired: true,
  minimumObservationFloor: 5,
  minimumParticipantFloor: 6,
  maximumParticipantShareCeiling: '0.50',
  guardianMayGovern: false,
  constitutionalThreshold: 7,
};

const DB_NAME = 'stir-governance-keys';
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

/** RFC 8785 canonical JSON text - byte-identical to CanonicalJson.canonicalBytes() on the server
 * for the same value, since both sides use conformant JCS implementations. */
export function canonicalText(value) {
  return canonicalize(value);
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function digestOf(value) {
  return sha256Hex(canonicalText(value));
}

function domainSeparatedMessage(domain, canonicalPayloadText) {
  const encoder = new TextEncoder();
  const domainBytes = encoder.encode(domain);
  const payloadBytes = encoder.encode(canonicalPayloadText);
  const message = new Uint8Array(domainBytes.length + 1 + payloadBytes.length);
  message.set(domainBytes, 0);
  message[domainBytes.length] = 0x00;
  message.set(payloadBytes, domainBytes.length + 1);
  return message;
}

/** Sign the EXACT canonical text the server already produced (proposal payloadJson). Never
 * reconstructs it - see module docstring. */
export function messageForStoredPayload(domain, canonicalPayloadText) {
  return domainSeparatedMessage(domain, canonicalPayloadText);
}

/** Independently build the message for a payload that does not exist server-side yet (bootstrap,
 * emergency suspension). Caller must pass exactly the same fields, in any key order (JCS sorts
 * object keys), that SevenKeysService will reconstruct. */
export function messageForOwnPayload(domain, payload) {
  return domainSeparatedMessage(domain, canonicalText(payload));
}

async function loadOrCreateKeyRecord(storageKey) {
  const db = await openDb();
  const stored = await idbGet(db, storageKey);
  if (stored && stored.privateKey && stored.publicKey) return stored;
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
  const record = { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey };
  await idbSet(db, storageKey, record);
  return record;
}

function storageKey(authorityId, role) {
  return authorityId + ':' + role;
}

export async function hasGovernanceKey(authorityId, role) {
  const db = await openDb();
  return Boolean(await idbGet(db, storageKey(authorityId, role)));
}

/** One local, non-extractable Ed25519 identity per (authorityId, role) on this device. `role` is
 * a caller-chosen slug: 'seat-1'..'seat-7', 'guardian', or an incoming-credential label such as
 * 'seat-3-incoming' while a rotation/replacement is pending. Creates the key on first use. */
export async function getGovernanceSigner(authorityId, role) {
  const record = await loadOrCreateKeyRecord(storageKey(authorityId, role));
  const rawPublicKey = await crypto.subtle.exportKey('raw', record.publicKey);
  return {
    publicKeyBase64url: base64url(rawPublicKey),
    async sign(messageBytes) {
      const signature = await crypto.subtle.sign('Ed25519', record.privateKey, messageBytes);
      return base64url(signature);
    },
  };
}

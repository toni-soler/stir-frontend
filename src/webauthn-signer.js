// WebAuthn/hardware-backed credential registration and signing for Seven Keys
// (WEBAUTHN_HARDWARE_CUSTODY.md). Complements governance-signer.js's same-device Ed25519 test
// ceremony with a real hardware-backed alternative: the private key never leaves the authenticator
// and is never exportable, and STIR's backend never sees it - only the public key and, per
// assertion, a signature over a challenge STIR itself computed as
// SHA-256(domain || 0x00 || the exact governance payload). A captured assertion can never be
// replayed for a different proposal, community, tenant, constitution version or seat -
// WebAuthnCrypto.java verifies all of that server-side; this module only shapes the real browser
// API calls and the wire payloads STIR's endpoints expect.
//
// WebAuthn improves custody; it does not change governance authority. Non-exportable does not mean
// uncompromisable: a compromised browser/OS can still ask a resident WebAuthn credential to sign an
// attacker-chosen challenge while it is plugged in/unlocked, exactly the same class of "device
// custody, not identity custody" caveat governance-signer.js already documents for its own
// non-extractable WebCrypto keys - this is a stronger guarantee than that (the key material itself
// truly never touches this origin's JavaScript, unlike a WebCrypto CryptoKey which at least
// theoretically could be if the API allowed it), not an absolute one.
import { base64url } from './signer.js';

// A WebAuthn credential can only ever be invoked again from the same device/browser that
// registered it - that is WebAuthn's own model, not a STIR limitation. This mirrors
// governance-signer.js's own per-(authorityId, role) IndexedDB convention so a later signing
// action on this same device can find "which physical credential handles this role" without the
// backend ever needing to hand that mapping back out (it does not store which device a
// registration happened on, only the credential's public key and replay-protection state).
const DB_NAME = 'stir-webauthn-credentials';
const STORE = 'credentials';
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
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
function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function storageKey(authorityId, role) { return authorityId + ':' + role; }

/** Remembers a just-registered credential for later signing on this same device, under `role`
 * exactly as given, and additionally under its base role (stripping a trailing "-incoming") so a
 * credential registered for a pending rotation/appointment is immediately usable under its
 * ongoing role identity too, once that proposal activates. */
export async function rememberCredential(authorityId, role, record) {
  const db = await openDb();
  await idbSet(db, storageKey(authorityId, role), record);
  const baseRole = role.replace(/-incoming$/, '');
  if (baseRole !== role) await idbSet(db, storageKey(authorityId, baseRole), record);
}

export async function recalledCredential(authorityId, role) {
  const db = await openDb();
  return idbGet(db, storageKey(authorityId, role));
}

export function isWebAuthnAvailable() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'
    && typeof navigator !== 'undefined' && typeof navigator.credentials !== 'undefined';
}

/** The exact WebAuthn challenge STIR expects for a governance assertion: base64url(SHA-256(domain-
 * separated message bytes)) - the same bytes governance-signer.js's messageForStoredPayload()/
 * messageForOwnPayload() already build for Ed25519. Binding the challenge to this digest, rather
 * than to the message itself, is what makes a captured assertion unreproducible for a different
 * proposal/community/tenant/constitution version/seat: any difference changes the digest. */
export async function challengeFor(messageBytes) {
  const digest = await crypto.subtle.digest('SHA-256', messageBytes);
  return base64url(digest);
}

export function decodeBase64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// COSE algorithm identifiers WebAuthnCrypto.java verifies (RFC 8152 §8). Offering all three lets
// whatever the authenticator actually supports (most platform/roaming authenticators: ES256; some
// security keys: RS256 or EdDSA) succeed, rather than hardcoding one and excluding hardware that
// prefers another - STIR never depends on a specific authenticator brand or algorithm.
const COSE_ALGORITHMS = [-7, -257, -8];

/** Runs a real navigator.credentials.create() ceremony and returns the wire payload STIR's
 * POST .../webauthn/register/finish endpoint expects. `options` is exactly what the backend's
 * begin-registration call returned (challenge/rpId/rpName/userHandle/userName).
 * `requireUserVerification` defaults to true - a constitutional credential is high-stakes enough
 * that asking the authenticator to require its own PIN/biometric factor whenever available is the
 * right default, not merely a convenience toggle; pass false only if a specific authenticator
 * genuinely has no UV factor and the operator has weighed that tradeoff themselves. */
export async function registerCredential(options, { requireUserVerification = true } = {}) {
  const userVerification = requireUserVerification ? 'required' : 'preferred';
  const publicKey = {
    challenge: decodeBase64url(options.challenge),
    rp: { id: options.rpId, name: options.rpName },
    user: { id: decodeBase64url(options.userHandle), name: options.userName, displayName: options.userName },
    pubKeyCredParams: COSE_ALGORITHMS.map((alg) => ({ type: 'public-key', alg })),
    // Attestation stays "none": WEBAUTHN_HARDWARE_CUSTODY.md deliberately does not verify an
    // attestation trust chain (no clear security benefit was shown for requiring it here), so
    // asking the authenticator for anything stronger would only leak authenticator identity for a
    // check STIR never performs.
    authenticatorSelection: { userVerification },
    attestation: 'none',
    timeout: 120000,
  };
  const credential = await navigator.credentials.create({ publicKey });
  const response = credential.response;
  return {
    webauthnCredentialId: base64url(credential.rawId),
    attestationObject: base64url(response.attestationObject),
    clientDataJson: base64url(response.clientDataJSON),
    userVerificationRequired: requireUserVerification,
  };
}

/** Runs a real navigator.credentials.get() ceremony proving possession over `challenge` (a
 * base64url SHA-256 digest of the exact domain-separated governance payload, computed by the
 * caller from what the backend already returned - see governance.jsx) and returns the
 * CredentialSignatureEnvelope shape wherever a SevenKeysService input record's Ed25519 signature
 * field can instead carry a WebAuthn envelope. `algorithm` must be the one this credential's
 * registration actually reported back (never guessed client-side - the backend independently
 * re-derives it from the COSE key on every verification regardless). */
export async function signAssertion({ challenge, rpId, webauthnCredentialId, algorithm }) {
  const publicKey = {
    challenge: decodeBase64url(challenge),
    rpId,
    allowCredentials: [{ type: 'public-key', id: decodeBase64url(webauthnCredentialId) }],
    userVerification: 'preferred',
    timeout: 120000,
  };
  const assertion = await navigator.credentials.get({ publicKey });
  const response = assertion.response;
  return {
    credentialType: 'WEBAUTHN',
    algorithm,
    signature: base64url(response.signature),
    clientDataJson: base64url(response.clientDataJSON),
    authenticatorData: base64url(response.authenticatorData),
  };
}

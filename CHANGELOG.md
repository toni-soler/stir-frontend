# Changelog

## 0.3.0-SNAPSHOT

Economic exchange screens: "Activación económica" (`/stir/economic`, `economic.jsx`) bootstraps the marketplace's community/unit and activates a participant, generating and storing an Ed25519 keypair client-side (`src/signer.js`, WebCrypto, non-extractable, persisted per-tenant-per-user in IndexedDB - never sent to any server). `TradeStatus` (`trade.jsx`) renders on the Agreement page: start exchange, sign (relaying only a client-produced signature), wait for the counterparty, commit, and a COMMITTED receipt (community sequence, protocol digest, timestamp) or a REJECTED notice. RFC 8785 JCS canonicalization (`canonicalize` package) replaces STIR's own hand-rolled canonicalizer, cross-verified against the Java side with a shared test vector. 35 new i18n keys across all 12 locales (132 total). Fixed: the generic API request helper now parses a 200-with-empty-body response as `null` rather than `{}`, and the marketplace-not-yet-bound check now matches the backend's actual 409 status rather than 404.

## 0.2.0-SNAPSHOT

New marketplace screens on top of the existing Listing grid/editor: My profile / public participant profile, Listing detail with a "make an offer" form, My negotiations (thread view with counter/accept/decline), My agreements (with the contractual snapshot digest). Client-side routes are absolute (`/stir/listing/:id`, `/stir/negotiations`, `/stir/negotiations/:id`, `/stir/agreements`, `/stir/agreements/:id`, `/stir/profile`, `/stir/participants/:userId`) via the Shell SDK's `react-router-dom` instance; the existing Marketplace/Mine/create/edit flow is unchanged. 46 new i18n keys across all 12 locales (97 total).

## 0.1.0-SNAPSHOT

Initial public marketplace foundation; development preview.

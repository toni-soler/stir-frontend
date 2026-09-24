# Changelog

## Usability fixes from the first real E2E review of stir.es

Real end-to-end browser testing against the production stir.es instance found the module's text
nearly unreadable and several first-time-publisher flow gaps. Fixed:

- **Contrast**: `.stir` (the module's own root container) never set a background, so its
  `color:#e9f1ee` (near-white) text sat directly on IDAX Shell's light page background
  (`:root{background:#eef3f4}`) everywhere outside the individual dark-styled cards/panels -
  headings, intro text, empty states. Gave `.stir` its own dark background/border/padding
  matching the rest of its existing card palette, restoring the contrast the color choices
  already assumed.
- **Empty states**: Marketplace and My negotiations showed the exact same "nothing matches"
  message whether nothing existed yet or a filter combination matched nothing, with no way to
  reset filters short of manually clearing every control. Now distinguishes "no listings/
  negotiations yet" from "no match for these filters", the latter with a "Clear filters" action;
  Marketplace's true-empty "Mine" state also offers a direct "Create your first listing" action.
- **First publication → photos**: creating a listing used to bounce straight to "Mine" and force
  hunting down "Edit" again just to unlock the photo uploader (which needs a real listing id a
  brand-new draft doesn't have). A successful create now switches the same open form into edit
  mode in place instead of closing it - photos unlock immediately, with a confirmation message.
  Title/description are now marked required with example placeholders and a required-fields hint
  before submitting, not only via the browser's native validation popup after the fact.
- **Own listing detail had no Edit/Close**: only reachable from "Mine", forcing a detour back to
  the marketplace list to act on a listing already being viewed. Added Edit/Close directly to the
  own-listing detail view (`/stir/mine?edit=<id>` hands off to the existing Mine-tab editor rather
  than duplicating the form).
- **Profile completeness**: an incomplete profile silently shows as "Participante" to everyone
  once you publish or negotiate, with no prompt to fix it. Home now shows a completion prompt
  when the display name is missing, alongside the existing economic-activation prompt; the
  profile form itself now explains the display name is public and independent from the login
  email.

13 new i18n keys across all 12 locales (197 total, `npm run i18n:validate` passing).

## 0.3.0-SNAPSHOT

Economic exchange screens: "Activación económica" (`/stir/economic`, `economic.jsx`) bootstraps the marketplace's community/unit and activates a participant, generating and storing an Ed25519 keypair client-side (`src/signer.js`, WebCrypto, non-extractable, persisted per-tenant-per-user in IndexedDB - never sent to any server). `TradeStatus` (`trade.jsx`) renders on the Agreement page: start exchange, sign (relaying only a client-produced signature), wait for the counterparty, commit, and a COMMITTED receipt (community sequence, protocol digest, timestamp) or a REJECTED notice. RFC 8785 JCS canonicalization (`canonicalize` package) replaces STIR's own hand-rolled canonicalizer, cross-verified against the Java side with a shared test vector. 35 new i18n keys across all 12 locales (132 total). Fixed: the generic API request helper now parses a 200-with-empty-body response as `null` rather than `{}`, and the marketplace-not-yet-bound check now matches the backend's actual 409 status rather than 404.

## 0.2.0-SNAPSHOT

New marketplace screens on top of the existing Listing grid/editor: My profile / public participant profile, Listing detail with a "make an offer" form, My negotiations (thread view with counter/accept/decline), My agreements (with the contractual snapshot digest). Client-side routes are absolute (`/stir/listing/:id`, `/stir/negotiations`, `/stir/negotiations/:id`, `/stir/agreements`, `/stir/agreements/:id`, `/stir/profile`, `/stir/participants/:userId`) via the Shell SDK's `react-router-dom` instance; the existing Marketplace/Mine/create/edit flow is unchanged. 46 new i18n keys across all 12 locales (97 total).

## 0.1.0-SNAPSHOT

Initial public marketplace foundation; development preview.

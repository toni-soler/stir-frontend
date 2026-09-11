# Changelog

## 0.2.0-SNAPSHOT

New marketplace screens on top of the existing Listing grid/editor: My profile / public participant profile, Listing detail with a "make an offer" form, My negotiations (thread view with counter/accept/decline), My agreements (with the contractual snapshot digest). Client-side routes are absolute (`/stir/listing/:id`, `/stir/negotiations`, `/stir/negotiations/:id`, `/stir/agreements`, `/stir/agreements/:id`, `/stir/profile`, `/stir/participants/:userId`) via the Shell SDK's `react-router-dom` instance; the existing Marketplace/Mine/create/edit flow is unchanged. 46 new i18n keys across all 12 locales (97 total).

## 0.1.0-SNAPSHOT

Initial public marketplace foundation; development preview.

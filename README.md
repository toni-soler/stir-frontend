# STIR frontend 0.1.0-SNAPSHOT

Public IDAX Shell 0.3 JavaScript React extension. No separate login or tenant state. Uses Shell's React/router/i18n/fetchWithAuth and public saved-filter API. Requires the reviewed activeTenantId SDK addition in stir-main.

`npm ci && npm test && npm run i18n:validate && npm run build`

Bundle: dist/extensions/stir/index.js and index.css. No React duplication: React comes from the host SDK. Routes: /stir, /stir/mine, /stir/new. Shell provides session/preferences; STIR provides commercial cards and the Listing form. Public Shell's current CRUD is hardcoded to administration entities, so it is not a usable extension CRUD contract. That gap is documented rather than copying its implementation.

No uploads, negotiation or economic actions in this vertical. Text is rendered by React, never interpreted as HTML.

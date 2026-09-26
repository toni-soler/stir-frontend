# STIR frontend 0.5.0-rc1

Public IDAX Shell JavaScript React extension. No separate login or tenant state. Uses Shell's React/router/i18n/fetchWithAuth and active tenant context.

`npm ci && npm test && npm run i18n:validate && npm run build`

Main bundle: `dist/extensions/stir/index.js` and `index.css`. No React duplication: React comes from the host SDK. Shell provides session/preferences; STIR provides marketplace, negotiation, agreement and community flows.

The first independent frontend consumer entry is `dist/community/stir-catalog.mjs`. It is built from `src/catalog-client.js`, the same source consumed by STIR's own catalog/detail views. Its contract, buildable second presentation and deployment instructions are in [the example README](examples/community-catalog/README.md). This artifact is not a complete frontend SDK: other STIR flows still use internal code. Text is rendered by React, never interpreted as HTML.

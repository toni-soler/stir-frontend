import { build } from 'esbuild';
import { cp } from 'node:fs/promises';
import { verifyCommunityBuild } from './verify-community-build.mjs';
await build({entryPoints:['src/extension.jsx'],bundle:true,format:'iife',jsxFactory:'React.createElement',outfile:'dist/extensions/stir/index.js'});
// Framework-free consumer entry: independent community frontends can import
// this artifact without loading STIR's Shell extension or a second React.
await build({entryPoints:['src/catalog-client.js'],bundle:true,format:'esm',outfile:'dist/community/stir-catalog.mjs'});
await build({entryPoints:['examples/community-catalog/extension.jsx'],bundle:true,format:'iife',jsxFactory:'React.createElement',outfile:'dist/examples/extensions/community-catalog/index.js'});
// The user manual (src/manual) is a static page served next to the extension: /extensions/stir/manual/.
await cp('src/manual', 'dist/extensions/stir/manual', { recursive: true });
await verifyCommunityBuild();

import { build } from 'esbuild';
await build({entryPoints:['src/extension.jsx'],bundle:true,format:'iife',jsxFactory:'React.createElement',outfile:'dist/extensions/stir/index.js'});

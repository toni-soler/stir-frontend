// The user manual must keep up with the product: every screen is in its index, every button or field
// it names exists in the Spanish UI, its table of contents points at real chapters, and it works under
// a strict Content-Security-Policy. Each MVP that adds a screen or a label has to update the manual.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const manual = read('../src/manual/index.html');
const extension = read('../src/extension.jsx');
const spanish = JSON.parse(read('../src/locales.json')).es;
// Labels that belong to the platform around STIR (the Shell), not to STIR's own bundle.
const PLATFORM_LABELS = new Set(['Espacio actual', 'STIR', 'Usuarios', 'Roles']);
const decode = (text) => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

test('every STIR screen is described in the manual\'s screen index', () => {
  const routes = [...extension.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((path) => path !== '/stir/*');
  assert.ok(routes.length > 15);
  for (const route of routes) {
    const shown = route.replace(/:[A-Za-z]+$/, '…');
    assert.ok(manual.includes(`<code>${shown}</code>`), `the screen index does not describe ${route}`);
  }
  assert.ok(manual.includes('<code>/stir</code>'), 'the marketplace itself');
});

test('every button and field the manual names exists in the Spanish UI', () => {
  const values = Object.values(spanish).map((value) => String(value));
  const labels = [...manual.matchAll(/<span class="ui">([^<]+)<\/span>/g)].map((m) => decode(m[1]));
  assert.ok(labels.length > 100);
  const missing = [...new Set(labels)].filter((label) => {
    if (PLATFORM_LABELS.has(label)) return false;
    const bare = label.replace(/^\+\s*/, '');
    return !values.some((value) => value === bare || value === label || value.includes(bare));
  });
  assert.deepEqual(missing, [], 'labels in the manual that the Spanish UI does not show');
});

test('the table of contents points at real chapters, and nothing runs inline', () => {
  const ids = new Set([...manual.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, target] of manual.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(target), `#${target}`);
  assert.doesNotMatch(manual, /<script>|<style>|\sstyle="|\son[a-z]+="/i, 'inline script or style would break the CSP');
  assert.match(manual, /<script src="manual\.js"><\/script>/);
  assert.match(manual, /<link rel="stylesheet" href="manual\.css">/);
});

test('the manual opens from STIR and every locale names it', () => {
  assert.match(extension, /export const MANUAL_URL='\/extensions\/stir\/manual\/'/);
  for (const [locale, bundle] of Object.entries(JSON.parse(read('../src/locales.json')))) assert.ok(bundle.userManual, locale);
  assert.match(read('../scripts/build.mjs'), /cp\('src\/manual', 'dist\/extensions\/stir\/manual'/);
});

test('the manual describes no score and no automatic sanction', () => {
  const text = manual.replace(/<[^>]+>/g, ' ');
  assert.match(text, /No hay puntuaciones/);
  assert.match(text, /Nada se vuelve firme sólo porque pasa el tiempo/);
});

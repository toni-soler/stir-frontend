// The user manual must keep up with the product: every screen is in its index, every button or field
// it names exists in the Spanish UI, its table of contents points at real chapters, and it works under
// a strict Content-Security-Policy. Each MVP that adds a screen or a label has to update the manual.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const extension = read('../src/extension.jsx');
const bundles = JSON.parse(read('../src/locales.json'));
// The manual is written in Spanish and in English; each copy is checked against the UI in its own language.
const MANUALS = { es: read('../src/manual/es/index.html'), en: read('../src/manual/en/index.html') };
// Labels that belong to the platform around STIR (the Shell), not to STIR's own bundle.
const PLATFORM_LABELS = new Set(['Espacio actual', 'Current workspace', 'STIR', 'Usuarios', 'Users', 'Roles']);
const decode = (text) => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

for (const [language, manual] of Object.entries(MANUALS)) {
test(`${language}: every STIR screen is described in the manual's screen index`, () => {
  const routes = [...extension.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((path) => path !== '/stir/*');
  assert.ok(routes.length > 15);
  for (const route of routes) {
    const shown = route.replace(/:[A-Za-z]+$/, '…');
    assert.ok(manual.includes(`<code>${shown}</code>`), `the screen index does not describe ${route}`);
  }
  assert.ok(manual.includes('<code>/stir</code>'), 'the marketplace itself');
});

test(`${language}: every button and field the manual names exists in the UI`, () => {
  const values = Object.values(bundles[language]).map((value) => String(value));
  const labels = [...manual.matchAll(/<span class="ui">([^<]+)<\/span>/g)].map((m) => decode(m[1]));
  assert.ok(labels.length > 100);
  const missing = [...new Set(labels)].filter((label) => {
    if (PLATFORM_LABELS.has(label)) return false;
    const bare = label.replace(/^\+\s*/, '');
    return !values.some((value) => value === bare || value === label || value.includes(bare));
  });
  assert.deepEqual(missing, [], `labels in the ${language} manual that the ${language} UI does not show`);
});

test(`${language}: the contents point at real chapters, every picture exists, and nothing runs inline`, () => {
  const ids = new Set([...manual.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, target] of manual.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(target), `#${target}`);
  assert.doesNotMatch(manual, /<script>|<style>|\sstyle="|\son[a-z]+="/i, 'inline script or style would break the CSP');
  assert.match(manual, /<script src="\.\.\/manual\.js"><\/script>/);
  assert.match(manual, /<link rel="stylesheet" href="\.\.\/manual\.css">/);
  const pictures = [...manual.matchAll(/<img src="\.\.\/(img\/[^"]+)" alt="[^"]{10,}"/g)].map((m) => m[1]);
  assert.equal(pictures.length, (manual.match(/<img /g) || []).length, 'every picture has a description');
  assert.ok(pictures.length >= 8);
  for (const picture of pictures) {
    assert.ok(picture.startsWith(`img/${language}/`), `${picture} is a screenshot of the ${language} UI`);
    assert.ok(fs.existsSync(new URL(`../src/manual/${picture}`, import.meta.url)), `missing ${picture}: run stir-main/scripts/manual_screenshots.py`);
  }
});
}

test('both copies have the same chapters and link to each other', () => {
  const chapters = (manual) => [...manual.matchAll(/<section id="/g)].length;
  assert.equal(chapters(MANUALS.es), chapters(MANUALS.en));
  assert.match(MANUALS.es, /href="\.\.\/en\/"/);
  assert.match(MANUALS.en, /href="\.\.\/es\/"/);
});

test('the manual opens from STIR and every locale names it', () => {
  assert.match(extension, /export const MANUAL_URL='\/extensions\/stir\/manual\/'/);
  assert.match(extension, /href=\{manualUrl\(/);
  for (const [locale, bundle] of Object.entries(JSON.parse(read('../src/locales.json')))) assert.ok(bundle.userManual, locale);
  // Each bundle names the copy its readers open: the Iberian languages the Spanish one, the rest the English one.
  for (const [locale, bundle] of Object.entries(bundles)) assert.equal(bundle.manualLanguage, ['es', 'ca', 'gl', 'eu'].includes(locale) ? 'es' : 'en', locale);
  assert.match(extension, /href=\{manualUrl\(t\('manualLanguage'\)\)\}/);
  assert.match(read('../scripts/build.mjs'), /cp\('src\/manual', 'dist\/extensions\/stir\/manual'/);
});

test('the manual describes no score and no automatic sanction, in both languages', () => {
  const text = (manual) => manual.replace(/<[^>]+>/g, ' ');
  assert.match(text(MANUALS.es), /No hay puntuaciones/);
  assert.match(text(MANUALS.es), /Nada se vuelve firme sólo porque pasa el tiempo/);
  assert.match(text(MANUALS.en), /There are no scores/);
  assert.match(text(MANUALS.en), /Nothing becomes final just because time passes/);
});

test('the manual link opens the copy in the reader\'s language', () => {
  assert.doesNotMatch(extension, /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/, 'no control character in the source');
  const literal = extension.match(/\/(\^\(es\|ca\|gl\|eu\)[^/]*)\/\.test/);
  assert.ok(literal, 'the language rule of manualUrl');
  const spanish = new RegExp(literal[1]);
  for (const code of ['es', 'es-ES', 'ca', 'gl', 'eu']) assert.ok(spanish.test(code), code);
  for (const code of ['en', 'en-GB', 'pt', 'pt-BR', 'fr', 'de', 'it', 'jp', 'zh', 'escape', '']) assert.ok(!spanish.test(code), code);
});

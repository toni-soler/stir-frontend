// Ordinary governance can only be switched on once its electorate holds a member (the server refuses
// otherwise, fail-closed). The panel must therefore let a manager build the electorate while governance is
// still off, and keep the switch disabled - with a reason - until there is someone on it. Before this, the
// electorate was only shown once governance was on: no community could turn it on from the browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel = fs.readFileSync(new URL('../src/ordinary-governance.jsx', import.meta.url), 'utf8');
const bundles = JSON.parse(fs.readFileSync(new URL('../src/locales.json', import.meta.url), 'utf8'));

test('the electorate is built before ordinary governance is switched on', () => {
  const electorate = panel.indexOf("<summary>{t('govElectorate')}</summary>");
  const enabledOnly = panel.indexOf('{settings?.ordinaryGovernanceEnabled && <>');
  assert.ok(electorate > 0 && enabledOnly > 0);
  assert.ok(electorate < enabledOnly, 'the electorate must not be hidden until governance is on');
});

test('the switch waits for a member and says why', () => {
  assert.match(panel, /disabled=\{busy \|\| \(!settings\?\.ordinaryGovernanceEnabled && members\.length === 0\)\}/);
  assert.match(panel, /members\.length === 0 && <p><small>\{t\('govEnableNeedsElectorate'\)\}<\/small><\/p>/);
  for (const [locale, bundle] of Object.entries(bundles)) assert.ok(bundle.govEnableNeedsElectorate, locale);
});

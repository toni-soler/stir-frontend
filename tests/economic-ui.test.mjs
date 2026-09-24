import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('MyEconomicProfile distinguishes loading from a genuine load failure, instead of hanging on "Cargando..." forever', () => {
  const source = read('../src/economic.jsx');
  // the old bug: undefined doubled as both "still loading" and "failed to load", so any error
  // other than the recognized 409/404 "not bound"/"not activated" cases rendered the loading
  // state forever - settled flags are what make the two distinguishable.
  assert.match(source, /marketplaceSettled/);
  assert.match(source, /meSettled/);
  assert.match(source, /if \(!marketplaceSettled \|\| !meSettled\) return <p role="status">\{t\('loading'\)\}<\/p>;/);
  // a missing stir.economic.read must be its own state, not a retryable "error occurred" banner
  assert.match(source, /if \(forbidden\) return <p>\{t\('economicReadForbidden'\)\}<\/p>;/);
  // any other unresolved failure gets a real error message and a retry action
  assert.match(source, /onClick=\{load\}>\{t\('retry'\)\}/);
});

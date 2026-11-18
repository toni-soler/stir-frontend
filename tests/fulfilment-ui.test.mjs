import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const bundles = JSON.parse(read('../src/locales.json'));
const source = read('../src/fulfilment.jsx');
const constant = (name) => JSON.parse(source.match(new RegExp(`export const ${name} = (\\[[^\\]]*\\])`))[1].replace(/'/g, '"'));

test('every dynamic fulfilment label exists in all 12 locales', () => {
  const families = {
    declaration: [...constant('OBLIGOR_TYPES'), ...constant('BENEFICIARY_TYPES')],
    obligationKind: ['OBJECT', 'OWNER_TASKS', 'INITIATOR_TASKS', 'ECONOMIC_EXCHANGE'],
    obligationStatus: ['PENDING', 'DECLARED', 'PARTIAL', 'DONE', 'IN_DISAGREEMENT', 'FAILED', 'SUPERSEDED'],
    obligationStatusHelp: ['PENDING', 'DECLARED', 'PARTIAL', 'DONE', 'IN_DISAGREEMENT', 'FAILED', 'SUPERSEDED'],
    executionOutcome: ['COMMITTED', 'EXPOSURE_REFUSAL', 'AUTHORISATION_INCOMPLETE', 'INVALID_DESCRIPTION', 'IMPLEMENTATION_FAULT', 'UNKNOWN'],
    executionOutcomeHelp: ['COMMITTED', 'EXPOSURE_REFUSAL', 'AUTHORISATION_INCOMPLETE', 'INVALID_DESCRIPTION', 'IMPLEMENTATION_FAULT', 'UNKNOWN'],
    amendmentStatus: ['PROPOSED', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
    historyEntry: ['OBJECT', 'OWNER_TASKS', 'INITIATOR_TASKS'],
    notificationType: ['OBLIGATION_UPDATED', 'AMENDMENT_PROPOSED', 'AMENDMENT_ACCEPTED', 'AMENDMENT_REJECTED'],
  };
  for (const [locale, bundle] of Object.entries(bundles))
    for (const [prefix, codes] of Object.entries(families))
      for (const code of codes) assert.ok(bundle[prefix + code], `${locale}: ${prefix}${code}`);
});

test('declarations mirror the backend: each party only its own side, notes required for partial ones', () => {
  assert.deepEqual(constant('OBLIGOR_TYPES'), ['PERFORMED', 'PARTIALLY_PERFORMED', 'NOT_PERFORMED']);
  assert.deepEqual(constant('BENEFICIARY_TYPES'), ['CONFORMITY_CONFIRMED', 'PARTIAL_RECEIVED', 'NONCONFORMITY_REPORTED', 'NOT_RECEIVED']);
  assert.deepEqual(constant('NOTE_REQUIRED'), ['PARTIALLY_PERFORMED', 'PARTIAL_RECEIVED']);
  // The economic exchange is evidenced by osTRIS: never offered for a manual declaration or an amendment.
  assert.ok(!constant('AMENDABLE_KINDS').includes('ECONOMIC_EXCHANGE'));
  assert.match(source, /const canDeclare = !economic && /);
});

test('history is described facts with no score, and never shown as low', () => {
  for (const bundle of Object.values(bundles)) {
    for (const key of ['historyNoneYet', 'historyNotShared', 'historyHelp']) assert.ok(bundle[key]);
  }
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /score|rating|stars|percent|trust ?level/i);
  assert.match(source, /history\.status === 'NOT_SHARED'/);
  assert.match(source, /history\.status === 'NO_HISTORY_YET'/);
});

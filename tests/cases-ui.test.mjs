import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const bundles = JSON.parse(read('../src/locales.json'));
const source = read('../src/cases.jsx');
const signer = read('../src/signer.js');
const constant = (name) => JSON.parse(source.match(new RegExp(`export const ${name} = (\\[[^\\]]*\\])`))[1].replace(/'/g, '"').replace(/\s+/g, ''));

test('every dynamic case label exists in all 12 locales', () => {
  const families = {
    caseClaim: constant('CLAIMS'),
    caseStatus: constant('CASE_STATUSES'),
    caseStatusHelp: constant('CASE_STATUSES'),
    caseEvent: constant('EVENT_TYPES'),
    caseEffect: constant('EFFECTS'),
    caseSubject: constant('SUBJECT_ROLES'),
    caseAssessment: constant('ASSESSMENTS'),
    caseDecision: ['FINDING', 'ATTRIBUTION', 'SANCTION'],
    caseDecisionHelp: ['FINDING', 'ATTRIBUTION', 'SANCTION'],
    caseDecisionStatus: constant('DECISION_STATUSES'),
    caseYourRole: ['CLAIMANT', 'RESPONDENT', 'REVIEWER'],
    caseActor: ['CLAIMANT', 'RESPONDENT', 'REVIEWER'],
    caseEconomicCorrection: ['NONE', 'FULL_REVERSAL'],
    caseSanction: ['WARNING'],
    caseAppealStatus: ['OPEN', 'UPHELD', 'OVERTURNED'],
    caseVisibility: ['PARTIES_AND_REVIEWERS', 'REVIEWERS_ONLY'],
    caseRemedy: ['ECONOMIC_REVERSAL'],
    caseRemedyStatus: ['AWAITING_AUTHORITY', 'EXECUTED'],
    correctionStatus: ['AWAITING_AUTHORITY', 'EXECUTED'],
    correctionHelp: ['AWAITING_AUTHORITY', 'EXECUTED'],
    notificationType: ['CASE_OPENED', 'CASE_UPDATED'],
    error: ['CASE_CONTAINMENT_ACTIVE'],
  };
  for (const [locale, bundle] of Object.entries(bundles))
    for (const [prefix, codes] of Object.entries(families))
      for (const code of codes) assert.ok(bundle[prefix + code], `${locale}: ${prefix}${code}`);
});

test('the case vocabulary mirrors the backend and only people\'s obligations can be claimed', () => {
  assert.deepEqual(constant('CLAIMS'), ['NON_DELIVERY', 'NON_CONFORMITY', 'PARTIAL_DELIVERY']);
  assert.deepEqual(constant('CLAIMABLE_KINDS'), ['OBJECT', 'OWNER_TASKS', 'INITIATOR_TASKS']);
  assert.deepEqual(constant('ASSESSMENTS'), ['NO_FAULT', 'GOOD_FAITH_THIRD_PARTY', 'GOOD_FAITH_ERROR', 'BREACH']);
  // The only sanction a reviewer can decide is a warning; nothing else is offered.
  assert.match(source, /api\.sanction\(c\.id, \{ kind: 'WARNING', reasoning \}\)/);
});

test('a reviewer only ever signs the governance domain, never an account authorization', () => {
  assert.match(signer, /export const GOVERNANCE_AUTHORIZATION_DOMAIN = 'OSTRIS:TX:GOVAUTH:V1'/);
  assert.match(signer, /if \(signingDomain !== GOVERNANCE_AUTHORIZATION_DOMAIN\) throw/);
  assert.match(source, /governanceMessageBytes\(current\.signingDomain, current\.governancePayload\)/);
  assert.doesNotMatch(source, /authorizationMessageBytes/);
});

test('no score, rating or trust level anywhere in the case UI', () => {
  // Translation keys (e.g. caseNoScore, which says there is none) are not computed values.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/t\('[A-Za-z]+'\)/g, '');
  assert.doesNotMatch(code, /score|rating|stars|percent|trust ?level/i);
  for (const bundle of Object.values(bundles)) assert.ok(bundle.caseNoScore && bundle.caseSanctionHelp);
});

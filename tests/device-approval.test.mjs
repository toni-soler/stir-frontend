import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deviceApi } from '../src/api.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const sdkAnswering = (answers) => {
  const sent = [];
  return { sent, fetchWithAuth: async (path, options) => {
    sent.push({ path, options });
    const answer = answers.shift();
    return { ok: answer.status < 300, status: answer.status, text: async () => (answer.body === undefined ? '' : JSON.stringify(answer.body)) };
  } };
};
const intent = { action: 'OSTRIS_CREDENTIAL_ADD', resource: 'controller-1', intentDigest: 'a'.repeat(64) };

test('a device change is first tried without an approval and carries none unless one was obtained', async () => {
  const sdk = sdkAnswering([{ status: 201, body: { credentialId: 'c1' } }, { status: 200 }]);
  const api = deviceApi(sdk, 'tenant-a');
  await api.add('Phone', 'pk');
  await api.revoke('c1');
  for (const call of sdk.sent) assert.equal(call.options.headers['X-Operation-Approval'], undefined);
  assert.equal(sdk.sent[0].path, '/api/stir/tenants/tenant-a/economic/devices');
});

test('"approval required" from osTRIS is its own recognisable error, not a generic HTTP 428', async () => {
  const sdk = sdkAnswering([{ status: 428, body: { message: 'OPERATION_APPROVAL_REQUIRED' } }, { status: 403, body: { message: 'CONTROLLER_NOT_OWNED' } }]);
  const api = deviceApi(sdk, 'tenant-a');
  await assert.rejects(api.add('Phone', 'pk'), { message: 'stir.errorOPERATION_APPROVAL_REQUIRED', status: 428 });
  await assert.rejects(api.revoke('c1'), { message: 'stir.errorCONTROLLER_NOT_OWNED' });
});

test('the intent to approve comes from STIR and the approval is requested from the identity service for exactly it', async () => {
  const sdk = sdkAnswering([{ status: 200, body: intent }, { status: 200, body: { approvalToken: 'approval', expiresAt: 'soon' } }]);
  const api = deviceApi(sdk, 'tenant-a');
  assert.deepEqual(await api.addIntent('pk'), intent);
  assert.equal(sdk.sent[0].path, '/api/stir/tenants/tenant-a/economic/devices/approval-intent');
  assert.equal(await api.requestApproval(intent, '123456'), 'approval');
  assert.equal(sdk.sent[1].path, '/api/shell/v1/tenants/tenant-a/operation-approvals');
  assert.deepEqual(JSON.parse(sdk.sent[1].options.body), { ...intent, code: '123456' });
});

test('the approval travels only as a header on the one retried change', async () => {
  const sdk = sdkAnswering([{ status: 201, body: { credentialId: 'c2' } }, { status: 200 }]);
  const api = deviceApi(sdk, 'tenant-a');
  await api.add('Phone', 'pk', 'approval');
  assert.equal(sdk.sent[0].options.headers['X-Operation-Approval'], 'approval');
  assert.deepEqual(JSON.parse(sdk.sent[0].options.body), { label: 'Phone', publicKeyBase64url: 'pk' });
  await api.revoke('c2', 'approval-2');
  assert.equal(sdk.sent[1].path, '/api/stir/tenants/tenant-a/economic/devices/c2/revoke');
  assert.equal(sdk.sent[1].options.headers['X-Operation-Approval'], 'approval-2');
});

test('refused approvals map to messages a person can act on, and never leak a response body', async () => {
  const cases = [[403, { code: 'INVALID_TOTP' }, 'stir.approvalInvalidCode'], [409, { code: 'MFA_NOT_ENABLED' }, 'stir.approvalMfaRequired'],
    [429, { code: 'RATE_LIMITED' }, 'stir.approvalRateLimited'], [500, undefined, 'stir.approvalFailed'], [200, { nothing: true }, 'stir.approvalFailed']];
  for (const [status, body, message] of cases) {
    const api = deviceApi(sdkAnswering([{ status, body }]), 'tenant-a');
    await assert.rejects(api.requestApproval(intent, '000000'), { message });
  }
});

test('codes and approvals are never stored or logged by the device UI', () => {
  const source = read('../src/devices.jsx') + read('../src/api.js');
  assert.doesNotMatch(source, /(localStorage|sessionStorage|indexedDB)[^\n]*(approval|code)/i);
  assert.doesNotMatch(source, /console\.(log|debug|info)\(/);
  const ui = read('../src/devices.jsx');
  // the code field is cleared before the request is made, whatever the outcome
  assert.match(ui, /const entered = code\.trim\(\); setCode\(''\);/);
  // an approval that no longer fits is not retried with the same token
  assert.match(ui, /errorOPERATION_APPROVAL_\/\.test\(e\.message\)\) \{ setPending\(null\)/);
  assert.match(ui, /autoComplete="one-time-code"/);
});

test('every locale explains the approval step', () => {
  const locales = JSON.parse(read('../src/locales.json'));
  const keys = ['approvalTitle', 'approvalHelpAdd', 'approvalHelpRevoke', 'approvalCode', 'approvalConfirm', 'approvalInvalidCode',
    'approvalMfaRequired', 'approvalRateLimited', 'approvalRestart', 'approvalFailed', 'errorCONTROLLER_NOT_OWNED', 'errorCONTROLLER_OWNERSHIP_UNASSIGNED'];
  for (const [locale, messages] of Object.entries(locales)) for (const key of keys) assert.ok(messages[key]?.trim(), `${locale} is missing ${key}`);
});

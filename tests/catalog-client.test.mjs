import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogClient, listingPayload, offerPayload } from '../src/catalog-client.js';

function sdk(responses) {
  const calls = [];
  return {
    calls,
    fetchWithAuth: async (path, options) => {
      calls.push({ path, options });
      const next = responses.shift();
      return { ok: next.status < 400, status: next.status, text: async () => next.body === null ? '' : JSON.stringify(next.body) };
    },
  };
}

test('catalog contract supports the tenant-scoped listing and offer flow', async () => {
  const backend = sdk([
    { status: 200, body: { content: [{ id: 'item/1', title: 'Chair' }], totalPages: 1 } },
    { status: 200, body: { id: 'item/1', title: 'Chair', status: 'ACTIVE' } },
    { status: 201, body: { id: 'negotiation-1' } },
  ]);
  const catalog = createCatalogClient(backend, 'tenant a');
  const controller = new AbortController();
  const result = await catalog.list({ q: 'chair', status: 'ACTIVE', page: 0, ignored: '' }, controller.signal);
  assert.equal(result.content[0].title, 'Chair');
  assert.equal(backend.calls[0].path, '/api/stir/tenants/tenant%20a/listings?q=chair&status=ACTIVE&page=0');
  assert.equal(backend.calls[0].options.signal, controller.signal);
  assert.equal((await catalog.read('item/1')).status, 'ACTIVE');
  assert.equal(backend.calls[1].path, '/api/stir/tenants/tenant%20a/listings/item%2F1');
  const negotiation = await catalog.offer('item/1', offerPayload({ message: 'Interested' }));
  assert.equal(negotiation.id, 'negotiation-1');
  assert.deepEqual(JSON.parse(backend.calls[2].options.body), { message: 'Interested', quantity: null, unitLabel: null, proposedAmount: null, proposedUnitRef: null, terms: null });
  assert.equal(backend.calls[2].path, '/api/stir/tenants/tenant%20a/listings/item%2F1/offers');
});

test('catalog contract refuses demo and missing tenant, and excludes forged ownership fields', () => {
  assert.throws(() => createCatalogClient({ demo: true, fetchWithAuth() {} }, 'tenant'), { message: 'stir.realSessionRequired' });
  assert.throws(() => createCatalogClient({ fetchWithAuth() {} }, ''), { message: 'stir.realSessionRequired' });
  assert.deepEqual(listingPayload({ direction: 'WANTED', title: 'Chair', description: 'Wood', category: 'home', resourceKind: 'physical', ownerId: 'forged', tenantId: 'wrong' }, false),
    { direction: 'WANTED', title: 'Chair', description: 'Wood', category: 'home', resourceKind: 'physical', location: null });
});

test('catalog contract preserves backend conflict status and translated error code', async () => {
  const backend = sdk([{ status: 409, body: { message: 'VERSION_CONFLICT: changed elsewhere' } }]);
  await assert.rejects(createCatalogClient(backend, 'tenant').close('listing', 2), (error) => {
    assert.equal(error.message, 'stir.errorVERSION_CONFLICT');
    assert.equal(error.status, 409);
    assert.equal(error.detail, 'VERSION_CONFLICT: changed elsewhere');
    return true;
  });
});

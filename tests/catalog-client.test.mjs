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

test('offerPayload only forwards an external contract commitment when a distribution supplies one', () => {
  assert.deepEqual(offerPayload({ message: 'Interested' }),
    { message: 'Interested', quantity: null, unitLabel: null, proposedAmount: null, proposedUnitRef: null, terms: null });
  assert.deepEqual(offerPayload({ message: 'Interested', externalContractNamespace: 'example.market', externalContractDigest: 'a'.repeat(64) }),
    { message: 'Interested', quantity: null, unitLabel: null, proposedAmount: null, proposedUnitRef: null, terms: null,
      externalContractNamespace: 'example.market', externalContractDigest: 'a'.repeat(64) });
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

test('photo metadata and authenticated binary content stay inside the tenant boundary', async () => {
  const paths = [];
  const client = createCatalogClient({ fetchWithAuth: async (path, options) => {
    paths.push({ path, options });
    if (path.endsWith('/photos')) return { ok: true, status: 200, text: async () => '[{"id":"photo/1"}]' };
    return { ok: true, status: 200, blob: async () => new Blob(['image bytes'], { type: 'image/png' }) };
  } }, 'tenant a');
  const controller = new AbortController();
  assert.deepEqual(await client.photos('listing/1', controller.signal), [{ id: 'photo/1' }]);
  const objectUrl = await client.contentUrl('photo/1', controller.signal);
  try {
    assert.match(objectUrl, /^blob:/);
    assert.equal(paths[0].path, '/api/stir/tenants/tenant%20a/listings/listing%2F1/photos');
    assert.equal(paths[1].path, '/api/stir/tenants/tenant%20a/attachments/photo%2F1/content');
    assert.equal(paths[0].options.signal, controller.signal);
    assert.equal(paths[1].options.signal, controller.signal);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
});

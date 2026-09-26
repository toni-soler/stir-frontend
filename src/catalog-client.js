/**
 * STIR catalog consumer contract v1. No Shell registration, React, routing or
 * global state: a distribution supplies the current Shell SDK and tenant.
 * Keep the backend's authorization and tenant checks as the source of truth.
 */
export const CATALOG_CONTRACT_VERSION = 1;

export function createCatalogClient(sdk, tenantId) {
  if (!tenantId || sdk?.demo || typeof sdk?.fetchWithAuth !== 'function') {
    throw new Error('stir.realSessionRequired');
  }
  const base = `/api/stir/tenants/${encodeURIComponent(tenantId)}/listings`;
  const request = async (suffix = '', options = {}) => {
    const response = await sdk.fetchWithAuth(base + suffix, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const match = /^([A-Z_]+): /.exec(typeof data?.message === 'string' ? data.message : '');
      const error = new Error(match ? `stir.error${match[1]}` : `stir.http${response.status}`);
      error.status = response.status;
      error.detail = typeof data?.message === 'string' ? data.message : '';
      throw error;
    }
    return data;
  };
  const idPath = (id) => '/' + encodeURIComponent(id);
  const body = (method, value) => ({ method, body: JSON.stringify(value) });
  return Object.freeze({
    list: (filters = {}, signal) => request('?' + new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value != null)), { signal }),
    catalogs: () => request('/catalogs'),
    read: (id, signal) => request(idPath(id), { signal }),
    photos: (id, signal) => request(idPath(id) + '/photos', { signal }),
    // Binary assets require the authenticated SDK. The consumer revokes this
    // object URL when the image is replaced or unmounted.
    contentUrl: async (attachmentId, signal) => {
      const response = await sdk.fetchWithAuth(`/api/stir/tenants/${encodeURIComponent(tenantId)}/attachments/${encodeURIComponent(attachmentId)}/content`, { signal });
      if (!response.ok) {
        const error = new Error(`stir.http${response.status}`);
        error.status = response.status;
        throw error;
      }
      return URL.createObjectURL(await response.blob());
    },
    create: (value) => request('', body('POST', value)),
    update: (id, value) => request(idPath(id), body('PUT', value)),
    close: (id, version) => request(idPath(id) + '/close', body('POST', { version })),
    offer: (id, value) => request(idPath(id) + '/offers', body('POST', value)),
  });
}

export function listingPayload(value, editing) {
  const { direction, title, description, category, resourceKind, location, version } = value;
  return {direction,title,description,category,resourceKind,location:location || null,...(value.referenceDefinitionId?{referenceDefinitionId:value.referenceDefinitionId}:{}),...(editing?{version}:{})};
}

export function offerPayload(value) {
  const { message, quantity, unitLabel, proposedAmount, proposedUnitRef, terms } = value;
  return {message,quantity:quantity||null,unitLabel:unitLabel||null,proposedAmount:proposedAmount||null,proposedUnitRef:proposedUnitRef||null,terms:terms||null,...(value.shareReferenceObservation?{shareReferenceObservation:true}:{}),
    // Opaque passthrough only: a distribution that reuses STIR's own offer/counter form still
    // attaches its own frozen external contract commitment without STIR interpreting it.
    ...(value.externalContractNamespace?{externalContractNamespace:value.externalContractNamespace,externalContractDigest:value.externalContractDigest}:{})};
}

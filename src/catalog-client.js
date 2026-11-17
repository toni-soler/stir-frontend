/**
 * STIR catalog consumer contract v1. No Shell registration, React, routing or
 * global state: a distribution supplies the current Shell SDK and tenant.
 * Keep the backend's authorization and tenant checks as the source of truth.
 */
export const CATALOG_CONTRACT_VERSION = 1;

// Additive, version unchanged (STRUCTURED_TERMS_AND_NEEDS.md): listing details, a counterpart-only note, structured offer terms.
export const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'FOR_PARTS'];
export const FULFILMENT_MODES = ['PICKUP', 'DELIVERY', 'PICKUP_OR_DELIVERY', 'ON_SITE', 'REMOTE'];
export const AVAILABILITY = ['AVAILABLE', 'IN_CONVERSATION', 'COMMITTED'];
export const DIMENSIONS = ['TIMING', 'PLACE', 'QUANTITY', 'CONDITION', 'AMOUNT'];
const DETAIL_KEYS = ['itemCondition', 'fulfilmentMode', 'includedItems', 'availableUntil', 'availability', 'neededBy', 'flexibleOn', 'firmOn', 'counterpartNote'];
const TERM_KEYS = ['scope', 'ownerTasks', 'initiatorTasks', 'fulfilmentMode', 'fulfilBy', 'openQuestions', 'validUntil'];
const present = (v) => Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== '';

/** An offer whose validity has passed can no longer be accepted (the server refuses it too). */
export function offerExpired(offer, now = Date.now()) {
  return Boolean(offer?.validUntil) && new Date(offer.validUntil).getTime() < now;
}

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
  return {direction,title,description,category,resourceKind,location:location || null,
    ...(value.referenceDefinitionId?{referenceDefinitionId:value.referenceDefinitionId}:{}),...(editing?{version}:{}),
    // The owner's own ask/want, never "what the market accepts" - opt-in, only meaningful once a
    // reference definition is picked (MULTI_SOURCE_VALUE_EVIDENCE.md).
    ...(value.referenceDefinitionId?{indicativeAmount:value.indicativeAmount||null,indicativeQuantity:value.indicativeQuantity||null,
      indicativeUnitLabel:value.indicativeUnitLabel||null,indicativeUnitRef:value.indicativeUnitRef||null,
      shareReferenceObservation:Boolean(value.shareReferenceObservation)}:{}),
    // Sent when any detail is set, and always when editing so that clearing one is possible. Omitted,
    // the server keeps an existing listing's details.
    ...(editing || DETAIL_KEYS.some(key => present(value[key])) ? { details: listingDetails(value) } : {})};
}

export function listingDetails(value) {
  const text = (v) => present(v) ? String(v).trim() : null;
  const isNeed = value.direction === 'WANTED';
  return {
    itemCondition: value.itemCondition || null, fulfilmentMode: value.fulfilmentMode || null,
    includedItems: text(value.includedItems), availableUntil: value.availableUntil || null,
    availability: value.availability || 'AVAILABLE', neededBy: isNeed ? (value.neededBy || null) : null,
    flexibleOn: isNeed ? (value.flexibleOn || []) : [], firmOn: isNeed ? (value.firmOn || []) : [],
    counterpartNote: text(value.counterpartNote),
  };
}

export function offerPayload(value) {
  const { message, quantity, unitLabel, proposedAmount, proposedUnitRef, terms } = value;
  return {message,quantity:quantity||null,unitLabel:unitLabel||null,proposedAmount:proposedAmount||null,proposedUnitRef:proposedUnitRef||null,terms:terms||null,...(value.shareReferenceObservation?{shareReferenceObservation:true}:{}),
    // Opaque passthrough only: a distribution that reuses STIR's own offer/counter form still
    // attaches its own frozen external contract commitment without STIR interpreting it.
    ...(value.externalContractNamespace?{externalContractNamespace:value.externalContractNamespace,externalContractDigest:value.externalContractDigest}:{}),
    ...(TERM_KEYS.some(key => present(value[key])) ? { structuredTerms: offerTerms(value) } : {})};
}

export function offerTerms(value) {
  const text = (v) => present(v) ? String(v).trim() : null;
  return {
    scope: text(value.scope), ownerTasks: text(value.ownerTasks), initiatorTasks: text(value.initiatorTasks),
    fulfilmentMode: value.fulfilmentMode || null, fulfilBy: value.fulfilBy || null, openQuestions: text(value.openQuestions),
    // datetime-local has no zone: it is the user's local time.
    validUntil: value.validUntil ? new Date(value.validUntil).toISOString() : null,
  };
}

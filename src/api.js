function apiClient(sdk, tenantId, resource) {
  if (!tenantId || sdk.demo) throw new Error('stir.realSessionRequired');
  const base = `/api/stir/tenants/${encodeURIComponent(tenantId)}${resource}`;
  const request = async (suffix = '', options = {}) => {
    const response = await sdk.fetchWithAuth(base + suffix, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(`stir.http${response.status}`); error.status = response.status; throw error; }
    return data;
  };
  return { base, request };
}
const body = (method, value) => ({ method, body: JSON.stringify(value) });
const query = (filters) => '?' + new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== '' && v != null));

export function listingApi(sdk, tenantId) {
  const { request } = apiClient(sdk, tenantId, '/listings');
  return {
    list: (filters, signal) => request(query(filters), { signal }),
    catalogs: () => request('/catalogs'),
    read: (id) => request('/' + encodeURIComponent(id)),
    create: (value) => request('', body('POST', value)),
    update: (id, value) => request('/' + encodeURIComponent(id), body('PUT', value)),
    close: (id, version) => request('/' + encodeURIComponent(id) + '/close', body('POST', { version })),
    offer: (listingId, value) => request('/' + encodeURIComponent(listingId) + '/offers', body('POST', value)),
  };
}
export function listingPayload(value, editing) {
  const { direction, title, description, category, resourceKind, location, version } = value;
  return {direction,title,description,category,resourceKind,location:location || null,...(editing?{version}:{})};
}

export function participantApi(sdk, tenantId) {
  const { request } = apiClient(sdk, tenantId, '/participants');
  return {
    me: () => request('/me'),
    updateMe: (value) => request('/me', body('PUT', value)),
    view: (userId) => request('/' + encodeURIComponent(userId)),
  };
}

export function negotiationApi(sdk, tenantId) {
  const { request } = apiClient(sdk, tenantId, '/negotiations');
  return {
    list: (filters, signal) => request(query(filters), { signal }),
    read: (id) => request('/' + encodeURIComponent(id)),
    counter: (id, value) => request('/' + encodeURIComponent(id) + '/offers', body('POST', value)),
    accept: (id, offerId, expectedVersion) => request('/' + encodeURIComponent(id) + '/accept', body('POST', { offerId, expectedVersion })),
    decline: (id, expectedVersion) => request('/' + encodeURIComponent(id) + '/decline', body('POST', { expectedVersion })),
  };
}

export function agreementApi(sdk, tenantId) {
  const { request } = apiClient(sdk, tenantId, '/agreements');
  return {
    list: (filters, signal) => request(query(filters), { signal }),
    read: (id) => request('/' + encodeURIComponent(id)),
  };
}

export function offerPayload(value) {
  const { message, quantity, unitLabel, proposedAmount, proposedUnitRef, terms } = value;
  return {message,quantity:quantity||null,unitLabel:unitLabel||null,proposedAmount:proposedAmount||null,proposedUnitRef:proposedUnitRef||null,terms:terms||null};
}

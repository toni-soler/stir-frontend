export function listingApi(sdk, tenantId) {
  if (!tenantId || sdk.demo) throw new Error('stir.realSessionRequired');
  const base = `/api/stir/tenants/${encodeURIComponent(tenantId)}/listings`;
  const request = async (suffix = '', options = {}) => {
    const response = await sdk.fetchWithAuth(base + suffix, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(`stir.http${response.status}`); error.status = response.status; throw error; }
    return data;
  };
  const body = (method, value) => ({method,body:JSON.stringify(value)});
  return {
    list: (filters, signal) => request('?' + new URLSearchParams(Object.entries(filters).filter(([,v])=>v!=='' && v!=null)), {signal}),
    catalogs: () => request('/catalogs'),
    read: (id) => request('/' + encodeURIComponent(id)),
    create: (value) => request('', body('POST', value)),
    update: (id, value) => request('/' + encodeURIComponent(id), body('PUT', value)),
    close: (id, version) => request('/' + encodeURIComponent(id) + '/close', body('POST', {version})),
  };
}

export function listingPayload(value, editing) {
  const { direction, title, description, category, resourceKind, location, version } = value;
  return {direction,title,description,category,resourceKind,location:location || null,...(editing?{version}:{})};
}

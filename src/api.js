// TradeService.commit() (and other osTRIS-relayed failures) format their reason as "CODE: detail"
// (see StirOstrisException) - surface that CODE as a distinct, translatable error key
// (stir.errorCODE) instead of collapsing every failure of the same HTTP status into one generic
// "stir.http422" message. Section 13 of the 0.4 brief: a credit-floor rejection must read as "this
// exceeds your credit limit", never "HTTP 422".
function httpError(status, data) {
  const rawMessage = data && typeof data.message === 'string' ? data.message : '';
  const match = /^([A-Z_]+): /.exec(rawMessage);
  const error = new Error(match ? `stir.error${match[1]}` : `stir.http${status}`);
  error.status = status;
  error.detail = rawMessage;
  return error;
}

function apiClient(sdk, tenantId, resource) {
  if (!tenantId || sdk.demo) throw new Error('stir.realSessionRequired');
  const base = `/api/stir/tenants/${encodeURIComponent(tenantId)}${resource}`;
  const request = async (suffix = '', options = {}) => {
    const response = await sdk.fetchWithAuth(base + suffix, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
    // A 200 with an empty body (e.g. TradeService.find() when no trade exists yet) is a real,
    // meaningful `null` - not `{}`. Falling back to `{}` here would hide that distinction from
    // every caller that checks `=== null` (TradeStatus does, to decide whether to show "activate").
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw httpError(response.status, data);
    return data;
  };
  // No Content-Type here: the browser sets multipart/form-data with the correct boundary itself
  // only when it builds the request body, which it does not do if we set the header manually.
  const upload = async (suffix, file) => {
    const form = new FormData();
    form.append('file', file);
    const response = await sdk.fetchWithAuth(base + suffix, { method: 'POST', body: form });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw httpError(response.status, data);
    return data;
  };
  // Authenticated binary GET (an <img src> cannot carry a bearer token itself): fetch the bytes and
  // hand back a local object URL. Callers must revokeObjectURL it when done (see AttachmentImage).
  const contentUrl = async (suffix) => {
    const response = await sdk.fetchWithAuth(base + suffix);
    if (!response.ok) { const error = new Error(`stir.http${response.status}`); error.status = response.status; throw error; }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };
  return { base, request, upload, contentUrl };
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
  return {direction,title,description,category,resourceKind,location:location || null,...(value.referenceDefinitionId?{referenceDefinitionId:value.referenceDefinitionId}:{}),...(editing?{version}:{})};
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
    accept: (id, offerId, expectedVersion, shareReferenceObservation=false) => request('/' + encodeURIComponent(id) + '/accept', body('POST', { offerId, expectedVersion, ...(shareReferenceObservation?{shareReferenceObservation:true}:{}) })),
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
  return {message,quantity:quantity||null,unitLabel:unitLabel||null,proposedAmount:proposedAmount||null,proposedUnitRef:proposedUnitRef||null,terms:terms||null,...(value.shareReferenceObservation?{shareReferenceObservation:true}:{})};
}

export function economicApi(sdk, tenantId) {
  const { request } = apiClient(sdk, tenantId, '/economic');
  return {
    marketplace: () => request('/marketplace'),
    bootstrapMarketplace: (value) => request('/marketplace/bootstrap', body('POST', value)),
    me: () => request('/me'),
    activate: (publicKeyBase64url) => request('/activate', body('POST', { publicKeyBase64url })),
  };
}

export function deviceApi(sdk, tenantId) {
  const { request } = apiClient(sdk, tenantId, '/economic/devices');
  return {
    list: () => request(''),
    add: (label, publicKeyBase64url) => request('', body('POST', { label, publicKeyBase64url })),
    revoke: (credentialId) => request('/' + encodeURIComponent(credentialId) + '/revoke', body('POST')),
  };
}

export function attachmentApi(sdk, tenantId) {
  const { request, upload, contentUrl } = apiClient(sdk, tenantId, '');
  return {
    listingPhotos: (listingId) => request('/listings/' + encodeURIComponent(listingId) + '/photos'),
    uploadListingPhoto: (listingId, file) => upload('/listings/' + encodeURIComponent(listingId) + '/photos', file),
    uploadAvatar: (file) => upload('/participants/me/avatar', file),
    remove: (attachmentId) => request('/attachments/' + encodeURIComponent(attachmentId), { method: 'DELETE' }),
    contentUrl: (attachmentId) => contentUrl('/attachments/' + encodeURIComponent(attachmentId) + '/content'),
  };
}

export function notificationApi(sdk, tenantId) {
  const { request } = apiClient(sdk, tenantId, '/notifications');
  return {
    list: (page = 0, size = 20) => request(query({ page, size })),
    unreadCount: () => request('/unread-count'),
    markRead: (id) => request('/' + encodeURIComponent(id) + '/read', body('POST')),
  };
}

export function moderationApi(sdk, tenantId) {
  const { request } = apiClient(sdk, tenantId, '');
  return {
    report: (targetType, targetId, reason) => request('/reports', body('POST', { targetType, targetId, reason })),
    canModerate: () => request('/moderation/access').then(() => true).catch(() => false),
    openReports: (page = 0, size = 20) => request('/moderation/reports' + query({ page, size })),
    dismiss: (reportId) => request('/moderation/reports/' + encodeURIComponent(reportId) + '/dismiss', body('POST')),
    hide: (reportId) => request('/moderation/reports/' + encodeURIComponent(reportId) + '/hide', body('POST')),
    restoreListing: (listingId) => request('/moderation/listings/' + encodeURIComponent(listingId) + '/restore', body('POST')),
  };
}

/** No tenant, no auth: public instance branding, readable before login. */
export function instanceApi(sdk) {
  return { get: async () => {
    const response = await sdk.fetchWithAuth('/api/stir/instance');
    if (!response.ok) throw new Error('stir.http' + response.status);
    return response.json();
  } };
}

export function tradeApi(sdk, tenantId) {
  const { request } = apiClient(sdk, tenantId, '/agreements');
  const base = (agreementId) => '/' + encodeURIComponent(agreementId) + '/trade';
  return {
    find: (agreementId) => request(base(agreementId)),
    signingPayload: (agreementId) => request(base(agreementId) + '/signing-payload'),
    activate: (agreementId) => request(base(agreementId) + '/activate', body('POST')),
    authorize: (agreementId, credentialId, signatureBase64url) => request(base(agreementId) + '/authorizations', body('POST', { credentialId, signatureBase64url })),
    commit: (agreementId) => request(base(agreementId) + '/commit', body('POST')),
    sync: (agreementId) => request(base(agreementId) + '/sync', body('POST')),
  };
}

export function referenceApi(sdk,tenantId) {
  const {request}=apiClient(sdk,tenantId,'/references');
  return {list:()=>request(),create:r=>request('',body('POST',r)),view:id=>request('/'+encodeURIComponent(id)),
    community:()=>request('/community'),
    history:id=>request('/'+encodeURIComponent(id)+'/history'),proposals:id=>request('/'+encodeURIComponent(id)+'/proposals'),
    propose:(id,r)=>request('/'+encodeURIComponent(id)+'/proposals',body('POST',r)),
    publish:(id,decision)=>request('/proposals/'+encodeURIComponent(id)+'/publish',body('POST',{decision})),
    canPublish:()=>request('/publish-access').then(()=>true).catch(()=>false),
    context:id=>request('/agreements/'+encodeURIComponent(id)+'/context'),
    observations:id=>request('/'+encodeURIComponent(id)+'/observations'),
    evidenceManifest:id=>request('/'+encodeURIComponent(id)+'/evidence-manifest'),
    policy:(id,r)=>request('/'+encodeURIComponent(id)+'/policies',body('POST',r))};
}
export function integrityApi(sdk,tenantId) {
  const {request}=apiClient(sdk,tenantId,'/references/integrity');
  return {
    signal:r=>request('/signals',body('POST',r)),
    decide:(caseId,r)=>request('/cases/'+encodeURIComponent(caseId)+'/decisions',body('POST',r)),
    cases:definitionId=>request('/definitions/'+encodeURIComponent(definitionId)+'/cases'),
    history:caseId=>request('/cases/'+encodeURIComponent(caseId)+'/history')};
}
export function marketGovernanceApi(sdk,tenantId) {
  const {request}=apiClient(sdk,tenantId,'/references/governance');
  return {
    view:id=>request('/'+encodeURIComponent(id)),
    events:id=>request('/'+encodeURIComponent(id)+'/events'),
    audit:id=>request('/'+encodeURIComponent(id)+'/audit'),
    proposals:id=>request('/'+encodeURIComponent(id)+'/proposals'),
    credentials:id=>request('/'+encodeURIComponent(id)+'/credentials'),
    bootstrap:r=>request('/bootstrap',body('POST',r)),
    propose:(community,r)=>request('/'+encodeURIComponent(community)+'/proposals',body('POST',r)),
    proposal:id=>request('/proposals/'+encodeURIComponent(id)),
    signingPayload:id=>request('/proposals/'+encodeURIComponent(id)+'/signing-payload'),
    sign:(id,r)=>request('/proposals/'+encodeURIComponent(id)+'/signatures',body('POST',r)),
    activate:(id,r)=>request('/proposals/'+encodeURIComponent(id)+'/activate',body('POST',r||{})),
    suspend:(community,r)=>request('/'+encodeURIComponent(community)+'/emergency-suspensions',body('POST',r)),
  };
}

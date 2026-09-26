import { ReferencePanel, ReferenceConsent } from './references.jsx';
import { attachmentApi } from './api.js';
import { createCatalogClient, offerPayload } from './catalog-client.js';
import { AttachmentImage } from './attachments.jsx';
import { ReportButton } from './moderation.jsx';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

function PhotoGallery({ sdk, listingId, title }) {
  const api = useMemo(() => attachmentApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [photos, setPhotos] = useState([]);
  useEffect(() => { api.listingPhotos(listingId).then(setPhotos).catch(() => {}); }, [listingId]);
  if (!photos.length) return null;
  return <div className="stir-gallery">{photos.map((p, i) => <AttachmentImage key={p.id} sdk={sdk} attachmentId={p.id} alt={`${title} - ${i + 1}/${photos.length}`} />)}</div>;
}

function OfferForm({ sdk, definitionId, t, busy, error, onSubmit }) {
  const [value, setValue] = useState({ message: '', quantity: '', unitLabel: '', proposedAmount: '', proposedUnitRef: '', terms: '' });
  const change = (key, next) => setValue(current => ({ ...current, [key]: next }));
  return <form className="stir-form" onSubmit={e => { e.preventDefault(); onSubmit(offerPayload(value)); }}>
    <label className="stir-wide">{t('offerMessage')}<textarea required maxLength={2000} rows={3} value={value.message} onChange={e => change('message', e.target.value)} /></label>
    <label>{t('offerQuantity')}<input type="number" min="0" step="any" value={value.quantity} onChange={e => change('quantity', e.target.value)} /></label>
    <label>{t('offerUnitLabel')}<input maxLength={40} value={value.unitLabel} onChange={e => change('unitLabel', e.target.value)} /></label>
    <label>{t('offerProposedAmount')}<input type="number" min="0" step="any" value={value.proposedAmount} onChange={e => change('proposedAmount', e.target.value)} /></label>
    <label>{t('offerProposedUnitRef')}<input maxLength={60} value={value.proposedUnitRef} onChange={e => change('proposedUnitRef', e.target.value)} /></label>
    <label className="stir-wide">{t('offerTerms')}<textarea maxLength={2000} rows={2} value={value.terms} onChange={e => change('terms', e.target.value)} /></label>
    {definitionId&&<><ReferencePanel sdk={sdk} t={t} definitionId={definitionId} offer={value} onDefinition={d=>setValue(current=>({...current,quantity:current.quantity||String(d.quantity_basis),unitLabel:current.unitLabel||d.quantity_unit,proposedUnitRef:current.proposedUnitRef||d.unit_ref}))}/><ReferenceConsent t={t} value={value.shareReferenceObservation} onChange={v=>change('shareReferenceObservation',v)}/></>}
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    <div className="stir-actions stir-wide"><button disabled={busy} type="submit">{t(busy ? 'sending' : 'sendOffer')}</button></div>
  </form>;
}

export function ListingDetail({ sdk, t, id, navigate }) {
  const api = useMemo(() => createCatalogClient(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offering, setOffering] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLoading(true); setError(''); api.read(id).then(setListing).catch(e => setError(e.message)).finally(() => setLoading(false)); }, [id]);
  const submitOffer = async (payload) => {
    setBusy(true); setError('');
    try { const negotiation = await api.offer(id, payload); navigate('/stir/negotiations/' + negotiation.id); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  // Editing/closing your own listing used to only be reachable from "Mine" - viewing your own
  // listing's own detail page had no way to act on it at all, forcing a detour back to the
  // marketplace list to find the same card again. "Mine" still owns the actual edit form, so
  // this hands off to it with the listing id it should open, rather than duplicating the form.
  const closeListing = async () => {
    if (!window.confirm(t('confirmClose'))) return;
    setBusy(true); setError('');
    try { await api.close(listing.id, listing.version); setListing(await api.read(id)); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  if (loading) return <p role="status">{t('loading')}</p>;
  if (error && !listing) return <p role="alert">{t(error.replace('stir.', ''))}</p>;
  const own = listing.ownerId === sdk.user?.id;
  return <section className="stir-panel">
    <span className={'stir-badge ' + listing.direction}>{t(listing.direction)}</span>
    {listing.hidden && <p role="alert">{t('listingHiddenNotice')}</p>}
    <h2>{listing.title}</h2>
    <ReferencePanel sdk={sdk} t={t} definitionId={listing.referenceDefinitionId}/>
    <PhotoGallery sdk={sdk} listingId={listing.id} title={listing.title} />
    <p>
      {t('listingBy')} <button type="button" className="stir-link" onClick={() => navigate('/stir/participants/' + listing.ownerId)}>{listing.ownerDisplayName || t('unknownParticipant')}</button>
    </p>
    <small>{t(listing.resourceKind)} · {t(listing.category)}</small>
    <p className="stir-description">{listing.description}</p>
    {listing.location && <p>⌖ {listing.location}</p>}
    <p>{t('status')}: {t(listing.status)}</p>
    {!own && listing.status === 'ACTIVE' && !offering && <button onClick={() => setOffering(true)}>{t('makeOffer')}</button>}
    {!own && listing.status === 'ACTIVE' && offering && <OfferForm sdk={sdk} definitionId={listing.referenceDefinitionId} t={t} busy={busy} error={error} onSubmit={submitOffer} />}
    {own && <p>{t('ownListingHint')}</p>}
    {own && listing.status === 'ACTIVE' && <div className="stir-actions">
      <button disabled={busy} onClick={() => navigate('/stir/mine?edit=' + listing.id)}>{t('edit')}</button>
      <button disabled={busy} className="secondary" onClick={closeListing}>{t('close')}</button>
    </div>}
    {!own && <ReportButton sdk={sdk} t={t} targetType="LISTING" targetId={listing.id} />}
  </section>;
}

import { listingApi, offerPayload } from './api.js';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

function OfferForm({ t, busy, error, onSubmit }) {
  const [value, setValue] = useState({ message: '', quantity: '', unitLabel: '', proposedAmount: '', proposedUnitRef: '', terms: '' });
  const change = (key, next) => setValue(current => ({ ...current, [key]: next }));
  return <form className="stir-form" onSubmit={e => { e.preventDefault(); onSubmit(offerPayload(value)); }}>
    <label className="stir-wide">{t('offerMessage')}<textarea required maxLength={2000} rows={3} value={value.message} onChange={e => change('message', e.target.value)} /></label>
    <label>{t('offerQuantity')}<input type="number" min="0" step="any" value={value.quantity} onChange={e => change('quantity', e.target.value)} /></label>
    <label>{t('offerUnitLabel')}<input maxLength={40} value={value.unitLabel} onChange={e => change('unitLabel', e.target.value)} /></label>
    <label>{t('offerProposedAmount')}<input type="number" min="0" step="any" value={value.proposedAmount} onChange={e => change('proposedAmount', e.target.value)} /></label>
    <label>{t('offerProposedUnitRef')}<input maxLength={60} value={value.proposedUnitRef} onChange={e => change('proposedUnitRef', e.target.value)} /></label>
    <label className="stir-wide">{t('offerTerms')}<textarea maxLength={2000} rows={2} value={value.terms} onChange={e => change('terms', e.target.value)} /></label>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    <div className="stir-actions stir-wide"><button disabled={busy} type="submit">{t(busy ? 'sending' : 'sendOffer')}</button></div>
  </form>;
}

export function ListingDetail({ sdk, t, id, navigate }) {
  const api = useMemo(() => listingApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
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
  if (loading) return <p role="status">{t('loading')}</p>;
  if (error && !listing) return <p role="alert">{t(error.replace('stir.', ''))}</p>;
  const own = listing.ownerId === sdk.user?.id;
  return <section className="stir-panel">
    <span className={'stir-badge ' + listing.direction}>{t(listing.direction)}</span>
    <h2>{listing.title}</h2>
    <p>
      {t('listingBy')} <button type="button" className="stir-link" onClick={() => navigate('/stir/participants/' + listing.ownerId)}>{listing.ownerDisplayName || t('unknownParticipant')}</button>
    </p>
    <small>{t(listing.resourceKind)} · {t(listing.category)}</small>
    <p className="stir-description">{listing.description}</p>
    {listing.location && <p>⌖ {listing.location}</p>}
    <p>{t('status')}: {t(listing.status)}</p>
    {!own && listing.status === 'ACTIVE' && !offering && <button onClick={() => setOffering(true)}>{t('makeOffer')}</button>}
    {!own && listing.status === 'ACTIVE' && offering && <OfferForm t={t} busy={busy} error={error} onSubmit={submitOffer} />}
    {own && <p>{t('ownListingHint')}</p>}
  </section>;
}

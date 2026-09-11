import { negotiationApi, participantApi, listingApi, offerPayload } from './api.js';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

function OfferThreadItem({ t, offer, isMine, otherPartyName }) {
  return <article className={'stir-offer ' + offer.status}>
    <header><strong>{isMine ? t('you') : otherPartyName}</strong><span className={'stir-badge ' + offer.status}>{t('offerStatus' + offer.status)}</span></header>
    <p>{offer.message}</p>
    {(offer.quantity || offer.unitLabel) && <p>{t('offerQuantity')}: {offer.quantity ?? ''} {offer.unitLabel || ''}</p>}
    {(offer.proposedAmount || offer.proposedUnitRef) && <p>{t('offerProposedAmount')}: {offer.proposedAmount ?? ''} {offer.proposedUnitRef || ''}</p>}
    {offer.terms && <p><em>{offer.terms}</em></p>}
  </article>;
}

function CounterForm({ t, busy, error, onSubmit }) {
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
    <div className="stir-actions stir-wide"><button disabled={busy} type="submit">{t(busy ? 'sending' : 'sendCounter')}</button></div>
  </form>;
}

export function NegotiationList({ sdk, t, navigate }) {
  const api = useMemo(() => negotiationApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState({ content: [], totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    setLoading(true); setError('');
    api.list({ status, page: 0, size: 50 }).then(setResult).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [status]);
  return <section>
    <h2>{t('myNegotiations')}</h2>
    <form className="stir-filters" onSubmit={e => e.preventDefault()}>
      <label>{t('status')}<select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">{t('all')}</option><option value="OPEN">{t('OPEN')}</option><option value="ACCEPTED">{t('ACCEPTED')}</option><option value="DECLINED">{t('DECLINED')}</option>
      </select></label>
    </form>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    {loading ? <p role="status">{t('loading')}</p> : <section className="stir-grid">
      {result.content.map(row => <article className="stir-card" key={row.id}>
        <span className={'stir-badge ' + row.status}>{t(row.status)}</span>
        <small>{new Date(row.updatedAt).toLocaleString()}</small>
        <footer><button onClick={() => navigate('/stir/negotiations/' + row.id)}>{t('view')}</button></footer>
      </article>)}
      {!result.content.length && <p>{t('emptyNegotiations')}</p>}
    </section>}
  </section>;
}

export function NegotiationDetail({ sdk, t, id, navigate }) {
  const negotiations = useMemo(() => negotiationApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const participants = useMemo(() => participantApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const listings = useMemo(() => listingApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [negotiation, setNegotiation] = useState(null);
  const [listing, setListing] = useState(null);
  const [otherPartyName, setOtherPartyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [countering, setCountering] = useState(false);
  const [revision, setRevision] = useState(0);
  const userId = sdk.user?.id;

  useEffect(() => {
    setLoading(true); setError('');
    negotiations.read(id).then(async found => {
      setNegotiation(found); setCountering(false);
      const otherParty = found.initiatorId === userId ? found.ownerId : found.initiatorId;
      listings.read(found.listingId).then(setListing).catch(() => {});
      participants.view(otherParty).then(p => setOtherPartyName(p.displayName)).catch(() => setOtherPartyName(t('unknownParticipant')));
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [id, revision]);

  if (loading) return <p role="status">{t('loading')}</p>;
  if (error && !negotiation) return <p role="alert">{t(error.replace('stir.', ''))}</p>;

  const head = negotiation.offers[negotiation.offers.length - 1];
  const myTurn = negotiation.status === 'OPEN' && head.authorId !== userId;

  const act = async (action) => {
    setBusy(true); setError('');
    try {
      if (action.type === 'accept') { const agreement = await negotiations.accept(id, head.id, negotiation.version); navigate('/stir/agreements/' + agreement.id); return; }
      if (action.type === 'decline') { await negotiations.decline(id, negotiation.version); setRevision(n => n + 1); return; }
      if (action.type === 'counter') { await negotiations.counter(id, { ...action.payload, expectedVersion: negotiation.version }); setRevision(n => n + 1); return; }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return <section className="stir-panel">
    {listing && <p><button type="button" className="stir-link" onClick={() => navigate('/stir/listing/' + listing.id)}>{listing.title}</button></p>}
    <span className={'stir-badge ' + negotiation.status}>{t(negotiation.status)}</span>
    <div className="stir-thread">
      {negotiation.offers.map(offer => <OfferThreadItem key={offer.id} t={t} offer={offer} isMine={offer.authorId === userId} otherPartyName={otherPartyName} />)}
    </div>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    {negotiation.status === 'OPEN' && !myTurn && <p>{t('waitingForOtherParty')}</p>}
    {negotiation.status === 'OPEN' && myTurn && !countering && <div className="stir-actions">
      <button disabled={busy} onClick={() => act({ type: 'accept' })}>{t('accept')}</button>
      <button disabled={busy} className="secondary" onClick={() => setCountering(true)}>{t('counter')}</button>
    </div>}
    {negotiation.status === 'OPEN' && countering && <CounterForm t={t} busy={busy} error="" onSubmit={payload => act({ type: 'counter', payload })} />}
    {negotiation.status === 'OPEN' && <div className="stir-actions"><button disabled={busy} className="secondary" onClick={() => act({ type: 'decline' })}>{t('decline')}</button></div>}
    {negotiation.status === 'ACCEPTED' && negotiation.agreementId && <button onClick={() => navigate('/stir/agreements/' + negotiation.agreementId)}>{t('viewAgreement')}</button>}
  </section>;
}

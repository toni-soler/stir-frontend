// A second Shell extension using STIR's public catalog consumer entry. This
// intentionally owns its presentation and leaves negotiation to STIR.
import { createCatalogClient, offerPayload } from '../../dist/community/stir-catalog.mjs';
import bundles from '../../src/locales.json';
import './style.css';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useMemo, useState } = React;
Object.entries(bundles).forEach(([locale, bundle]) => window.__IDAX_MODULE_SDK__.i18n.addResourceBundle(locale, 'translation', { stir: bundle }));

function CommunityCatalog() {
  const sdk = window.__IDAX_MODULE_SDK__;
  const { useLocation, useNavigate } = sdk.router;
  const location = useLocation();
  const navigate = useNavigate();
  const t = (key) => sdk.i18n.t('stir.' + key, bundles.en[key] || bundles.en.error);
  const client = useMemo(() => sdk.demo || !sdk.activeTenantId ? null : createCatalogClient(sdk, sdk.activeTenantId), [sdk.activeTenantId, sdk.demo]);
  const detailId = location.pathname.startsWith('/community-catalog/listing/')
    ? decodeURIComponent(location.pathname.slice('/community-catalog/listing/'.length)) : null;
  const [rows, setRows] = useState([]);
  const [listing, setListing] = useState(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!client) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setListing(null);
    const pending = detailId ? client.read(detailId, controller.signal).then(setListing)
      : client.list({ q: query, status: 'ACTIVE', page: 0, size: 20 }, controller.signal).then(result => setRows(result.content));
    pending.catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [client, detailId, query]);

  const sendOffer = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const negotiation = await client.offer(listing.id, offerPayload({ message }));
      navigate('/stir/negotiations/' + negotiation.id);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!client) return <main className="community-catalog"><p role="alert">{t('realSessionRequired')}</p></main>;
  return <main className="community-catalog">
    <header><strong>{t('marketplace')}</strong><nav><button onClick={() => navigate('/community-catalog')}>{t('backToMarketplace')}</button><button onClick={() => navigate('/stir/negotiations')}>{t('myNegotiations')}</button></nav></header>
    {detailId ? <>
      {loading && <p role="status">{t('loading')}</p>}
      {listing && <article className="community-detail">
        <small>{t(listing.direction)} · {t(listing.resourceKind)}</small>
        <h1>{listing.title}</h1>
        <p>{listing.description}</p>
        {listing.location && <p>{listing.location}</p>}
        <p>{t('status')}: {t(listing.status)}</p>
        {listing.hidden && <p role="alert">{t('listingHiddenNotice')}</p>}
        {listing.ownerId !== sdk.user?.id && listing.status === 'ACTIVE' && !listing.hidden && <form onSubmit={sendOffer}>
          <label>{t('offerMessage')}<textarea required maxLength={2000} value={message} onChange={e => setMessage(e.target.value)} /></label>
          <button disabled={busy} type="submit">{t(busy ? 'sending' : 'sendOffer')}</button>
        </form>}
      </article>}
    </> : <>
      <h1>{t('headline')}</h1>
      <label>{t('search')}<input value={query} maxLength={160} onChange={e => setQuery(e.target.value)} /></label>
      {loading ? <p role="status">{t('loading')}</p> : <div className="community-grid">{rows.map(row => <article key={row.id}>
        <small>{t(row.direction)} · {t(row.category)}</small>
        <h2><button onClick={() => navigate('/community-catalog/listing/' + encodeURIComponent(row.id))}>{row.title}</button></h2>
        <p>{row.description}</p>
      </article>)}{!rows.length && <p>{t('empty')}</p>}</div>}
    </>}
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
  </main>;
}

window.__IDAX_MODULE_EXTENSIONS__ ||= {};
window.__IDAX_MODULE_EXTENSIONS__['community-catalog'] = { component: CommunityCatalog };
window.dispatchEvent(new CustomEvent('idaxModuleExtensionRegistered', { detail: { module: 'community-catalog' } }));

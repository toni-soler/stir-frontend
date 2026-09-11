import { agreementApi } from './api.js';
import { TradeStatus } from './trade.jsx';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

export function AgreementList({ sdk, t, navigate }) {
  const api = useMemo(() => agreementApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [result, setResult] = useState({ content: [], totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { api.list({ page: 0, size: 50 }).then(setResult).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  if (loading) return <p role="status">{t('loading')}</p>;
  return <section>
    <h2>{t('myAgreements')}</h2>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    <section className="stir-grid">
      {result.content.map(row => <article className="stir-card" key={row.id}>
        <span className="stir-badge">{t('economicPhase' + row.economicPhase)}</span>
        <small>{new Date(row.createdAt).toLocaleString()}</small>
        <footer><button onClick={() => navigate('/stir/agreements/' + row.id)}>{t('view')}</button></footer>
      </article>)}
      {!result.content.length && <p>{t('emptyAgreements')}</p>}
    </section>
  </section>;
}

export function AgreementDetail({ sdk, t, id, navigate }) {
  const api = useMemo(() => agreementApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { setLoading(true); setError(''); api.read(id).then(setAgreement).catch(e => setError(e.message)).finally(() => setLoading(false)); }, [id]);
  if (loading) return <p role="status">{t('loading')}</p>;
  if (error) return <p role="alert">{t(error.replace('stir.', ''))}</p>;
  return <section className="stir-panel">
    <h2>{t('agreement')}</h2>
    <span className="stir-badge">{t('economicPhase' + agreement.economicPhase)}</span>
    <p>{t('agreementCreatedAt')}: {new Date(agreement.createdAt).toLocaleString()}</p>
    <button type="button" className="stir-link" onClick={() => navigate('/stir/listing/' + agreement.listingId)}>{t('viewListing')}</button>
    <h3>{t('economicExecution')}</h3>
    <TradeStatus sdk={sdk} t={t} agreementId={agreement.id} economicPhase={agreement.economicPhase} navigate={navigate} />
    <h3>{t('agreementSnapshot')}</h3>
    <p>{t('snapshotDigest')}: <code>{agreement.snapshot.digestSha256}</code></p>
    <p>{t('snapshotSchemaVersion')}: {agreement.snapshot.schemaVersion}</p>
    <details><summary>{t('snapshotCanonicalJson')}</summary><pre className="stir-description">{agreement.snapshot.canonicalJson}</pre></details>
  </section>;
}

import { listingApi, negotiationApi, agreementApi, economicApi, notificationApi } from './api.js';
import { ListingThumbnail } from './attachments.jsx';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

/** "Do I have anything that needs my attention?" - answered with plain counts/links built from
 * APIs that already exist; no new aggregation endpoint, no recommendation engine. */
export function Home({ sdk, t, navigate }) {
  const listings = useMemo(() => listingApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const negotiations = useMemo(() => negotiationApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const agreements = useMemo(() => agreementApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const economic = useMemo(() => economicApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const notifications = useMemo(() => notificationApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      listings.list({ mine: true, status: 'ACTIVE', page: 0, size: 5 }),
      listings.list({ page: 0, size: 6 }),
      negotiations.list({ status: 'OPEN', page: 0, size: 50 }),
      agreements.list({ page: 0, size: 50 }),
      economic.marketplace().then((m) => economic.me().then((me) => ({ marketplace: m, me })).catch(() => ({ marketplace: m, me: null }))).catch(() => null),
      notifications.list(0, 5),
      notifications.unreadCount(),
    ]).then(([mine, recent, openNegotiations, myAgreements, economicState, recentNotifications, unread]) => {
      setData({ mine, recent, openNegotiations, myAgreements, economicState, recentNotifications, unread: unread.count });
    }).catch((e) => setError(e.message));
  }, [sdk.activeTenantId]);

  if (error) return <section className="stir-panel"><p role="alert">{t(error.replace('stir.', ''))}</p></section>;
  if (!data) return <p role="status">{t('loading')}</p>;

  const needsSignature = data.myAgreements.content.filter((a) => a.economicPhase === 'AWAITING_SIGNATURES');
  const awaitingExecution = data.myAgreements.content.filter((a) => a.economicPhase === 'AWAITING_ECONOMIC_EXECUTION');
  const attentionCount = needsSignature.length + data.unread;

  return <section className="stir-home">
    <section className="stir-panel stir-welcome">
      <h2>{t(attentionCount > 0 ? 'homeAttentionNeeded' : 'homeAllCaughtUp')}</h2>
      {attentionCount === 0 && <p>{t('homeAllCaughtUpDetail')}</p>}
    </section>

    {!data.economicState?.me && <section className="stir-panel stir-callout">
      <p>{t('homeActivateEconomicPrompt')}</p>
      <button onClick={() => navigate('/stir/economic')}>{t('economicActivation')}</button>
    </section>}

    {needsSignature.length > 0 && <section className="stir-panel">
      <h3>{t('homeSignatureNeeded')}</h3>
      <ul className="stir-list">{needsSignature.map((a) => <li key={a.id}>
        <button className="stir-link" onClick={() => navigate('/stir/agreements/' + a.id)}>{t('agreement')} - {new Date(a.createdAt).toLocaleDateString()}</button>
      </li>)}</ul>
    </section>}

    {data.economicState?.me && <section className="stir-panel">
      <h3>{t('balance')}</h3>
      <p><strong>{data.economicState.me.balanceProjection} {data.economicState.marketplace.unitCode}</strong></p>
      <button className="stir-link" onClick={() => navigate('/stir/economic')}>{t('viewMyBalance')}</button>
    </section>}

    <section className="stir-panel">
      <h3>{t('homeRecentActivity')}</h3>
      {data.recentNotifications.content.length === 0 ? <p>{t('notificationsEmpty')}</p> : <ul className="stir-list">
        {data.recentNotifications.content.map((n) => <li key={n.id} className={n.read ? '' : 'stir-unread'}>
          <button className="stir-link" onClick={() => navigate(n.referenceType === 'AGREEMENT' ? '/stir/agreements/' + n.referenceId : '/stir/negotiations/' + n.referenceId)}>
            {t('notificationType' + n.type)}
          </button> <small>{new Date(n.createdAt).toLocaleString()}</small>
        </li>)}
      </ul>}
      <button className="stir-link" onClick={() => navigate('/stir/notifications')}>{t('viewAllNotifications')}</button>
    </section>

    <section className="stir-panel">
      <h3>{t('homeOpenNegotiations')}: {data.openNegotiations.totalElements ?? data.openNegotiations.content.length}</h3>
      <button className="stir-link" onClick={() => navigate('/stir/negotiations')}>{t('myNegotiations')}</button>
    </section>

    {awaitingExecution.length > 0 && <section className="stir-panel">
      <h3>{t('homePendingExecution')}: {awaitingExecution.length}</h3>
      <button className="stir-link" onClick={() => navigate('/stir/agreements')}>{t('myAgreements')}</button>
    </section>}

    <section className="stir-panel">
      <h3>{t('homeMyActiveListings')}</h3>
      {data.mine.content.length === 0 ? <p>{t('empty')}</p> : <section className="stir-grid">
        {data.mine.content.map((row) => <article className="stir-card" key={row.id}>
          <ListingThumbnail sdk={sdk} attachmentId={row.mainPhotoId} alt={row.title} />
          <span className={'stir-badge ' + row.direction}>{t(row.direction)}</span>
          <h4><button type="button" className="stir-link" onClick={() => navigate('/stir/listing/' + row.id)}>{row.title}</button></h4>
        </article>)}
      </section>}
      <button className="stir-link" onClick={() => navigate('/stir')}>{t('mine')}</button>
    </section>

    <section className="stir-panel">
      <h3>{t('homeExplore')}</h3>
      <section className="stir-grid">
        {data.recent.content.map((row) => <article className="stir-card" key={row.id}>
          <ListingThumbnail sdk={sdk} attachmentId={row.mainPhotoId} alt={row.title} />
          <span className={'stir-badge ' + row.direction}>{t(row.direction)}</span>
          <h4><button type="button" className="stir-link" onClick={() => navigate('/stir/listing/' + row.id)}>{row.title}</button></h4>
        </article>)}
        {!data.recent.content.length && <p>{t('empty')}</p>}
      </section>
      <button className="stir-link" onClick={() => navigate('/stir')}>{t('marketplace')}</button>
    </section>
  </section>;
}

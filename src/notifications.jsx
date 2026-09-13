import { notificationApi } from './api.js';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

/** Small unread-count badge for the nav bar. Polls on a plain interval - no realtime
 * infrastructure needed for a pilot (section 31 of the 0.4 brief). */
export function NotificationBell({ sdk, t, navigate }) {
  const api = useMemo(() => notificationApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const load = () => api.unreadCount().then((r) => setCount(r.count)).catch(() => {});
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [sdk.activeTenantId]);
  return <button className="stir-bell" onClick={() => navigate('/stir/notifications')} aria-label={t('notifications')}>
    🔔{count > 0 && <span className="stir-badge-count">{count > 99 ? '99+' : count}</span>}
  </button>;
}

const REFERENCE_ROUTE = { NEGOTIATION: '/stir/negotiations/', AGREEMENT: '/stir/agreements/' };

export function NotificationList({ sdk, t, navigate }) {
  const api = useMemo(() => notificationApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [result, setResult] = useState({ content: [], totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    setLoading(true);
    api.list(page, 20).then(setResult).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [page]);

  const open = async (notification) => {
    if (!notification.read) await api.markRead(notification.id).catch(() => {});
    navigate((REFERENCE_ROUTE[notification.referenceType] || '/stir/agreements/') + notification.referenceId);
  };

  if (loading) return <p role="status">{t('loading')}</p>;
  return <section>
    <h2>{t('notifications')}</h2>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    {!result.content.length && <p>{t('notificationsEmpty')}</p>}
    <ul className="stir-list">
      {result.content.map((n) => <li key={n.id} className={n.read ? '' : 'stir-unread'}>
        <button type="button" className="stir-link" onClick={() => open(n)}>{t('notificationType' + n.type)}</button>
        <small> {new Date(n.createdAt).toLocaleString()}</small>
      </li>)}
    </ul>
    <div className="stir-actions">
      <button disabled={page === 0} onClick={() => setPage((n) => n - 1)}>{t('previous')}</button>
      <span>{page + 1} / {Math.max(1, result.totalPages)}</span>
      <button disabled={page + 1 >= result.totalPages} onClick={() => setPage((n) => n + 1)}>{t('next')}</button>
    </div>
  </section>;
}

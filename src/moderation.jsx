import { moderationApi } from './api.js';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

/** Reports STIR's own content (Listing/profile) for review - never an osTRIS Finding, never an
 * economic sanction. A plain reason text field; no severity taxonomy for a pilot. */
export function ReportButton({ sdk, t, targetType, targetId }) {
  const api = useMemo(() => moderationApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.report(targetType, targetId, reason.trim()); setDone(true); setOpen(false); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  // The backend already enforces stir.content.report via @PreAuthorize - this only stops the
  // button from being offered to someone who will just get "no tienes permiso" after filling in
  // a reason. Reproduced in production (24/09/2026): PRUEBA Manual STIR's role lacked the
  // permission but still saw and could open the form. See AJUSTES_PARA_CLAUDE_CODE.md's P1
  // "Reportar aparece sin permiso".
  if (!sdk.useAuth().hasPermission('stir.content.report')) return null;
  if (done) return <p role="status">{t('reportSubmitted')}</p>;
  if (!open) return <button type="button" className="secondary" onClick={() => setOpen(true)}>{t('reportContent')}</button>;
  return <form className="stir-form" onSubmit={submit}>
    <label className="stir-wide">{t('reportReason')}<textarea required maxLength={500} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    <div className="stir-actions stir-wide">
      <button disabled={busy} type="submit">{t(busy ? 'sending' : 'reportSubmit')}</button>
      <button type="button" className="secondary" onClick={() => setOpen(false)}>{t('cancel')}</button>
    </div>
  </form>;
}

/** Minimal moderation queue (section 17 of the 0.4 brief) - review open reports, hide the
 * reported Listing (never touching its Agreement/Trade/journal history) or dismiss. */
export function ModerationQueue({ sdk, t }) {
  const api = useMemo(() => moderationApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [result, setResult] = useState({ content: [], totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = () => api.openReports(0, 50).then(setResult).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const act = async (fn) => { setBusy(true); setError(''); try { await fn(); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); } };

  if (loading) return <p role="status">{t('loading')}</p>;
  return <section>
    <h2>{t('moderationQueue')}</h2>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    {!result.content.length && <p>{t('moderationQueueEmpty')}</p>}
    <ul className="stir-list">
      {result.content.map((r) => <li key={r.id} className="stir-panel">
        <p><strong>{t(r.targetType)}</strong> - {r.reason}</p>
        <small>{new Date(r.createdAt).toLocaleString()}</small>
        <div className="stir-actions">
          <button disabled={busy} onClick={() => act(() => api.hide(r.id))}>{t('moderationHide')}</button>
          <button disabled={busy} className="secondary" onClick={() => act(() => api.dismiss(r.id))}>{t('moderationDismiss')}</button>
        </div>
      </li>)}
    </ul>
  </section>;
}

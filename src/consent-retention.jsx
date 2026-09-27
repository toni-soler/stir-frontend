// Consent/Retention (CONSENT_RETENTION.md): having a datum, having permission to use it, still
// being allowed to retain it, and still being eligible as current evidence are four different
// questions. Kept in its own file/API surface (consentApi/retentionApi in api.js) - consent is a
// personal, cross-definition concern (MyConsentPanel), retention is a publisher/community concern
// scoped to one definition (RetentionPanel), and neither has route/layout/branding baked in.
import { consentApi, retentionApi, ordinaryGovernanceApi } from './api.js';
const React = window.__IDAX_MODULE_SDK__.React;
const { useState, useEffect, useMemo } = React;

/** Personal, self-service: every consent record the current user is a party to, across every
 * definition, with a withdraw action on any still-active grant. Grant/decline itself happens
 * automatically when accepting/making an Agreement offer (negotiation.jsx) - there is nothing to
 * grant here, only to review and withdraw. */
export function MyConsentPanel({ sdk, t }) {
  const api = useMemo(() => consentApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const load = () => api.mine().then(setItems).catch(e => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, [api]);
  const withdraw = async (id) => {
    setBusy(id); setError('');
    try { await api.withdraw(id, confirming?.reason || ''); setConfirming(null); await load(); }
    catch (e) { setError(t(e.message.replace('stir.', ''))); } finally { setBusy(null); }
  };
  if (loading) return <p role="status">{t('loading')}</p>;
  return <section className="stir-panel">
    <h3>{t('consentMyTitle')}</h3>
    <p>{t('consentMyHint')}</p>
    {error && <p role="alert">{error}</p>}
    {items.length === 0 ? <p>{t('consentNoneYet')}</p> : <ul>
      {items.map(c => <li key={c.id}>
        <strong>{c.definition_name}</strong> · {t('consentPurpose' + c.purpose)} · {t('consentStatus' + c.status)} · {c.observed_at}
        {c.status === 'GRANT' && <>
          {confirming?.id !== c.id
            ? <button type="button" className="stir-link" disabled={busy === c.id} onClick={() => setConfirming({ id: c.id, reason: '' })}>{t('consentWithdraw')}</button>
            : <span className="stir-actions">
                <p role="alert">{t('consentWithdrawImpact')}</p>
                <label>{t('consentWithdrawReason')}<input value={confirming.reason} onChange={e => setConfirming({ ...confirming, reason: e.target.value })} maxLength={2000} /></label>
                <button type="button" disabled={busy === c.id} onClick={() => withdraw(c.id)}>{t('consentWithdrawConfirm')}</button>
                <button type="button" className="secondary" disabled={busy === c.id} onClick={() => setConfirming(null)}>{t('cancel')}</button>
              </span>}
        </>}
        {c.status === 'WITHDRAW' && <span>{t('consentWithdrawn')}</span>}
        {c.status === 'DECLINE' && <span>{t('consentDeclined')}</span>}
      </li>)}
    </ul>}
  </section>;
}

/** Publisher/community-authority toolkit: current retention policy, what's currently due for
 * anonymization (elapsed window, no market-integrity hold), and the anonymize action itself. */
export function RetentionPanel({ sdk, t, definitionId, communityId, canManage }) {
  const api = useMemo(() => retentionApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const govApi = useMemo(() => ordinaryGovernanceApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [policy, setPolicy] = useState(null);
  const [due, setDue] = useState([]);
  const [form, setForm] = useState({ retentionPeriodDays: 90, explanation: '' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [revision, setRevision] = useState(0);
  const [governanceBlocked, setGovernanceBlocked] = useState(false);
  useEffect(() => {
    if (!communityId) return;
    setError('');
    api.currentPolicy(communityId).then(p => { setPolicy(p); setForm({ retentionPeriodDays: p.retention_period_days, explanation: '' }); }).catch(() => {});
    api.due(definitionId).then(setDue).catch(() => {});
  }, [api, communityId, definitionId, revision]);
  if (!communityId) return null;
  const run = async (fn) => { setBusy(true); setError(''); setGovernanceBlocked(false); try { await fn(); setRevision(n => n + 1); } catch (e) { setError(t(e.message.replace('stir.', ''))); setGovernanceBlocked(e.status === 409); } finally { setBusy(false); } };
  const savePolicy = (e) => { e.preventDefault(); run(() => api.setPolicy(communityId, form)); };
  const proposeInstead = () => run(() => govApi.proposeRetentionPolicyChange(communityId, form));
  const anonymize = (observationId) => run(() => api.anonymize(observationId, 'Retention window elapsed, no market integrity case linked'));
  return <details><summary>{t('retentionTitle')}</summary>
    <p>{t('retentionHint')}</p>
    {error && <p role="alert">{error}</p>}
    {policy && <p>{t('retentionCurrentPolicy')}: {policy.retention_period_days} {t('retentionDays')} · v{policy.version || 0}</p>}
    {canManage && <form className="stir-form" onSubmit={savePolicy}>
      <label>{t('retentionPeriodDays')}<input type="number" min={90} required value={form.retentionPeriodDays} onChange={e => setForm({ ...form, retentionPeriodDays: Number(e.target.value) })} /></label>
      <label className="stir-wide">{t('refPolicyExplanation')}<textarea required maxLength={2000} value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })} /></label>
      <button disabled={busy}>{t('retentionSavePolicy')}</button>
      {governanceBlocked && <button type="button" className="secondary" disabled={busy} onClick={proposeInstead}>{t('retentionProposeInstead')}</button>}
    </form>}
    {canManage && <><h4>{t('retentionDueTitle')}</h4>
      {due.length === 0 ? <p>{t('retentionNoneDue')}</p> : <ul>
        {due.map(o => <li key={o.observationId}><code>{String(o.observationId).slice(0, 8)}</code> · {o.source} · {o.observedAt} · {t('retentionRetainedUntil')} {o.retainUntil}
          <button type="button" disabled={busy} onClick={() => anonymize(o.observationId)}>{t('retentionAnonymize')}</button></li>)}
      </ul>}
    </>}
  </details>;
}

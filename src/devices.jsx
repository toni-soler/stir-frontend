import { deviceApi } from './api.js';
import { getSigner, markDeviceRegistered } from './signer.js';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

/**
 * Device/credential lifecycle UI (section 8-9-10 of the 0.4 brief). A "device" here is one
 * osTRIS credential bound to the caller's ALREADY-ACTIVE controller - never a new controller,
 * never a change to AccountControlPolicy's threshold. Nothing here ever shows a private key: the
 * client generates and keeps it (see signer.js); only the public key crosses the network.
 */
export function DeviceManagement({ sdk, t }) {
  const api = useMemo(() => deviceApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [devices, setDevices] = useState(null);
  const [thisDeviceRegistered, setThisDeviceRegistered] = useState(true);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // A device change osTRIS refused with "approval required": what is being changed and the intent
  // to approve. The authenticator code lives only in `code` until it is sent, the approval only in
  // a local variable for the single retry - neither is stored.
  const [pending, setPending] = useState(null);
  const [code, setCode] = useState('');

  const load = async () => {
    const list = await api.list();
    setDevices(list);
    const signer = await getSigner(sdk.activeTenantId, sdk.user.id);
    setThisDeviceRegistered(Boolean(signer.credentialId) && list.some((d) => d.credentialId === signer.credentialId && !d.revoked));
  };
  useEffect(() => { load().catch((e) => setError(e.message)); }, [sdk.activeTenantId]);

  const APPROVAL_REQUIRED = 'stir.errorOPERATION_APPROVAL_REQUIRED';
  // Performs one device change, with an approval when one was obtained for exactly this change.
  const perform = async (change, approval) => {
    if (change.kind === 'add') {
      const added = await api.add(change.label, change.publicKeyBase64url, approval);
      await markDeviceRegistered(sdk.activeTenantId, sdk.user.id, added.credentialId);
      setLabel('');
    } else {
      await api.revoke(change.credentialId, approval);
    }
    await load();
  };
  // First attempt without an approval: deployments that do not require one behave as before. When
  // osTRIS answers "approval required", STIR describes the exact operation and the user confirms it.
  const start = async (change) => {
    setBusy(true); setError(''); setPending(null); setCode('');
    try { await perform(change); }
    catch (e) {
      if (e.message !== APPROVAL_REQUIRED) { setError(e.message); return; }
      try {
        const intent = change.kind === 'add' ? await api.addIntent(change.publicKeyBase64url) : await api.revokeIntent(change.credentialId);
        setPending({ ...change, intent });
      } catch (inner) { setError(inner.message); }
    } finally { setBusy(false); }
  };
  const addThisDevice = async (event) => {
    event.preventDefault();
    const signer = await getSigner(sdk.activeTenantId, sdk.user.id);
    await start({ kind: 'add', label: label.trim() || t('thisDevice'), publicKeyBase64url: signer.publicKeyBase64url });
  };
  const revoke = (credentialId) => start({ kind: 'revoke', credentialId });
  const confirm = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    const entered = code.trim(); setCode('');
    try {
      const approval = await api.requestApproval(pending.intent, entered);
      try { await perform(pending, approval); setPending(null); }
      catch (e) {
        // An approval that expired or no longer matches cannot be retried: start the change again.
        if (/^stir\.errorOPERATION_APPROVAL_/.test(e.message)) { setPending(null); setError('stir.approvalRestart'); } else setError(e.message);
      }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!devices) return <p role="status">{t('loading')}</p>;
  const active = devices.filter((d) => !d.revoked);
  return <section className="stir-panel">
    <h3>{t('authorizedDevices')}</h3>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    {pending && <form className="stir-form" onSubmit={confirm} data-testid="device-approval">
      <h4 className="stir-wide">{t('approvalTitle')}</h4>
      <p className="stir-wide" role="status">{t(pending.kind === 'add' ? 'approvalHelpAdd' : 'approvalHelpRevoke')}</p>
      <label>{t('approvalCode')}<input value={code} onChange={(e) => setCode(e.target.value)} required autoFocus
        autoComplete="one-time-code" inputMode="numeric" maxLength={12} data-testid="device-approval-code" /></label>
      <div className="stir-actions stir-wide">
        <button disabled={busy} type="submit" data-testid="device-approval-confirm">{t('approvalConfirm')}</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => { setPending(null); setCode(''); setError(''); }} data-testid="device-approval-cancel">{t('cancel')}</button>
      </div>
    </form>}
    <ul className="stir-list">
      {devices.map((d) => <li key={d.credentialId}>
        <span>{d.label || t('unnamedDevice')}</span> <small>{d.addedAt ? new Date(d.addedAt).toLocaleDateString() : ''}</small>
        {d.revoked ? <span className="stir-badge">{t('deviceRevoked')}</span> : <>
          <span className="stir-badge">{t('deviceActive')}</span>
          <button type="button" className="secondary" disabled={busy || Boolean(pending) || active.length <= 1}
            title={active.length <= 1 ? t('cannotRevokeLastDevice') : ''}
            onClick={() => revoke(d.credentialId)} data-testid="device-revoke">{t('revoke')}</button>
        </>}
      </li>)}
    </ul>
    {!thisDeviceRegistered && <form className="stir-form" onSubmit={addThisDevice}>
      <p role="status">{t('thisDeviceNotRegistered')}</p>
      <label>{t('deviceLabel')}<input value={label} maxLength={80} placeholder={t('thisDevice')} onChange={(e) => setLabel(e.target.value)} /></label>
      <div className="stir-actions"><button disabled={busy || Boolean(pending)} type="submit" data-testid="device-add">{t(busy ? 'activating' : 'addThisDevice')}</button></div>
    </form>}
  </section>;
}

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

  const load = async () => {
    const list = await api.list();
    setDevices(list);
    const signer = await getSigner(sdk.activeTenantId, sdk.user.id);
    setThisDeviceRegistered(Boolean(signer.credentialId) && list.some((d) => d.credentialId === signer.credentialId && !d.revoked));
  };
  useEffect(() => { load().catch((e) => setError(e.message)); }, [sdk.activeTenantId]);

  const addThisDevice = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const signer = await getSigner(sdk.activeTenantId, sdk.user.id);
      const added = await api.add(label.trim() || t('thisDevice'), signer.publicKeyBase64url);
      await markDeviceRegistered(sdk.activeTenantId, sdk.user.id, added.credentialId);
      setLabel(''); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const revoke = async (credentialId) => {
    setBusy(true); setError('');
    try { await api.revoke(credentialId); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!devices) return <p role="status">{t('loading')}</p>;
  const active = devices.filter((d) => !d.revoked);
  return <section className="stir-panel">
    <h3>{t('authorizedDevices')}</h3>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    <ul className="stir-list">
      {devices.map((d) => <li key={d.credentialId}>
        <span>{d.label || t('unnamedDevice')}</span> <small>{d.addedAt ? new Date(d.addedAt).toLocaleDateString() : ''}</small>
        {d.revoked ? <span className="stir-badge">{t('deviceRevoked')}</span> : <>
          <span className="stir-badge">{t('deviceActive')}</span>
          <button type="button" className="secondary" disabled={busy || active.length <= 1}
            title={active.length <= 1 ? t('cannotRevokeLastDevice') : ''}
            onClick={() => revoke(d.credentialId)}>{t('revoke')}</button>
        </>}
      </li>)}
    </ul>
    {!thisDeviceRegistered && <form className="stir-form" onSubmit={addThisDevice}>
      <p role="status">{t('thisDeviceNotRegistered')}</p>
      <label>{t('deviceLabel')}<input value={label} maxLength={80} placeholder={t('thisDevice')} onChange={(e) => setLabel(e.target.value)} /></label>
      <div className="stir-actions"><button disabled={busy} type="submit">{t(busy ? 'activating' : 'addThisDevice')}</button></div>
    </form>}
  </section>;
}

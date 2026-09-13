import { economicApi } from './api.js';
import { getSigner, markDeviceRegistered } from './signer.js';
import { DeviceManagement } from './devices.jsx';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

export function formatAmount(minorUnitsString, scale) {
  if (minorUnitsString == null) return '';
  const negative = minorUnitsString.startsWith('-');
  const digits = negative ? minorUnitsString.slice(1) : minorUnitsString;
  const padded = digits.padStart(scale + 1, '0');
  const whole = padded.slice(0, padded.length - scale) || '0';
  const fraction = scale > 0 ? '.' + padded.slice(padded.length - scale) : '';
  return (negative ? '-' : '') + whole + fraction;
}

export function MyEconomicProfile({ sdk, t }) {
  const api = useMemo(() => economicApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [marketplace, setMarketplace] = useState(undefined);
  const [me, setMe] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bootstrapForm, setBootstrapForm] = useState({ communityName: '', unitCode: '', unitScale: 2 });

  const load = () => {
    api.marketplace().then(setMarketplace).catch((e) => setMarketplace(e.status === 409 ? null : undefined));
    api.me().then(setMe).catch((e) => setMe(e.status === 404 ? null : undefined));
  };
  useEffect(load, [api]);

  const bootstrap = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { setMarketplace(await api.bootstrapMarketplace({ ...bootstrapForm, unitScale: Number(bootstrapForm.unitScale) })); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const activate = async () => {
    setBusy(true); setError('');
    try {
      const signer = await getSigner(sdk.activeTenantId, sdk.user.id);
      const result = await api.activate(signer.publicKeyBase64url);
      // credentialId is only non-null the ONE time this call actually creates a new credential
      // (the first device to activate) - see EconomicActivationService.activate()'s docstring.
      if (result.credentialId) await markDeviceRegistered(sdk.activeTenantId, sdk.user.id, result.credentialId);
      setMe(result.profile);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (marketplace === undefined || me === undefined) return <p role="status">{t('loading')}</p>;
  return <>
  <section className="stir-panel">
    <h2>{t('economicActivation')}</h2>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    {marketplace === null && <>
      <p>{t('marketplaceNotBound')}</p>
      <form className="stir-form" onSubmit={bootstrap}>
        <label>{t('communityName')}<input required maxLength={160} value={bootstrapForm.communityName} onChange={e => setBootstrapForm({ ...bootstrapForm, communityName: e.target.value })} /></label>
        <label>{t('unitCode')}<input required maxLength={16} value={bootstrapForm.unitCode} onChange={e => setBootstrapForm({ ...bootstrapForm, unitCode: e.target.value.toUpperCase() })} /></label>
        <label>{t('unitScale')}<input required type="number" min="0" max="18" value={bootstrapForm.unitScale} onChange={e => setBootstrapForm({ ...bootstrapForm, unitScale: e.target.value })} /></label>
        <div className="stir-actions stir-wide"><button disabled={busy} type="submit">{t('bootstrapMarketplace')}</button></div>
      </form>
    </>}
    {marketplace && <p>{t('economicCommunity')}: {marketplace.communityName} · {t('unit')}: {marketplace.unitCode}</p>}
    {marketplace && me === null && <div className="stir-actions"><button disabled={busy} onClick={activate}>{t(busy ? 'activating' : 'activateExchanges')}</button></div>}
    {marketplace && me && <>
      <p role="status">{t('activationStatusActive')}</p>
      <p>{t('balance')}: <strong>{formatAmount(me.balanceProjection, marketplace.unitScale)} {marketplace.unitCode}</strong></p>
      <p>{t('creditFloor')}: {formatAmount(me.creditFloor, marketplace.unitScale)} {marketplace.unitCode}</p>
    </>}
  </section>
  {marketplace && me && <DeviceManagement sdk={sdk} t={t} />}
  </>;
}

import { tradeApi, economicApi } from './api.js';
import { getSigner, authorizationMessageBytes } from './signer.js';
import { formatAmount } from './economic.jsx';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

/** Economic execution panel shown on an Agreement's own page. */
export function TradeStatus({ sdk, t, agreementId, economicPhase, navigate }) {
  const trades = useMemo(() => tradeApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const economic = useMemo(() => economicApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [trade, setTrade] = useState(undefined);
  const [marketplace, setMarketplace] = useState(null);
  const [authorizedAccountIds, setAuthorizedAccountIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const userId = sdk.user?.id;

  const load = () => {
    trades.find(agreementId).then(setTrade).catch((e) => setError(e.message));
    economic.marketplace().then(setMarketplace).catch(() => {});
  };
  useEffect(load, [agreementId]);
  useEffect(() => {
    if (trade && trade.executionState === 'AWAITING_SIGNATURES') {
      trades.signingPayload(agreementId).then((p) => setAuthorizedAccountIds(p.authorizedAccountIds)).catch(() => {});
    }
  }, [trade]);

  const run = async (action) => {
    setBusy(true); setError('');
    try { setTrade(await action()); }
    catch (e) { setError(e.message); try { setTrade(await trades.sync(agreementId)); } catch { /* keep the original error visible */ } }
    finally { setBusy(false); }
  };
  const activateTrade = () => run(() => trades.activate(agreementId));
  const sign = () => run(async () => {
    const payload = await trades.signingPayload(agreementId);
    const signer = await getSigner(sdk.activeTenantId, userId);
    const signature = await signer.sign(authorizationMessageBytes(payload.authorizationPayload));
    return trades.authorize(agreementId, signature);
  });
  const commit = () => run(() => trades.commit(agreementId));

  if (economicPhase === 'NOT_APPLICABLE') return <p>{t('economicNotApplicable')}</p>;
  if (trade === undefined) return <p role="status">{t('loading')}</p>;
  if (trade === null) return <section>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    <div className="stir-actions"><button disabled={busy} onClick={activateTrade}>{t('activateExchange')}</button></div>
  </section>;

  const iAmPayer = trade.payerUserId === userId;
  const myAccountId = iAmPayer ? trade.payerAccountId : trade.payeeAccountId;
  const iHaveSigned = authorizedAccountIds.includes(myAccountId);
  const counterpartyHasSigned = authorizedAccountIds.length > 0 && authorizedAccountIds.some((id) => id !== myAccountId);
  const amount = marketplace ? formatAmount(trade.amount, marketplace.unitScale) + ' ' + marketplace.unitCode : trade.amount;

  return <section>
    <p>{t(iAmPayer ? 'youWillPay' : 'youWillReceive')} <strong>{amount}</strong></p>
    <p><span className={'stir-badge ' + (trade.executionState === 'COMMITTED' ? 'ACCEPTED' : trade.executionState === 'REJECTED' ? 'DECLINED' : '')}>{t('executionState' + trade.executionState)}</span></p>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    {trade.executionState === 'AWAITING_SIGNATURES' && <>
      {!iHaveSigned && <div className="stir-actions"><button disabled={busy} onClick={sign}>{t(busy ? 'signing' : 'signExchange')}</button></div>}
      {iHaveSigned && !counterpartyHasSigned && <p role="status">{t('waitingForCounterpartySignature')}</p>}
      {iHaveSigned && counterpartyHasSigned && <div className="stir-actions"><button disabled={busy} onClick={commit}>{t(busy ? 'committing' : 'commitExchange')}</button></div>}
    </>}
    {trade.executionState === 'COMMITTED' && <div className="stir-receipt">
      <p>{t('committedSequence')}: {trade.committedSequence}</p>
      <p>{t('protocolDigest')}: <code>{trade.protocolDigest}</code></p>
      <p>{t('committedAt')}: {new Date(trade.committedAt).toLocaleString()}</p>
      <button type="button" className="stir-link" onClick={() => navigate('/stir/economic')}>{t('viewMyBalance')}</button>
    </div>}
    {trade.executionState === 'REJECTED' && <p role="alert">{t('exchangeRejected')}</p>}
  </section>;
}

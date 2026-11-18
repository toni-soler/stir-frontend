// Agreement fulfilment (stir-doc/AGREEMENT_FULFILMENT.md): one board per Agreement with each
// obligation's own status, the typed declarations of each party, amendments that name what they
// replace, and the last economic execution outcome. STIR never decides who is right: a one-sided
// "not received" stays a disagreement, never a failure.
import { fulfilmentApi, participantApi } from './api.js';
import { FULFILMENT_MODES } from './catalog-client.js';
import { OpenCase, CLAIMABLE_KINDS } from './cases.jsx';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

export const OBLIGOR_TYPES = ['PERFORMED', 'PARTIALLY_PERFORMED', 'NOT_PERFORMED'];
export const BENEFICIARY_TYPES = ['CONFORMITY_CONFIRMED', 'PARTIAL_RECEIVED', 'NONCONFORMITY_REPORTED', 'NOT_RECEIVED'];
export const NOTE_REQUIRED = ['PARTIALLY_PERFORMED', 'PARTIAL_RECEIVED'];
export const AMENDABLE_KINDS = ['OBJECT', 'OWNER_TASKS', 'INITIATOR_TASKS'];
const SETTLED = ['DONE', 'FAILED', 'SUPERSEDED'];
const STATUS_TONE = { DONE: 'ACCEPTED', FAILED: 'DECLINED', IN_DISAGREEMENT: 'DECLINED', PARTIAL: '', DECLARED: '', PENDING: '', SUPERSEDED: 'CLOSED' };

const errorText = (t, e) => t(String(e?.message || e).replace('stir.', ''));
const party = (t, me, userId) => userId === me ? t('fulfilmentYou') : t('fulfilmentOtherParty');

function Declare({ t, obligation, onDeclare, busy }) {
  const types = obligation.yourRole === 'OBLIGOR' ? OBLIGOR_TYPES : BENEFICIARY_TYPES;
  const [type, setType] = useState(types[0]);
  const [note, setNote] = useState('');
  const submit = (event) => { event.preventDefault(); onDeclare(obligation.id, type, note).then(ok => ok && setNote('')); };
  return <form className="stir-form stir-declare" onSubmit={submit} data-testid={'declare-' + obligation.kind}>
    <label>{t(obligation.yourRole === 'OBLIGOR' ? 'fulfilmentDeclareAsObligor' : 'fulfilmentDeclareAsBeneficiary')}
      <select value={type} onChange={e => setType(e.target.value)} data-testid="declaration-type">
        {types.map(code => <option key={code} value={code}>{t('declaration' + code)}</option>)}
      </select></label>
    <label className="stir-wide">{t('fulfilmentNote')}
      <textarea maxLength={2000} required={NOTE_REQUIRED.includes(type)} value={note} onChange={e => setNote(e.target.value)} data-testid="declaration-note" />
      {NOTE_REQUIRED.includes(type) && <small>{t('fulfilmentNoteRequired')}</small>}</label>
    <div className="stir-actions stir-wide"><button type="submit" disabled={busy} data-testid="declare-submit">{t('fulfilmentDeclare')}</button></div>
  </form>;
}

function Obligation({ sdk, t, me, obligation, lastAttempt, onDeclare, busy, agreementId, cases = [], corrections = [], navigate, onCaseOpened }) {
  const economic = obligation.kind === 'ECONOMIC_EXCHANGE';
  const mine = cases.filter(c => c.obligationId === obligation.id);
  const live = mine.some(c => !['RESOLVED', 'WITHDRAWN'].includes(c.status));
  const canClaim = navigate && CLAIMABLE_KINDS.includes(obligation.kind) && obligation.yourRole === 'BENEFICIARY'
    && !['DONE', 'SUPERSEDED'].includes(obligation.status) && !live;
  const canDeclare = !economic && obligation.status !== 'SUPERSEDED' && obligation.yourRole;
  return <article className={'stir-card stir-obligation' + (obligation.status === 'SUPERSEDED' ? ' stir-muted' : '')}
    data-testid={'obligation-' + obligation.kind + (obligation.status === 'SUPERSEDED' ? '-superseded' : '')}>
    <div className="stir-obligation-head">
      <strong>{t('obligationKind' + obligation.kind)}</strong>
      <span className={'stir-badge ' + (STATUS_TONE[obligation.status] || '')} data-testid="obligation-status">{t('obligationStatus' + obligation.status)}</span>
    </div>
    {obligation.description && <p className="stir-description">{obligation.description}</p>}
    <p><small>{t('fulfilmentOwedBy')}: {party(t, me, obligation.obligorUserId)} → {party(t, me, obligation.beneficiaryUserId)}
      {obligation.fulfilBy && <> · {t('termsFulfilBy')}: {obligation.fulfilBy}</>}
      {obligation.fulfilmentMode && <> · {t('fulfilment' + obligation.fulfilmentMode)}</>}
      {obligation.origin === 'AMENDMENT' && <> · {t('obligationFromAmendment')}</>}</small></p>
    <p><small>{t('obligationStatusHelp' + obligation.status)}</small></p>
    {economic && <p><small>{t('obligationEconomicHelp')}</small></p>}
    {economic && lastAttempt && <p data-testid="last-execution-outcome">
      <span className={'stir-badge ' + (lastAttempt.outcome === 'COMMITTED' ? 'ACCEPTED' : '')}>{t('executionOutcome' + lastAttempt.outcome)}</span>{' '}
      <small>{t('executionOutcomeHelp' + lastAttempt.outcome)}</small></p>}
    {obligation.events.length > 0 && <ol className="stir-timeline">
      {obligation.events.map(event => <li key={event.id}>
        <small>{new Date(event.createdAt).toLocaleString()} · {party(t, me, event.actorUserId)}:</small> {t('declaration' + event.type)}
        {event.note && <small> — {event.note}</small>}
      </li>)}
    </ol>}
    {economic && corrections.map(x => <p key={x.id} data-testid={'correction-' + x.status}>
      <span className={'stir-badge ' + (x.status === 'EXECUTED' ? 'ACCEPTED' : '')}>{t('correctionStatus' + x.status)}</span>{' '}
      <small>{t('correctionHelp' + x.status)}</small>{navigate && <> <button type="button" className="stir-link" onClick={() => navigate('/stir/cases/' + x.caseId)}>{t('caseView')}</button></>}</p>)}
    {mine.map(c => <p key={c.id} data-testid={'obligation-case-' + c.status}>
      <span className="stir-badge">{t('caseClaim' + c.claim)} · {t('caseStatus' + c.status)}</span>{' '}
      {navigate && <button type="button" className="stir-link" onClick={() => navigate('/stir/cases/' + c.id)}>{t('caseView')}</button>}</p>)}
    {canDeclare && <Declare t={t} obligation={obligation} onDeclare={onDeclare} busy={busy} />}
    {canClaim && <OpenCase sdk={sdk} t={t} agreementId={agreementId} obligation={obligation} navigate={navigate} onOpened={onCaseOpened} />}
  </article>;
}

function ProposeAmendment({ t, board, onPropose, busy }) {
  const replaceable = board.obligations.filter(o => AMENDABLE_KINDS.includes(o.kind) && !SETTLED.includes(o.status));
  const blank = { kind: 'OBJECT', description: '', fulfilBy: '', fulfilmentMode: '' };
  const [replaces, setReplaces] = useState([]);
  const [added, setAdded] = useState([]);
  const [reason, setReason] = useState('');
  const toggle = (id) => setReplaces(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  const change = (i, key, value) => setAdded(current => current.map((o, j) => j === i ? { ...o, [key]: value } : o));
  const submit = (event) => {
    event.preventDefault();
    onPropose({ baseDigest: board.headDigest, replaces, reason,
      obligations: added.map(o => ({ kind: o.kind, description: o.description, fulfilBy: o.fulfilBy || null, fulfilmentMode: o.fulfilmentMode || null })) })
      .then(ok => { if (ok) { setReplaces([]); setAdded([]); setReason(''); } });
  };
  return <form className="stir-form" onSubmit={submit} data-testid="amendment-form">
    <p className="stir-wide"><small>{t('amendmentHelp')}</small></p>
    {replaceable.length > 0 && <fieldset className="stir-wide stir-fieldset"><legend>{t('amendmentReplaces')}</legend>
      {replaceable.map(o => <label key={o.id} className="stir-check">
        <input type="checkbox" checked={replaces.includes(o.id)} onChange={() => toggle(o.id)} data-testid={'amend-replace-' + o.kind} />
        <span>{t('obligationKind' + o.kind)}{o.description ? ': ' + o.description : ''}</span></label>)}
    </fieldset>}
    {added.map((o, i) => <fieldset key={i} className="stir-wide stir-fieldset" data-testid={'amend-new-' + i}><legend>{t('amendmentNewObligation')}</legend>
      <label>{t('amendmentKind')}<select value={o.kind} onChange={e => change(i, 'kind', e.target.value)} data-testid="amend-new-kind">
        {AMENDABLE_KINDS.map(k => <option key={k} value={k}>{t('obligationKind' + k)}</option>)}</select></label>
      <label>{t('termsFulfilBy')}<input type="date" value={o.fulfilBy} onChange={e => change(i, 'fulfilBy', e.target.value)} data-testid="amend-new-date" /></label>
      <label>{t('fulfilmentMode')}<select value={o.fulfilmentMode} onChange={e => change(i, 'fulfilmentMode', e.target.value)}>
        <option value="">{t('termsNotStated')}</option>
        {FULFILMENT_MODES.map(m => <option key={m} value={m}>{t('fulfilment' + m)}</option>)}</select></label>
      <label className="stir-wide">{t('amendmentDescription')}<textarea required maxLength={4000} value={o.description}
        onChange={e => change(i, 'description', e.target.value)} data-testid="amend-new-description" /></label>
    </fieldset>)}
    <div className="stir-actions stir-wide"><button type="button" className="secondary" onClick={() => setAdded([...added, { ...blank }])}
      data-testid="amend-add">{t('amendmentAdd')}</button></div>
    <label className="stir-wide">{t('amendmentReason')}<textarea required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)}
      data-testid="amend-reason" /></label>
    <div className="stir-actions stir-wide"><button type="submit" disabled={busy || (!replaces.length && !added.length)} data-testid="amend-submit">
      {t('amendmentPropose')}</button></div>
  </form>;
}

function Amendments({ t, me, amendments, onDecide, busy }) {
  if (!amendments.length) return <p><small>{t('amendmentNone')}</small></p>;
  return <ol className="stir-timeline" data-testid="amendments">
    {amendments.map(a => <li key={a.id} data-testid={'amendment-' + a.status}>
      <span className="stir-badge">{t('amendmentStatus' + a.status)}</span>{' '}
      <small>{party(t, me, a.proposerUserId)} · {new Date(a.createdAt).toLocaleString()}</small>
      <p>{a.reason}</p>
      <small>{t('amendmentReplacedCount')}: {(a.content?.replaces || []).length} · {t('amendmentAddedCount')}: {(a.content?.obligations || []).length}</small>
      {a.digestSha256 && <p><small>{t('amendmentDigest')}: <code>{a.digestSha256}</code></small></p>}
      {a.status === 'PROPOSED' && <div className="stir-actions">
        {a.proposerUserId !== me && <button disabled={busy} onClick={() => onDecide(a.id, 'accept')} data-testid="amendment-accept">{t('amendmentAccept')}</button>}
        <button className="secondary" disabled={busy} onClick={() => onDecide(a.id, 'reject')} data-testid="amendment-reject">
          {t(a.proposerUserId === me ? 'amendmentWithdraw' : 'amendmentReject')}</button>
      </div>}
    </li>)}
  </ol>;
}

/** The obligation board shown on an Agreement's own page. */
export function FulfilmentPanel({ sdk, t, agreementId, reloadKey, navigate }) {
  const api = useMemo(() => fulfilmentApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [board, setBoard] = useState(null);
  const [amendments, setAmendments] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposing, setProposing] = useState(false);
  const me = sdk.user?.id;
  const load = () => Promise.all([api.view(agreementId), api.amendments(agreementId)])
    .then(([view, list]) => { setBoard(view); setAmendments(list); }).catch(e => setError(errorText(t, e)));
  useEffect(() => { load(); }, [agreementId, reloadKey]);
  const act = async (action) => {
    setBusy(true); setError('');
    try { await action(); await load(); return true; } catch (e) { setError(errorText(t, e)); return false; } finally { setBusy(false); }
  };
  if (!board) return error ? <p role="alert">{error}</p> : <p role="status">{t('loading')}</p>;
  const active = board.obligations.filter(o => o.status !== 'SUPERSEDED');
  const superseded = board.obligations.filter(o => o.status === 'SUPERSEDED');
  return <section className="stir-fulfilment" data-testid="obligation-board">
    <p><small>{t('fulfilmentIntro')}</small></p>
    {error && <p role="alert">{error}</p>}
    {board.containment && <p className="stir-notice" data-testid="board-containment">{t('caseContainmentActive')} {new Date(board.containment.until).toLocaleString()}</p>}
    <div className="stir-grid">
      {active.map(o => <Obligation key={o.id} sdk={sdk} t={t} me={me} obligation={o} lastAttempt={board.lastExecutionAttempt} busy={busy}
        agreementId={agreementId} cases={board.cases || []} corrections={board.corrections || []} navigate={navigate} onCaseOpened={load}
        onDeclare={(id, type, note) => act(() => api.declare(agreementId, id, { type, note }))} />)}
    </div>
    {superseded.length > 0 && <details><summary>{t('obligationsSuperseded')} ({superseded.length})</summary>
      <div className="stir-grid">{superseded.map(o => <Obligation key={o.id} t={t} me={me} obligation={o} busy={busy} />)}</div></details>}
    <h3>{t('amendments')}</h3>
    <Amendments t={t} me={me} amendments={amendments} busy={busy} onDecide={(id, decision) => act(() => api[decision](agreementId, id))} />
    {!proposing && <div className="stir-actions"><button className="secondary" onClick={() => setProposing(true)} data-testid="amendment-open">{t('amendmentOpen')}</button></div>}
    {proposing && <ProposeAmendment t={t} board={board} busy={busy}
      onPropose={value => act(() => api.propose(agreementId, value)).then(ok => { if (ok) setProposing(false); return ok; })} />}
  </section>;
}

/**
 * Contextual history on a profile: described facts, never a score. Off unless the participant
 * shares it; "no history yet" and "not shared" are different answers.
 */
export function FulfilmentHistory({ sdk, t, userId, own }) {
  const api = useMemo(() => participantApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.history(userId).then(setHistory).catch(e => setError(errorText(t, e))); }, [userId]);
  const toggle = async () => {
    setBusy(true); setError('');
    try { setHistory(await api.shareHistory(!history.shared)); } catch (e) { setError(errorText(t, e)); } finally { setBusy(false); }
  };
  if (!history) return error ? <p role="alert">{error}</p> : null;
  return <section className="stir-history" data-testid="fulfilment-history">
    <h3>{t('historyTitle')}</h3>
    {error && <p role="alert">{error}</p>}
    {history.status === 'NOT_SHARED' && <p data-testid="history-not-shared">{t('historyNotShared')}</p>}
    {history.status === 'NO_HISTORY_YET' && <p data-testid="history-none">{t('historyNoneYet')}</p>}
    {history.status === 'HISTORY' && <ul data-testid="history-entries">
      {history.entries.map(e => <li key={e.kind + (e.fulfilmentMode || '')}>
        {t('historyEntry' + e.kind)}: {e.count}{e.fulfilmentMode && <> · {t('fulfilment' + e.fulfilmentMode)}</>}
      </li>)}
    </ul>}
    <p><small>{t('historyHelp')}</small></p>
    {own && <label className="stir-check"><input type="checkbox" checked={history.shared} disabled={busy} onChange={toggle} data-testid="history-share" />
      <span>{t('historyShare')}</span></label>}
  </section>;
}

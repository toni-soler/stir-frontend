// Agreement cases (stir-doc/AGREEMENT_CASES.md): reviewing what did not happen without judging the
// person. The case, the finding about the effect, the attribution of conduct, a sanction and an
// appeal are separate objects, each with its own author, status and appeal window. Nothing here
// happens by itself. Reviewers sign economic corrections with their own device key.
import { caseApi } from './api.js';
import { getSigner, governanceMessageBytes } from './signer.js';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

export const CLAIMS = ['NON_DELIVERY', 'NON_CONFORMITY', 'PARTIAL_DELIVERY'];
export const CLAIMABLE_KINDS = ['OBJECT', 'OWNER_TASKS', 'INITIATOR_TASKS'];
export const EFFECTS = ['ESTABLISHED', 'PARTIALLY_ESTABLISHED', 'NOT_ESTABLISHED'];
export const SUBJECT_ROLES = ['OBLIGOR', 'BENEFICIARY', 'THIRD_PARTY', 'NONE'];
export const ASSESSMENTS = ['NO_FAULT', 'GOOD_FAITH_THIRD_PARTY', 'GOOD_FAITH_ERROR', 'BREACH'];
export const CASE_STATUSES = ['OPEN', 'UNDER_REVIEW', 'FINDING_ISSUED', 'APPEALED', 'RESOLVED', 'WITHDRAWN'];
export const DECISION_STATUSES = ['ISSUED', 'APPEALED', 'FINAL', 'OVERTURNED'];
export const EVENT_TYPES = ['OPENED', 'EVIDENCE_ADDED', 'REVIEW_TAKEN', 'CONTAINMENT_APPLIED', 'CONTAINMENT_LIFTED', 'FINDING_ISSUED',
  'ATTRIBUTION_ISSUED', 'SANCTION_ISSUED', 'APPEAL_WAIVED', 'APPEAL_FILED', 'APPEAL_DECIDED', 'DECISION_FINAL', 'REMEDY_PREPARED',
  'REMEDY_SIGNED', 'REMEDY_EXECUTED', 'REMEDY_ATTEMPT_FAILED', 'WITHDRAWN'];
const CLOSED = ['RESOLVED', 'WITHDRAWN'];
const TONE = { RESOLVED: 'ACCEPTED', WITHDRAWN: 'CLOSED', FINAL: 'ACCEPTED', OVERTURNED: 'CLOSED', APPEALED: 'DECLINED' };

const errorText = (t, e) => t(String(e?.message || e).replace('stir.', ''));
const when = (value) => value ? new Date(value).toLocaleString() : '';

function useAction(t, reload) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action) => {
    setBusy(true); setError('');
    try { const result = await action(); await reload(result); return true; }
    catch (e) { setError(errorText(t, e)); return false; }
    finally { setBusy(false); }
  };
  return { busy, error, run };
}

function TextForm({ t, label, submitLabel, busy, onSubmit, testid, required = true, children, max = 4000 }) {
  const [text, setText] = useState('');
  return <form className="stir-form" data-testid={testid}
    onSubmit={e => { e.preventDefault(); onSubmit(text).then(ok => ok && setText('')); }}>
    {children}
    <label className="stir-wide">{label}<textarea required={required} maxLength={max} value={text} onChange={e => setText(e.target.value)} data-testid={testid + '-text'} /></label>
    <div className="stir-actions stir-wide"><button type="submit" disabled={busy} data-testid={testid + '-submit'}>{submitLabel}</button></div>
  </form>;
}

/** On the obligation board: open a case about an obligation owed to you that was not fulfilled. */
export function OpenCase({ sdk, t, agreementId, obligation, navigate, onOpened }) {
  const api = useMemo(() => caseApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [open, setOpen] = useState(false);
  const [claim, setClaim] = useState(CLAIMS[0]);
  const { busy, error, run } = useAction(t, async (view) => { onOpened?.(); if (view?.id) navigate('/stir/cases/' + view.id); });
  if (!open) return <div className="stir-actions"><button className="secondary" onClick={() => setOpen(true)} data-testid={'case-open-' + obligation.kind}>
    {t('caseOpen')}</button></div>;
  return <section className="stir-case-open" data-testid="case-open-form">
    <p><small>{t('caseOpenHelp')}</small></p>
    {error && <p role="alert">{error}</p>}
    <TextForm t={t} testid="case-statement" label={t('caseStatement')} submitLabel={t('caseOpenSubmit')} busy={busy}
      onSubmit={statement => run(() => api.open(agreementId, { obligationId: obligation.id, claim, statement }))}>
      <label>{t('caseClaim')}<select value={claim} onChange={e => setClaim(e.target.value)} data-testid="case-claim">
        {CLAIMS.map(c => <option key={c} value={c}>{t('caseClaim' + c)}</option>)}</select></label>
    </TextForm>
  </section>;
}

/** The cases each person is part of, and the ones a reviewer may take. */
export function CaseList({ sdk, t, navigate }) {
  const api = useMemo(() => caseApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [lists, setLists] = useState(null);
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.list().then(setLists).catch(e => setError(errorText(t, e)));
    api.review().then(setReview).catch(() => {});
  }, []);
  if (!lists) return error ? <p role="alert">{error}</p> : <p role="status">{t('loading')}</p>;
  const row = c => <li key={c.id} data-testid={'case-row-' + c.status}>
    <button type="button" className="stir-link" onClick={() => navigate('/stir/cases/' + c.id)}>{t('caseClaim' + c.claim)}</button>{' '}
    <span className={'stir-badge ' + (TONE[c.status] || '')}>{t('caseStatus' + c.status)}</span>{' '}
    <small>{t('caseYourRole' + c.yourRole)} · {when(c.updatedAt)}</small></li>;
  return <section className="stir-panel" data-testid="case-list">
    <h2>{t('casesTitle')}</h2>
    <p><small>{t('casesIntro')}</small></p>
    <h3>{t('casesAsParty')}</h3>
    {lists.asParty.length ? <ul>{lists.asParty.map(row)}</ul> : <p><small>{t('casesNone')}</small></p>}
    {review?.youReview && <><h3>{t('casesToReview')}</h3>
      {lists.toReview.length ? <ul data-testid="case-review-queue">{lists.toReview.map(row)}</ul> : <p><small>{t('casesNone')}</small></p>}</>}
    <p><button type="button" className="stir-link" onClick={() => navigate('/stir/case-review')}>{t('caseReviewWho')}</button></p>
  </section>;
}

/** Who reviews cases in this community, publicly visible; community authority can change it. */
export function CaseReviewSettings({ sdk, t }) {
  const api = useMemo(() => caseApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [view, setView] = useState(null);
  const [ids, setIds] = useState('');
  const [threshold, setThreshold] = useState(2);
  const [windowHours, setWindowHours] = useState(72);
  const load = () => api.review().then(v => { setView(v); setIds(v.reviewers.map(r => r.userId).join('\n'));
    if (v.signatureThreshold) setThreshold(v.signatureThreshold); if (v.appealWindowHours) setWindowHours(v.appealWindowHours); });
  const { busy, error, run } = useAction(t, load);
  useEffect(() => { load().catch(() => {}); }, []);
  if (!view) return <p role="status">{t('loading')}</p>;
  return <section className="stir-panel" data-testid="case-review-settings">
    <h2>{t('caseReviewTitle')}</h2>
    <p><small>{t('caseReviewIntro')}</small></p>
    {!view.configured && <p data-testid="case-review-unconfigured">{t('caseReviewNotConfigured')}</p>}
    {view.reviewers.length > 0 && <ul data-testid="case-reviewers">{view.reviewers.map(r => <li key={r.userId}>
      {r.displayName || <code>{String(r.userId).slice(0, 8)}</code>} <small>· {t('caseReviewSince')} {when(r.since)}</small></li>)}</ul>}
    {view.configured && <p><small>{t('caseReviewThreshold')}: {view.signatureThreshold} · {t('caseReviewWindow')}: {view.appealWindowHours} h</small></p>}
    <details><summary>{t('caseReviewChange')}</summary>
      <p><small>{t('caseReviewChangeHelp')}</small></p>
      {error && <p role="alert">{error}</p>}
      <form className="stir-form" data-testid="case-review-form" onSubmit={e => { e.preventDefault();
        run(() => api.configure({ reviewerUserIds: ids.split(/\s+/).map(s => s.trim()).filter(Boolean), threshold: Number(threshold), appealWindowHours: Number(windowHours) })); }}>
        <label className="stir-wide">{t('caseReviewIds')}<textarea required value={ids} onChange={e => setIds(e.target.value)} data-testid="case-review-ids" /></label>
        <label>{t('caseReviewThreshold')}<input type="number" min={1} max={32} value={threshold} onChange={e => setThreshold(e.target.value)} data-testid="case-review-threshold" /></label>
        <label>{t('caseReviewWindow')}<input type="number" min={1} max={720} value={windowHours} onChange={e => setWindowHours(e.target.value)} data-testid="case-review-window" /></label>
        <div className="stir-actions stir-wide"><button type="submit" disabled={busy} data-testid="case-review-save">{t('caseReviewSave')}</button></div>
      </form>
    </details>
  </section>;
}

function Decision({ t, me, c, d, api, run, busy }) {
  const party = c.yourRole !== 'REVIEWER';
  const waived = (d.waivedBy || []).includes(me);
  const open = d.status === 'ISSUED';
  const windowOpen = open && new Date(d.appealDeadline) > new Date();
  return <article className="stir-card stir-decision" data-testid={'decision-' + d.decisionType + '-' + d.status}>
    <div className="stir-obligation-head">
      <strong>{t('caseDecision' + d.decisionType)}</strong>
      <span className={'stir-badge ' + (TONE[d.status] || '')} data-testid="decision-status">{t('caseDecisionStatus' + d.status)}</span>
    </div>
    <p><small>{t('caseDecisionHelp' + d.decisionType)}</small></p>
    {d.decisionType === 'FINDING' && <>
      <p data-testid="finding-effect"><strong>{t('caseEffect' + d.effect)}</strong></p>
      <p><small>{t('caseEconomicCorrection' + d.economicCorrection)}</small></p>
      {d.performanceRemedy && <p>{t('casePerformanceRemedy')}: {d.performanceRemedy}</p>}
    </>}
    {d.decisionType === 'ATTRIBUTION' && <p data-testid="attribution-assessment"><strong>{t('caseAssessment' + d.assessment)}</strong>
      {' · '}{t('caseSubject' + d.subjectRole)}{d.thirdPartyNote ? ': ' + d.thirdPartyNote : ''}</p>}
    {d.decisionType === 'SANCTION' && <p data-testid="sanction-kind"><strong>{t('caseSanction' + d.sanctionKind)}</strong>
      {' · '}{d.subjectUserId === me ? t('fulfilmentYou') : t('fulfilmentOtherParty')}</p>}
    <p className="stir-description">{d.reasoning}</p>
    <p><small>{t('caseIssuedAt')} {when(d.createdAt)}{open && <> · {t('caseAppealUntil')} {when(d.appealDeadline)}</>}
      {d.finalAt && <> · {t('caseFinalAt')} {when(d.finalAt)}</>}</small></p>
    {(d.waivedBy || []).length > 0 && <p><small>{t('caseAcceptedBy')}: {d.waivedBy.length} / 2</small></p>}
    {d.appeal && <div className="stir-appeal" data-testid={'appeal-' + d.appeal.status}>
      <p><strong>{t('caseAppeal')}</strong> <span className="stir-badge">{t('caseAppealStatus' + d.appeal.status)}</span></p>
      <p className="stir-description">{d.appeal.grounds}</p>
      {d.appeal.decisionReasoning && <p><small>{t('caseAppealDecision')}: {d.appeal.decisionReasoning}</small></p>}
      {c.yourRole === 'REVIEWER' && d.appeal.status === 'OPEN' && d.issuedByUserId !== me &&
        <AppealDecision t={t} busy={busy} onDecide={(outcome, reasoning) => run(() => api.decideAppeal(c.id, d.appeal.id, { outcome, reasoning }))} />}
      {c.yourRole === 'REVIEWER' && d.appeal.status === 'OPEN' && d.issuedByUserId === me && <p><small>{t('caseAppealNotAuthor')}</small></p>}
    </div>}
    {party && windowOpen && !waived && <div className="stir-actions">
      <button disabled={busy} onClick={() => run(() => api.waive(c.id, d.id))} data-testid="decision-accept">{t('caseAccept')}</button>
    </div>}
    {party && windowOpen && !waived && !d.appeal &&
      <TextForm t={t} testid="appeal" label={t('caseAppealGrounds')} submitLabel={t('caseAppealSubmit')} busy={busy}
        onSubmit={grounds => run(() => api.appeal(c.id, d.id, { grounds }))} />}
    {c.yourRole === 'REVIEWER' && open && <div className="stir-actions">
      <button className="secondary" disabled={busy} onClick={() => run(() => api.finalize(c.id, d.id))} data-testid="decision-finalize">{t('caseFinalize')}</button>
      <small>{t('caseFinalizeHelp')}</small></div>}
  </article>;
}

function AppealDecision({ t, busy, onDecide }) {
  const [outcome, setOutcome] = useState('UPHELD');
  return <TextForm t={t} testid="appeal-decision" label={t('caseAppealDecisionReasoning')} submitLabel={t('caseAppealDecide')} busy={busy}
    onSubmit={reasoning => onDecide(outcome, reasoning)}>
    <label>{t('caseAppealOutcome')}<select value={outcome} onChange={e => setOutcome(e.target.value)} data-testid="appeal-outcome">
      {['UPHELD', 'OVERTURNED'].map(o => <option key={o} value={o}>{t('caseAppealStatus' + o)}</option>)}</select></label>
  </TextForm>;
}

function FindingForm({ t, c, busy, onIssue }) {
  const [effect, setEffect] = useState('ESTABLISHED');
  const [correction, setCorrection] = useState('NONE');
  const [remedy, setRemedy] = useState('');
  return <TextForm t={t} testid="finding" label={t('caseReasoning')} submitLabel={t('caseIssueFinding')} busy={busy}
    onSubmit={reasoning => onIssue({ effect, economicCorrection: correction, performanceRemedy: remedy || null, reasoning })}>
    <label>{t('caseEffect')}<select value={effect} onChange={e => { setEffect(e.target.value); if (e.target.value === 'NOT_ESTABLISHED') setCorrection('NONE'); }} data-testid="finding-effect-select">
      {EFFECTS.map(x => <option key={x} value={x}>{t('caseEffect' + x)}</option>)}</select></label>
    <label>{t('caseEconomicCorrection')}<select value={correction} onChange={e => setCorrection(e.target.value)} data-testid="finding-correction"
      disabled={effect === 'NOT_ESTABLISHED' || !c.economicExchangeCommitted}>
      <option value="NONE">{t('caseEconomicCorrectionNONE')}</option>
      <option value="FULL_REVERSAL">{t('caseEconomicCorrectionFULL_REVERSAL')}</option></select></label>
    <label className="stir-wide">{t('casePerformanceRemedy')}<input maxLength={2000} value={remedy} onChange={e => setRemedy(e.target.value)} data-testid="finding-remedy" /></label>
  </TextForm>;
}

function AttributionForm({ t, busy, onIssue }) {
  const [subjectRole, setSubjectRole] = useState('NONE');
  const [assessment, setAssessment] = useState('NO_FAULT');
  const [thirdParty, setThirdParty] = useState('');
  return <TextForm t={t} testid="attribution" label={t('caseReasoning')} submitLabel={t('caseIssueAttribution')} busy={busy}
    onSubmit={reasoning => onIssue({ subjectRole, assessment, thirdPartyNote: thirdParty || null, reasoning })}>
    <p className="stir-wide"><small>{t('caseAttributionHelp')}</small></p>
    <label>{t('caseSubject')}<select value={subjectRole} onChange={e => setSubjectRole(e.target.value)} data-testid="attribution-subject">
      {SUBJECT_ROLES.map(x => <option key={x} value={x}>{t('caseSubject' + x)}</option>)}</select></label>
    <label>{t('caseAssessment')}<select value={assessment} onChange={e => setAssessment(e.target.value)} data-testid="attribution-assessment-select">
      {ASSESSMENTS.map(x => <option key={x} value={x}>{t('caseAssessment' + x)}</option>)}</select></label>
    {subjectRole === 'THIRD_PARTY' && <label className="stir-wide">{t('caseThirdParty')}<input required maxLength={1000} value={thirdParty}
      onChange={e => setThirdParty(e.target.value)} data-testid="attribution-third-party" /></label>}
  </TextForm>;
}

function Remedy({ sdk, t, me, c, r, api, run, busy }) {
  const [payload, setPayload] = useState(null);
  const signed = (r.signedBy || []).includes(me);
  const review = async () => setPayload(await api.remedyPayload(c.id, r.id));
  const sign = () => run(async () => {
    const current = payload || await api.remedyPayload(c.id, r.id);
    const signer = await getSigner(sdk.activeTenantId, me);
    if (!signer.credentialId) throw new Error('stir.caseNoDeviceKey');
    const signature = await signer.sign(governanceMessageBytes(current.signingDomain, current.governancePayload));
    return api.signRemedy(c.id, r.id, { credentialId: signer.credentialId, signatureBase64url: signature });
  });
  let parsed = null;
  try { parsed = payload ? JSON.parse(payload.governancePayload) : null; } catch { parsed = null; }
  return <article className="stir-card" data-testid={'remedy-' + r.status}>
    <div className="stir-obligation-head"><strong>{t('caseRemedy' + r.kind)}</strong>
      <span className={'stir-badge ' + (r.status === 'EXECUTED' ? 'ACCEPTED' : '')} data-testid="remedy-status">{t('caseRemedyStatus' + r.status)}</span></div>
    <p><small>{t('caseRemedyHelp')}</small></p>
    <p><small>{t('caseRemedySignatures')}: {(r.signedBy || []).length}{c.signatureThreshold ? ' / ' + c.signatureThreshold : ''}
      {r.committedSequence != null && <> · {t('caseRemedySequence')} {r.committedSequence}</>}
      {r.lastErrorCode && r.status !== 'EXECUTED' && <> · {t('caseRemedyLastError')}: <code>{r.lastErrorCode}</code></>}</small></p>
    {c.yourRole === 'REVIEWER' && r.status !== 'EXECUTED' && <>
      {!payload && <div className="stir-actions"><button className="secondary" onClick={() => review().catch(() => {})} data-testid="remedy-review">{t('caseRemedyReview')}</button></div>}
      {parsed && <div className="stir-signing-summary" data-testid="remedy-summary">
        <p><small>{t('caseRemedyPurpose')}: <code>{parsed.purpose}</code> · {t('caseRemedyReverses')}: <code>{String(parsed.references?.reversesTransactionId || '').slice(0, 8)}</code></small></p>
        <ul>{(parsed.entries || []).map(e => <li key={e.accountId}><code>{String(e.accountId).slice(0, 8)}</code>: {e.amount}</li>)}</ul>
        <details><summary>{t('caseRemedyExact')}</summary><pre className="stir-description">{payload.governancePayload}</pre></details>
      </div>}
      {!signed && <div className="stir-actions"><button disabled={busy} onClick={sign} data-testid="remedy-sign">{t('caseRemedySign')}</button></div>}
      {signed && <div className="stir-actions"><small>{t('caseRemedyYouSigned')}</small>
        <button className="secondary" disabled={busy} onClick={() => run(() => api.commitRemedy(c.id, r.id))} data-testid="remedy-commit">{t('caseRemedyRetry')}</button></div>}
    </>}
  </article>;
}

/** One case: what is claimed, the timeline each side sees, evidence, decisions, appeals and corrections. */
export function CaseDetail({ sdk, t, id, navigate }) {
  const api = useMemo(() => caseApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [c, setCase] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [visibility, setVisibility] = useState('PARTIES_AND_REVIEWERS');
  const [reference, setReference] = useState('');
  const [until, setUntil] = useState('');
  const me = sdk.user?.id;
  const load = (view) => view && view.id ? Promise.resolve(setCase(view)) : api.view(id).then(setCase).catch(e => setLoadError(errorText(t, e)));
  const { busy, error, run } = useAction(t, load);
  useEffect(() => { load(); }, [id]);
  if (!c) return loadError ? <p role="alert">{loadError}</p> : <p role="status">{t('loading')}</p>;
  const reviewer = c.yourRole === 'REVIEWER';
  const closed = CLOSED.includes(c.status);
  const standing = type => c.decisions.find(d => d.decisionType === type && d.status !== 'OVERTURNED');
  const finding = standing('FINDING'), attribution = standing('ATTRIBUTION'), sanction = standing('SANCTION');
  const activeContainment = c.containments.find(x => x.active);
  const evidenceById = Object.fromEntries(c.evidence.map(e => [e.id, e]));
  const roleLabel = role => t('caseActor' + role);
  return <section className="stir-panel stir-case" data-testid="case-detail">
    <h2>{t('caseTitle')}: {t('caseClaim' + c.claim)}</h2>
    <p><span className={'stir-badge ' + (TONE[c.status] || '')} data-testid="case-status">{t('caseStatus' + c.status)}</span>{' '}
      <small>{t('caseYourRole' + c.yourRole)}</small></p>
    <p><small>{t('caseStatusHelp' + c.status)}</small></p>
    <p><strong>{t('obligationKind' + c.obligationKind)}</strong>{c.obligationDescription ? ': ' + c.obligationDescription : ''}
      {' '}<small>({t('obligationStatus' + c.obligationStatus)})</small></p>
    <p className="stir-description">{c.statement}</p>
    {c.yourRole !== 'REVIEWER' && <p><button type="button" className="stir-link" onClick={() => navigate('/stir/agreements/' + c.agreementId)}>{t('viewAgreement')}</button></p>}
    <p><small>{t('caseNoScore')}</small></p>
    {error && <p role="alert">{error}</p>}
    {activeContainment && <p className="stir-notice" data-testid="case-containment">{t('caseContainmentActive')} {when(activeContainment.until)} — {activeContainment.reason}</p>}

    <h3>{t('caseTimeline')}</h3>
    <ol className="stir-timeline" data-testid="case-timeline">
      {c.events.map(e => <li key={e.id} data-testid={'case-event-' + e.type}>
        <small>{when(e.createdAt)} · {e.actorUserId === me ? t('fulfilmentYou') : roleLabel(e.actorRole)}:</small> {t('caseEvent' + e.type)}
        {e.type === 'EVIDENCE_ADDED' && evidenceById[e.refId] && !evidenceById[e.refId].description && <small> — {t('caseEvidenceRestricted')}</small>}
        {e.note && <small> — {e.note}</small>}
      </li>)}
    </ol>

    <h3>{t('caseEvidence')}</h3>
    {c.evidence.length ? <ul data-testid="case-evidence">{c.evidence.map(e => <li key={e.id} data-testid={'evidence-' + e.visibility}>
      <small>{when(e.createdAt)} · {e.submittedBy === me ? t('fulfilmentYou') : roleLabel(e.submitterRole)} · {t('caseVisibility' + e.visibility)}</small>
      {e.description ? <p className="stir-description">{e.description}{e.externalReference && <> <code>{e.externalReference}</code></>}</p>
        : <p><small>{t('caseEvidenceRestricted')}</small></p>}
    </li>)}</ul> : <p><small>{t('caseEvidenceNone')}</small></p>}
    {!closed && <form className="stir-form" data-testid="evidence-form" onSubmit={e => { e.preventDefault();
      const text = e.currentTarget.elements.description.value;
      run(() => api.evidence(c.id, { description: text, visibility, externalReference: reference || null })).then(ok => { if (ok) { e.target.reset(); setReference(''); } }); }}>
      <label className="stir-wide">{t('caseEvidenceDescription')}<textarea name="description" required maxLength={4000} data-testid="evidence-text" /></label>
      <label>{t('caseEvidenceReference')}<input maxLength={500} value={reference} onChange={e => setReference(e.target.value)} data-testid="evidence-reference" /></label>
      <label>{t('caseVisibility')}<select value={visibility} onChange={e => setVisibility(e.target.value)} data-testid="evidence-visibility">
        {['PARTIES_AND_REVIEWERS', 'REVIEWERS_ONLY'].map(v => <option key={v} value={v}>{t('caseVisibility' + v)}</option>)}</select></label>
      <p className="stir-wide"><small>{t('caseVisibilityHelp')}</small></p>
      <div className="stir-actions stir-wide"><button type="submit" disabled={busy} data-testid="evidence-submit">{t('caseEvidenceAdd')}</button></div>
    </form>}

    <h3>{t('caseDecisions')}</h3>
    <p><small>{t('caseDecisionsIntro')}</small></p>
    {c.decisions.length ? <div className="stir-grid">{c.decisions.map(d => <Decision key={d.id} t={t} me={me} c={c} d={d} api={api} run={run} busy={busy} />)}</div>
      : <p><small>{t('caseDecisionsNone')}</small></p>}

    {c.remedies.length > 0 && <><h3>{t('caseRemedies')}</h3>
      <div className="stir-grid">{c.remedies.map(r => <Remedy key={r.id} sdk={sdk} t={t} me={me} c={c} r={r} api={api} run={run} busy={busy} />)}</div></>}

    {reviewer && <section className="stir-reviewer-tools" data-testid="reviewer-tools">
      <h3>{t('caseReviewerTools')}</h3>
      {c.status === 'OPEN' && <div className="stir-actions"><button disabled={busy} onClick={() => run(() => api.take(c.id))} data-testid="case-take">{t('caseTake')}</button></div>}
      {!closed && !activeContainment && c.status !== 'OPEN' && <form className="stir-form" data-testid="containment-form" onSubmit={e => { e.preventDefault();
        const reason = e.currentTarget.elements.reason.value;
        run(() => api.contain(c.id, { reason, until: new Date(until).toISOString() })); }}>
        <p className="stir-wide"><small>{t('caseContainmentHelp')}</small></p>
        <label>{t('caseContainmentUntil')}<input type="datetime-local" required value={until} onChange={e => setUntil(e.target.value)} data-testid="containment-until" /></label>
        <label className="stir-wide">{t('caseContainmentReason')}<textarea name="reason" required maxLength={2000} data-testid="containment-reason" /></label>
        <div className="stir-actions stir-wide"><button type="submit" disabled={busy} data-testid="containment-submit">{t('caseContain')}</button></div>
      </form>}
      {activeContainment && <div className="stir-actions"><button className="secondary" disabled={busy} onClick={() => run(() => api.lift(c.id))} data-testid="containment-lift">{t('caseLift')}</button></div>}
      {c.status === 'UNDER_REVIEW' && c.reviewerUserId === me && !finding && <FindingForm t={t} c={c} busy={busy} onIssue={value => run(() => api.finding(c.id, value))} />}
      {c.status === 'UNDER_REVIEW' && c.reviewerUserId !== me && <p><small>{t('caseAssignedToOther')}</small></p>}
      {finding?.status === 'FINAL' && finding.effect !== 'NOT_ESTABLISHED' && !attribution && <AttributionForm t={t} busy={busy} onIssue={value => run(() => api.attribution(c.id, value))} />}
      {attribution?.status === 'FINAL' && attribution.assessment === 'BREACH' && !sanction &&
        <TextForm t={t} testid="sanction" label={t('caseReasoning')} submitLabel={t('caseIssueSanction')} busy={busy}
          onSubmit={reasoning => run(() => api.sanction(c.id, { kind: 'WARNING', reasoning }))}>
          <p className="stir-wide"><small>{t('caseSanctionHelp')}</small></p>
        </TextForm>}
      {finding?.status === 'FINAL' && finding.economicCorrection === 'FULL_REVERSAL' && !c.remedies.length &&
        <div className="stir-actions"><button disabled={busy} onClick={() => run(() => api.prepareRemedy(c.id))} data-testid="remedy-prepare">{t('caseRemedyPrepare')}</button>
          <small>{t('caseRemedyPrepareHelp')}</small></div>}
    </section>}

    {c.yourRole === 'CLAIMANT' && !closed && !finding?.finalAt && <details><summary>{t('caseWithdraw')}</summary>
      <TextForm t={t} testid="withdraw" label={t('caseWithdrawNote')} submitLabel={t('caseWithdraw')} busy={busy} required={false} max={2000}
        onSubmit={note => run(() => api.withdraw(c.id, { note: note || null }))} />
    </details>}
  </section>;
}

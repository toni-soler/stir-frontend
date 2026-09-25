import { referenceApi, marketGovernanceApi, integrityApi } from './api.js';
import { comparison, proposalDeviation } from './reference-comparison.js';
const React=window.__IDAX_MODULE_SDK__.React;
const {useState,useEffect,useMemo}=React;

export function ReferencePanel({sdk,t,definitionId,offer,context,onDefinition}) {
  const api=useMemo(()=>referenceApi(sdk,sdk.activeTenantId),[sdk.activeTenantId]);
  const [data,setData]=useState(context||null),[error,setError]=useState('');
  useEffect(()=>{setData(context||null);if(!context&&definitionId)api.view(definitionId).then(setData).catch(e=>setError(e.message));},[api,definitionId,context]);
  useEffect(()=>{if(data?.definition&&onDefinition)onDefinition(data.definition);},[data?.definition?.id]);
  if(!definitionId&&!context)return null;
  if(error)return <p role="alert">{t('refUnavailable')}</p>;
  if(!data)return <p>{t('loading')}</p>;
  const {definition:d,reference:r,evidence:e}=data;
  return <aside className="stir-panel" data-testid="reference-panel">
    <h3>{t(context?'refHistorical':'refCommunity')}: {d.name}</h3>
    <p>{d.scope} · {d.quantity_basis} {d.quantity_unit}</p>
    <p>{t('refAccountUnit')}: {t('refCommunityUnit')}</p><details><summary>{t('refTechnicalUnit')}</summary><code>{d.unit_ref}</code></details>
    {r?<><p>{t('ref'+r.kind)} · v{r.version}: {r.lower_value??''}{r.upper_value!==r.lower_value?' – '+(r.upper_value??''):''}</p><p>{r.explanation}</p></>:<p>{t('refNone')}</p>}
    <p>{t('refFree')}</p>
    <h4>{t('refObserved')}</h4>
    <p>{t('ref'+e.status)}</p>
    {e.observationCount!=null&&<p>{t('refAgreements')}: {e.observationCount} · {t('refParticipants')}: {e.participantCount} · {t('refRelationships')}: {e.relationshipCount} · {t('refMedian')}: {e.median} · {t('refIqr')}: {e.lowerQuartile} – {e.upperQuartile}</p>}
    {offer&&<p>{t('refProposal')}: {t('ref'+comparison(offer,d,r))}</p>}
    <details><summary>{t('refWhy')}</summary>
      <p>{t('refWhyText')}</p><p>{t('refDaily')}</p><p>{t('refIdentity')}</p>
      <p>{t('refWindow')}: {e.windowStart} – {e.windowEnd}</p>
      {e.reasons.map(reason=><p key={reason}>{t('ref'+reason)}</p>)}
      <p>{t('refThresholds')}: {e.minimumObservations} / {e.minimumParticipants} / {e.maximumAllowedParticipantShare}</p>
      {e.observationCount!=null&&<p>{t('refPairShare')}: {e.maximumPairShare} · {t('refDaysObserved')}: {e.distinctUtcDays} · {t('refSensitivity')}: {e.maximumSingleObservationMedianShift}</p>}
      <p>{t('refConstitutionVersion')}: {e.constitutionVersion} · {t('refIndependenceCheck')}: {String(e.independenceChecksRequired)} · {t('refConcentrationCheck')}: {String(e.concentrationChecksRequired)}</p>
      <p>{t('refIdentityAssuranceLabel')}: {t('ref'+e.identityAssurance)}
        {e.independenceAssuranceCoveragePercent!=null&&<> · {t('refIndependenceCoverage')}: {e.independenceAssuranceCoveragePercent}%</>}
        {e.adjustedIndependentParticipantCount!=null&&<> · {t('refAdjustedParticipants')}: {e.adjustedIndependentParticipantCount} ({t('refRawParticipants')}: {e.participantCount})</>}
        {e.relatedAccountClusters!=null&&e.relatedAccountClusters>0&&<> · {t('refRelatedClusters')}: {e.relatedAccountClusters}</>}
        {e.unknownIndependenceAccountCount!=null&&e.unknownIndependenceAccountCount>0&&<> · {t('refUnknownIndependence')}: {e.unknownIndependenceAccountCount}</>}
      </p>
      <p className="stir-hint">{t('refIndependenceExplainer')}</p>
      {r&&<><p>{t('refDecision')}: {r.decision}</p><p>{t('refOrigin')}: {r.origin}</p><p>{t('refValidity')}: {r.valid_from} – {r.valid_until}</p></>}
      {data.publicationEvidence&&<p>{t('refPublicationEvidence')}: {t('ref'+data.publicationEvidence.status)} · {data.publicationEvidence.windowEnd} · {data.publicationEvidence.observationCount??'—'}</p>}
      <p>{t('refMethod')}: {e.method} · {t('refPolicy')} v{e.policyVersion}</p>
    </details>
  </aside>;
}

export function GovernanceSummary({sdk,t,definitionId}) {
  const [state,setState]=useState(null);
  useEffect(()=>{
    let live=true;setState(null);
    referenceApi(sdk,sdk.activeTenantId).view(definitionId).then(ref=>{
      const api=marketGovernanceApi(sdk,sdk.activeTenantId);
      return Promise.all([api.view(ref.definition.community_id),api.events(ref.definition.community_id),api.proposals(ref.definition.community_id),api.audit(ref.definition.community_id)]);
    }).then(([authority,events,proposals,audit])=>{if(live)setState({authority,events,proposals,audit});})
      .catch(()=>{if(live)setState({unavailable:true});});
    return ()=>{live=false;};
  },[sdk.activeTenantId,definitionId]);
  if(!state)return null;
  if(state.unavailable)return <p>{t('refAuthorityNotActive')}</p>;
  const {authority:a,events,proposals,audit}=state;
  return <details><summary>{t('refWhatProtects')}</summary>
    <p>{t('refSevenKeysRule')}</p>
    <p>{t('refConstitutionVersion')}: {a.constitutionVersion} · SHA-256: <code>{a.constitutionDigest}</code></p>
    <p>{t('refGuardianStatus')}: {a.guardianStatus} · {t('refGuardianLimited')}</p>
    <ul>{Object.entries(a.constitution).filter(([k])=>k!=='schema').map(([k,v])=><li key={k}>{k}: {String(v)}</li>)}</ul>
    <p>{t('refSeats')}: {a.seats.map(s=>`${s.ordinal} ${s.status}`).join(' · ')}</p>
    <h4>{t('refGovernanceProposals')}</h4>
    {proposals.length===0?<p>{t('refNoGovernanceProposals')}</p>:proposals.map(p=><article key={p.id}>
      <p>{p.actionType} · {p.state} · {p.signatureCount}/{p.required} · {t('refSignedSeats')}: {p.signatures.map(s=>s.seat_ordinal).join(', ')||'—'}</p>
      {p.reason&&<p>{p.reason}</p>}{p.affectedFields&&<p>{p.affectedFields.map(k=>`${k}: ${String(p.after[k])}`).join(' · ')}</p>}
      <details><summary>{t('refGovernanceDigests')}</summary><code>{p.beforeDigest} → {p.afterDigest}</code></details>
    </article>)}
    <p>{t('refAuditEvents')}: {events.map(e=>`#${e.sequence} ${e.event_type}`).join(' · ')}</p>
    <p>{t('refAuditVerified')}: {String(audit.valid)} · {audit.eventCount} · SHA-256: <code>{audit.latestDigest}</code></p>
  </details>;
}

/** A per-observation exclusion reason is either a fixed code (SOURCE_NOT_AGREEMENT, ...) or
 * "FINAL_INTEGRITY_FINDING:<signalCode>" - reuse the same refSignal<CODE> labels IntegrityPanel
 * already has instead of needing one translated key per (finding, signal code) combination. */
function reasonLabel(t,reason) {
  if(reason.startsWith('FINAL_INTEGRITY_FINDING:'))return t('refFinalIntegrityFinding')+': '+t('refSignal'+reason.split(':')[1]);
  return t('ref'+reason);
}

/** Triggers osTRIS's own private continuity decision for one account. The publisher only asks
 * "again" here - STIR never authors or alters what osTRIS answers, only persists it. A stale/
 * NOT_ASSESSED badge is expected and normal; refreshing costs nothing and never blocks anything. */
function IndependenceBadge({sdk,t,userId}) {
  const api=useMemo(()=>referenceApi(sdk,sdk.activeTenantId),[sdk.activeTenantId]);
  const [status,setStatus]=useState(null),[busy,setBusy]=useState(false);
  useEffect(()=>{let live=true;api.independence(userId).then(r=>{if(live)setStatus(r.status);}).catch(()=>{if(live)setStatus('NOT_ASSESSED');});return ()=>{live=false;};},[api,userId]);
  const refresh=async(ev)=>{ev.stopPropagation();setBusy(true);try{const r=await api.refreshIndependence(userId);setStatus(r.status);}finally{setBusy(false);}};
  return <button type="button" className="stir-inline-action" disabled={busy} onClick={refresh} title={t('refIndependenceRefreshHint')}>
    <code>{String(userId).slice(0,8)}</code> {t('ref'+(status||'NOT_ASSESSED'))} ({t('refRefresh')})
  </button>;
}

/** Publisher-only: every raw observation this definition has, cross-referenced against the
 * private evidence manifest so RAW / REFERENCE-ELIGIBLE / EXCLUDED+reason are never conflated -
 * an excluded observation is shown here exactly as it stayed in the raw list, never removed. */
export function EvidenceBreakdown({sdk,t,definitionId}) {
  const [data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{
    let live=true;setData(null);setError('');
    const api=referenceApi(sdk,sdk.activeTenantId);
    Promise.all([api.observations(definitionId),api.evidenceManifest(definitionId)])
      .then(([observations,manifest])=>{if(live)setData({observations,manifest});})
      .catch(e=>{if(live)setError(e.message);});
    return ()=>{live=false;};
  },[sdk.activeTenantId,definitionId]);
  if(error)return <p role="alert">{t(error.replace('stir.',''))}</p>;
  if(!data)return <p>{t('loading')}</p>;
  const {observations,manifest}=data;
  const included=new Set(manifest.included);
  return <details><summary>{t('refEvidenceBreakdown')}</summary>
    <p>{t('refEvidenceBreakdownHint')}</p>
    <p>{t('refAllRaw')}: {observations.length} · {t('refEligible')}: {included.size} · {t('refExcluded')}: {observations.length-included.size}</p>
    {observations.length===0?<p>{t('refNoRawObservations')}</p>:observations.map(o=>{
      const reason=manifest.exclusions[o.id];
      return <p key={o.id}>
        <code>{o.id.slice(0,8)}</code> · {o.source} · {o.amount??'—'}/{o.quantity} {o.quantity_unit} ·
        <IndependenceBadge sdk={sdk} t={t} userId={o.participant_a}/>↔<IndependenceBadge sdk={sdk} t={t} userId={o.participant_b}/> ·
        {o.observed_at} · <strong>{reason?reasonLabel(t,reason):t('refEligibleTag')}</strong>
        {o.case_status&&<> · {t('refCaseStatus'+o.case_status)}</>}
      </p>;
    })}
  </details>;
}

/** Publisher-only: the operational policy (window/minimums/freshness) inside constitutional
 * floors. A 409 here always means the change would cross a constitutional bound - ordinary
 * publisher governance cannot do that; only a signed 7-of-7 constitutional amendment can. */
export function PolicyForm({sdk,t,definitionId,policy,onChanged}) {
  const api=useMemo(()=>referenceApi(sdk,sdk.activeTenantId),[sdk.activeTenantId]);
  const initial=()=>({windowDays:policy.window_days,minimumObservations:policy.minimum_observations,
    minimumParticipants:policy.minimum_participants,maximumParticipantShare:policy.maximum_participant_share,
    freshnessDays:policy.freshness_days,explanation:''});
  const [form,setForm]=useState(initial);
  useEffect(()=>{setForm(initial());},[policy.id]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async(e)=>{
    e.preventDefault();setBusy(true);setError('');
    try{await api.policy(definitionId,form);onChanged();}
    catch(err){setError(err.status===409?t('refPolicyBoundsRejected'):t(err.message.replace('stir.','')));}
    finally{setBusy(false);}
  };
  return <details><summary>{t('refPolicyConfig')}</summary><p>{t('refPolicyHint')}</p>
    <form className="stir-form" onSubmit={submit}>
      <label>{t('refWindowDays')}<input type="number" min={7} max={365} required value={form.windowDays} onChange={e=>setForm({...form,windowDays:Number(e.target.value)})}/></label>
      <label>{t('refMinObservations')}<input type="number" min={5} required value={form.minimumObservations} onChange={e=>setForm({...form,minimumObservations:Number(e.target.value)})}/></label>
      <label>{t('refMinParticipants')}<input type="number" min={6} required value={form.minimumParticipants} onChange={e=>setForm({...form,minimumParticipants:Number(e.target.value)})}/></label>
      <label>{t('refMaxParticipantShare')}<input type="number" min="0.1" max="0.5" step="0.01" required value={form.maximumParticipantShare} onChange={e=>setForm({...form,maximumParticipantShare:e.target.value})}/></label>
      <label>{t('refFreshnessDays')}<input type="number" min={1} required value={form.freshnessDays} onChange={e=>setForm({...form,freshnessDays:Number(e.target.value)})}/></label>
      <label className="stir-wide">{t('refPolicyExplanation')}<textarea required maxLength={2000} value={form.explanation} onChange={e=>setForm({...form,explanation:e.target.value})}/></label>
      {error&&<p role="alert">{error}</p>}
      <button disabled={busy}>{t('refPolicySave')}</button>
    </form>
  </details>;
}

const SIGNAL_CODES=['REPEATED_RELATIONSHIP','HIGH_COUNTERPARTY_CONCENTRATION','RELATED_PARTICIPANT_CLUSTER','CIRCULAR_ACTIVITY','OUTLIER_PENDING_REVIEW','OTHER_EXPLAINED_SIGNAL'];

/** Publisher-only market integrity review: SIGNAL -> UNDER_REVIEW -> FINAL|DISMISSED. The case
 * originator cannot decide their own case (backend-enforced; a 409 here means exactly that).
 * DISMISSED never excludes anything; only a FINAL event changes future eligibility, and only the
 * observation, never the Agreement, is affected. */
export function IntegrityPanel({sdk,t,definitionId}) {
  const api=useMemo(()=>integrityApi(sdk,sdk.activeTenantId),[sdk.activeTenantId]);
  const refApiInstance=useMemo(()=>referenceApi(sdk,sdk.activeTenantId),[sdk.activeTenantId]);
  const [cases,setCases]=useState([]),[observations,setObservations]=useState([]),[revision,setRevision]=useState(0);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[histories,setHistories]=useState({});
  const [signalForm,setSignalForm]=useState({observationId:'',signalCode:'OUTLIER_PENDING_REVIEW',reason:'',evidenceRefs:''});
  const [decisions,setDecisions]=useState({});
  useEffect(()=>{Promise.all([api.cases(definitionId),refApiInstance.observations(definitionId)])
    .then(([c,o])=>{setCases(c);setObservations(o);}).catch(e=>setError(e.message));},[api,refApiInstance,definitionId,revision]);
  const run=async(fn)=>{setBusy(true);setError('');try{await fn();setRevision(n=>n+1);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const signal=(e)=>{e.preventDefault();run(async()=>{await api.signal({...signalForm,evidenceRefs:signalForm.evidenceRefs.split('\n').map(s=>s.trim()).filter(Boolean)});setSignalForm({observationId:'',signalCode:'OUTLIER_PENDING_REVIEW',reason:'',evidenceRefs:''});});};
  const decide=(caseId,status)=>run(()=>api.decide(caseId,{status,reason:decisions[caseId]||''}));
  const loadHistory=(caseId)=>api.history(caseId).then(h=>setHistories(prev=>({...prev,[caseId]:h})));
  return <details><summary>{t('refIntegrityTitle')}</summary><p>{t('refIntegrityHint')}</p>
    {error&&<p role="alert">{t(error.replace('stir.',''))}</p>}
    <details><summary>{t('refIntegritySignal')}</summary><form className="stir-form" onSubmit={signal}>
      <label>{t('refIntegrityObservation')}<select required value={signalForm.observationId} onChange={e=>setSignalForm({...signalForm,observationId:e.target.value})}>
        <option value="">{t('refOptional')}</option>
        {observations.map(o=><option key={o.id} value={o.id}>{o.id.slice(0,8)} · {o.amount}/{o.quantity} · {o.observed_at}</option>)}
      </select></label>
      <label>{t('refIntegrityCode')}<select value={signalForm.signalCode} onChange={e=>setSignalForm({...signalForm,signalCode:e.target.value})}>
        {SIGNAL_CODES.map(c=><option key={c} value={c}>{t('refSignal'+c)}</option>)}
      </select></label>
      <label className="stir-wide">{t('refReason')}<textarea required maxLength={2000} value={signalForm.reason} onChange={e=>setSignalForm({...signalForm,reason:e.target.value})}/></label>
      <label className="stir-wide">{t('refEvidenceRefs')}<textarea rows={2} value={signalForm.evidenceRefs} onChange={e=>setSignalForm({...signalForm,evidenceRefs:e.target.value})}/></label>
      <button disabled={busy}>{t('refIntegritySignalSubmit')}</button>
    </form></details>
    <h4>{t('refIntegrityCases')}</h4>
    {cases.length===0?<p>{t('refIntegrityNoCases')}</p>:cases.map(c=><article key={c.id} className="stir-panel">
      <p>{t('refSignal'+c.signal_code)} · <strong>{t('refCaseStatus'+c.status)}</strong> · {c.reason}</p>
      {(c.status==='SIGNAL'||c.status==='UNDER_REVIEW')&&<>
        <label>{t('refReason')}<textarea maxLength={2000} value={decisions[c.id]||''} onChange={e=>setDecisions({...decisions,[c.id]:e.target.value})}/></label>
        <div className="stir-actions">
          {c.status==='SIGNAL'&&<button disabled={busy||!(decisions[c.id]||'').trim()} onClick={()=>decide(c.id,'UNDER_REVIEW')}>{t('refIntegrityStartReview')}</button>}
          {c.status==='UNDER_REVIEW'&&<><button disabled={busy||!(decisions[c.id]||'').trim()} onClick={()=>decide(c.id,'FINAL')}>{t('refIntegrityFinal')}</button>
            <button disabled={busy||!(decisions[c.id]||'').trim()} className="secondary" onClick={()=>decide(c.id,'DISMISSED')}>{t('refIntegrityDismiss')}</button></>}
        </div>
      </>}
      <details><summary>{t('refIntegrityHistory')}</summary>
        {!histories[c.id]?<button type="button" onClick={()=>loadHistory(c.id)}>{t('loading')}</button>:
          histories[c.id].map(ev=><p key={ev.sequence}>#{ev.sequence} {t('refCaseStatus'+ev.status)} · {ev.reason}</p>)}
      </details>
    </article>)}
  </details>;
}

export function ReferenceSelector({sdk,t,value,onChange}) {
  const [definitions,setDefinitions]=useState([]);
  useEffect(()=>{referenceApi(sdk,sdk.activeTenantId).list().then(setDefinitions).catch(()=>{});},[sdk.activeTenantId]);
  return <label>{t('refDefinition')}<select value={value||''} onChange={e=>onChange(e.target.value||null)}><option value="">{t('refOptional')}</option>{definitions.map(d=><option key={d.id} value={d.id}>{d.name} · {d.quantity_basis} {d.quantity_unit}</option>)}</select></label>;
}
export function ReferenceConsent({t,value,onChange}) {
  return <label className="stir-wide"><input type="checkbox" checked={Boolean(value)} onChange={e=>onChange(e.target.checked)}/>{t('refConsent')}</label>;
}
export function AgreementReference({sdk,t,id}) {
  const [context,setContext]=useState(null),[error,setError]=useState(false);
  useEffect(()=>{referenceApi(sdk,sdk.activeTenantId).context(id).then(setContext).catch(()=>setError(true));},[id,sdk.activeTenantId]);
  if(error)return <p role="alert">{t('refUnavailable')}</p>;
  if(!context)return null;
  return <><ReferencePanel sdk={sdk} t={t} context={JSON.parse(context.canonicalJson)}/><details><summary>{t('refContextDigest')}</summary><code>{context.digestSha256}</code><pre>{context.canonicalJson}</pre></details></>;
}

export function References({sdk,t}) {
  const api=useMemo(()=>referenceApi(sdk,sdk.activeTenantId),[sdk.activeTenantId]);
  const [definitions,setDefinitions]=useState([]),[selected,setSelected]=useState(''),[history,setHistory]=useState([]),[proposals,setProposals]=useState([]);
  const [publisher,setPublisher]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false);
  const [view,setView]=useState(null);
  const [d,setD]=useState({name:'',scope:'',quantityBasis:'1',quantityUnit:'',attributes:{}});
  const [p,setP]=useState({kind:'CONVENTION',lowerValue:'',upperValue:'',explanation:'',origin:'',validDays:90});
  const [decision,setDecision]=useState('');
  useEffect(()=>{api.list().then(setDefinitions).catch(e=>setError(e.message));api.canPublish().then(setPublisher);},[api,revision]);
  useEffect(()=>{setHistory([]);setProposals([]);setView(null);if(selected)Promise.all([api.history(selected),api.proposals(selected),api.view(selected)]).then(([h,p,v])=>{setHistory(h);setProposals(p);setView(v);}).catch(e=>setError(e.message));},[api,selected,revision]);
  const run=async(fn)=>{setBusy(true);setError('');try{await fn();setRevision(n=>n+1);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const deviation=view?.evidence?proposalDeviation(p.lowerValue,p.upperValue,view.evidence):null;
  return <section className="stir-panel"><h2>{t('refCommunity')}</h2><p>{t('refFree')}</p>
    {error&&<p role="alert">{t(error.replace('stir.',''))}</p>}
    <ReferenceSelector key={revision} sdk={sdk} t={t} value={selected} onChange={setSelected}/>
    <details><summary>{t('refCreateDefinition')}</summary><form className="stir-form" onSubmit={e=>{e.preventDefault();run(async()=>{const row=await api.create(d);setSelected(row.id);});}}>
      {['name','scope','quantityBasis','quantityUnit'].map(k=><label key={k}>{t('refField'+k)}<input required maxLength={k==='scope'?500:160} value={d[k]} onChange={e=>setD({...d,[k]:e.target.value})}/></label>)}
      <label>{t('refAttributes')}<textarea placeholder='{"weight":"500 g"}' onChange={e=>{try{setD({...d,attributes:JSON.parse(e.target.value||'{}')});e.target.setCustomValidity('');}catch{e.target.setCustomValidity(t('refInvalidJson'));}}}/></label>
      <button disabled={busy}>{t('refCreateDefinition')}</button></form></details>
    {selected&&<><ReferencePanel key={selected+revision} sdk={sdk} t={t} definitionId={selected}/>
      <GovernanceSummary key={'governance-'+selected+revision} sdk={sdk} t={t} definitionId={selected}/>
      <details><summary>{t('refPropose')}</summary><form className="stir-form" onSubmit={e=>{e.preventDefault();run(()=>api.propose(selected,{...p,lowerValue:p.kind==='QUALITATIVE'?null:p.lowerValue,upperValue:p.kind==='QUALITATIVE'?null:p.upperValue}));}}>
        <label>{t('refKind')}<select value={p.kind} onChange={e=>setP({...p,kind:e.target.value})}>{['CONVENTION','QUALITATIVE','VALUE','BAND'].map(k=><option key={k} value={k}>{t('ref'+k)}</option>)}</select></label>
        {p.kind!=='QUALITATIVE'&&['lowerValue','upperValue'].map(k=><label key={k}>{t('refField'+k)}<input type="number" min="0" step="0.01" required value={p[k]} onChange={e=>setP({...p,[k]:e.target.value})}/></label>)}
        {deviation&&<p role={deviation==='DEVIATES_FROM_OBSERVED'?'alert':undefined}>{t('refDeviation_'+deviation)}
          {view.evidence.median!=null&&<> · {t('refMedian')}: {view.evidence.median} · {t('refIqr')}: {view.evidence.lowerQuartile} – {view.evidence.upperQuartile}</>}</p>}
        {['explanation','origin'].map(k=><label key={k}>{t('refField'+k)}<textarea required maxLength={k==='origin'?100:2000} value={p[k]} onChange={e=>setP({...p,[k]:e.target.value})}/></label>)}
        <label>{t('refDays')}<input type="number" min="1" max="365" required value={p.validDays} onChange={e=>setP({...p,validDays:Number(e.target.value)})}/></label>
        <button disabled={busy}>{t('refPropose')}</button></form></details>
      <h3>{t('refProposals')}</h3>{publisher&&<label>{t('refDecision')}<textarea maxLength={2000} value={decision} onChange={e=>setDecision(e.target.value)}/></label>}
      {proposals.map(row=><article key={row.id}><p>{t('ref'+row.kind)}: {row.lower_value} – {row.upper_value} · {row.explanation}</p>
        <p><small>{t('refReconstructionTrail')}: {t('refEvidenceSnapshot')} <code>{String(row.snapshot_id).slice(0,8)}</code> → {t('refPropose')} {row.proposed_at}</small></p>
        {publisher&&!history.some(h=>h.proposal_id===row.id)&&<button disabled={busy||!decision.trim()} onClick={()=>run(()=>api.publish(row.id,decision))}>{t('refPublish')}</button>}</article>)}
      <h3>{t('refHistory')}</h3>{history.map(row=><article key={row.id}><p>v{row.version} · {t('ref'+row.kind)}: {row.lower_value} – {row.upper_value} · {row.explanation}</p><p>{row.decision} · {row.valid_from} – {row.valid_until}</p>
        <p><small>{t('refReconstructionTrail')}: {t('refEvidenceSnapshot')} <code>{String(row.snapshot_id).slice(0,8)}</code> → {t('refPropose')} → {t('refPublish')} {row.valid_from}</small></p></article>)}
      {publisher&&<>
        <p>{t('refOrdinaryGovernanceNote')}</p>
        {view?.policy&&<PolicyForm sdk={sdk} t={t} definitionId={selected} policy={view.policy} onChanged={()=>setRevision(n=>n+1)}/>}
        <EvidenceBreakdown key={'evidence-'+selected+revision} sdk={sdk} t={t} definitionId={selected}/>
        <IntegrityPanel key={'integrity-'+selected+revision} sdk={sdk} t={t} definitionId={selected}/>
      </>}
    </>}
  </section>;
}

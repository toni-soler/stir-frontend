import { referenceApi } from './api.js';
import { comparison } from './reference-comparison.js';
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
    {e.observationCount!=null&&<p>{t('refAgreements')}: {e.observationCount} · {t('refParticipants')}: {e.participantCount} · {t('refMedian')}: {e.median} · {t('refIqr')}: {e.lowerQuartile} – {e.upperQuartile}</p>}
    {offer&&<p>{t('refProposal')}: {t('ref'+comparison(offer,d,r))}</p>}
    <details><summary>{t('refWhy')}</summary>
      <p>{t('refWhyText')}</p><p>{t('refDaily')}</p><p>{t('refIdentity')}</p>
      <p>{t('refWindow')}: {e.windowStart} – {e.windowEnd}</p>
      {e.reasons.map(reason=><p key={reason}>{t('ref'+reason)}</p>)}
      <p>{t('refThresholds')}: {e.minimumObservations} / {e.minimumParticipants} / {e.maximumAllowedParticipantShare}</p>
      {r&&<><p>{t('refDecision')}: {r.decision}</p><p>{t('refOrigin')}: {r.origin}</p><p>{t('refValidity')}: {r.valid_from} – {r.valid_until}</p></>}
      {data.publicationEvidence&&<p>{t('refPublicationEvidence')}: {t('ref'+data.publicationEvidence.status)} · {data.publicationEvidence.windowEnd} · {data.publicationEvidence.observationCount??'—'}</p>}
      <p>{t('refMethod')}: {e.method} · {t('refPolicy')} v{e.policyVersion}</p>
    </details>
  </aside>;
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
  const [d,setD]=useState({name:'',scope:'',quantityBasis:'1',quantityUnit:'',attributes:{}});
  const [p,setP]=useState({kind:'CONVENTION',lowerValue:'',upperValue:'',explanation:'',origin:'',validDays:90});
  const [decision,setDecision]=useState('');
  useEffect(()=>{api.list().then(setDefinitions).catch(e=>setError(e.message));api.canPublish().then(setPublisher);},[api,revision]);
  useEffect(()=>{setHistory([]);setProposals([]);if(selected)Promise.all([api.history(selected),api.proposals(selected)]).then(([h,p])=>{setHistory(h);setProposals(p);}).catch(e=>setError(e.message));},[api,selected,revision]);
  const run=async(fn)=>{setBusy(true);setError('');try{await fn();setRevision(n=>n+1);}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <section className="stir-panel"><h2>{t('refCommunity')}</h2><p>{t('refFree')}</p>
    {error&&<p role="alert">{t(error.replace('stir.',''))}</p>}
    <ReferenceSelector key={revision} sdk={sdk} t={t} value={selected} onChange={setSelected}/>
    <details><summary>{t('refCreateDefinition')}</summary><form className="stir-form" onSubmit={e=>{e.preventDefault();run(async()=>{const row=await api.create(d);setSelected(row.id);});}}>
      {['name','scope','quantityBasis','quantityUnit'].map(k=><label key={k}>{t('refField'+k)}<input required maxLength={k==='scope'?500:160} value={d[k]} onChange={e=>setD({...d,[k]:e.target.value})}/></label>)}
      <label>{t('refAttributes')}<textarea placeholder='{"weight":"500 g"}' onChange={e=>{try{setD({...d,attributes:JSON.parse(e.target.value||'{}')});e.target.setCustomValidity('');}catch{e.target.setCustomValidity(t('refInvalidJson'));}}}/></label>
      <button disabled={busy}>{t('refCreateDefinition')}</button></form></details>
    {selected&&<><ReferencePanel key={selected+revision} sdk={sdk} t={t} definitionId={selected}/>
      <details><summary>{t('refPropose')}</summary><form className="stir-form" onSubmit={e=>{e.preventDefault();run(()=>api.propose(selected,{...p,lowerValue:p.kind==='QUALITATIVE'?null:p.lowerValue,upperValue:p.kind==='QUALITATIVE'?null:p.upperValue}));}}>
        <label>{t('refKind')}<select value={p.kind} onChange={e=>setP({...p,kind:e.target.value})}>{['CONVENTION','QUALITATIVE','VALUE','BAND'].map(k=><option key={k} value={k}>{t('ref'+k)}</option>)}</select></label>
        {p.kind!=='QUALITATIVE'&&['lowerValue','upperValue'].map(k=><label key={k}>{t('refField'+k)}<input type="number" min="0" step="0.01" required value={p[k]} onChange={e=>setP({...p,[k]:e.target.value})}/></label>)}
        {['explanation','origin'].map(k=><label key={k}>{t('refField'+k)}<textarea required maxLength={k==='origin'?100:2000} value={p[k]} onChange={e=>setP({...p,[k]:e.target.value})}/></label>)}
        <label>{t('refDays')}<input type="number" min="1" max="365" required value={p.validDays} onChange={e=>setP({...p,validDays:Number(e.target.value)})}/></label>
        <button disabled={busy}>{t('refPropose')}</button></form></details>
      <h3>{t('refProposals')}</h3>{publisher&&<label>{t('refDecision')}<textarea maxLength={2000} value={decision} onChange={e=>setDecision(e.target.value)}/></label>}
      {proposals.map(row=><article key={row.id}><p>{t('ref'+row.kind)}: {row.lower_value} – {row.upper_value} · {row.explanation}</p>{publisher&&!history.some(h=>h.proposal_id===row.id)&&<button disabled={busy||!decision.trim()} onClick={()=>run(()=>api.publish(row.id,decision))}>{t('refPublish')}</button>}</article>)}
      <h3>{t('refHistory')}</h3>{history.map(row=><article key={row.id}><p>v{row.version} · {t('ref'+row.kind)}: {row.lower_value} – {row.upper_value} · {row.explanation}</p><p>{row.decision} · {row.valid_from} – {row.valid_until}</p></article>)}
    </>}
  </section>;
}

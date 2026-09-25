import { marketGovernanceApi, referenceApi } from './api.js';
import { getGovernanceSigner, hasGovernanceKey, canonicalText, digestOf, messageForStoredPayload,
  messageForOwnPayload, DOMAIN, GUARDIAN_DOMAIN, POSSESSION_DOMAIN, BOOTSTRAP_DOMAIN,
  INITIAL_CONSTITUTION } from './governance-signer.js';
const React=window.__IDAX_MODULE_SDK__.React;
const {useState,useEffect,useMemo}=React;

const ORDINALS=[1,2,3,4,5,6,7];
const uuid=()=>crypto.randomUUID();

async function copy(text) { try{await navigator.clipboard.writeText(text);}catch{/* selectable text remains visible */} }

/** Generic device-local governance signing tool. Never talks to STIR's backend - it only ever
 * turns a pasted task blob into a result blob, using a non-extractable key stored on THIS
 * device for (authorityId, role). Works for bootstrap invitations/signatures, proposal
 * signatures, guardian/possession signatures and suspension signatures alike, since all of them
 * reduce to the same two primitives: "give me my public key for this role" (INVITATION) and
 * "sign this exact text with this role's key" (SIGN). */
export function GovernanceSignTool({t}) {
  const [input,setInput]=useState(''),[output,setOutput]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const process=async()=>{
    setBusy(true);setError('');setOutput('');
    try{
      const task=JSON.parse(input);
      if(!task||!task.authorityId||!task.role) throw new Error(t('govInvalidTask'));
      if(task.kind==='INVITATION') {
        const signer=await getGovernanceSigner(task.authorityId,task.role);
        setOutput(JSON.stringify({kind:'CONTRIBUTION',role:task.role,controllerId:task.controllerId,
          credentialId:task.credentialId,publicKey:signer.publicKeyBase64url},null,1));
      } else if(task.kind==='SIGN') {
        if(!task.domain||typeof task.canonicalText!=='string') throw new Error(t('govInvalidTask'));
        const already=await hasGovernanceKey(task.authorityId,task.role);
        if(!already) throw new Error(t('govNoLocalKeyForRole'));
        const signer=await getGovernanceSigner(task.authorityId,task.role);
        const signature=await signer.sign(messageForStoredPayload(task.domain,task.canonicalText));
        setOutput(JSON.stringify({kind:'SIGNATURE',role:task.role,signature},null,1));
      } else throw new Error(t('govInvalidTask'));
    }catch(e){setError(e.message||String(e));}finally{setBusy(false);}
  };
  return <section className="stir-panel"><h3>{t('govSignToolTitle')}</h3><p>{t('govSignToolHint')}</p>
    <label className="stir-wide">{t('govPasteTask')}<textarea data-testid="sign-tool-input" rows={6} value={input} onChange={e=>setInput(e.target.value)}/></label>
    {error&&<p role="alert">{error}</p>}
    <div className="stir-actions"><button data-testid="sign-tool-process" disabled={busy||!input.trim()} onClick={process}>{t('govProcess')}</button></div>
    {output&&<><label className="stir-wide">{t('govResult')}<textarea data-testid="sign-tool-output" rows={6} readOnly value={output}/></label><button type="button" onClick={()=>copy(output)}>{t('govCopy')}</button></>}
  </section>;
}

function SeatRow({t,role,label,seat,onChange}) {
  const generate=async()=>{const signer=await getGovernanceSigner(seat.authorityId,role);onChange({...seat,publicKey:signer.publicKeyBase64url});};
  const invitation=JSON.stringify({kind:'INVITATION',authorityId:seat.authorityId,role,controllerId:seat.controllerId,credentialId:seat.credentialId});
  const importContribution=(text)=>{try{const c=JSON.parse(text);if(c.kind!=='CONTRIBUTION'||c.role!==role)throw new Error();onChange({...seat,controllerId:c.controllerId,credentialId:c.credentialId,publicKey:c.publicKey});}catch{/* ignore malformed paste until corrected */}};
  return <article className="stir-form">
    <h4>{label}</h4>
    <label>{t('govControllerId')}<input value={seat.controllerId} onChange={e=>onChange({...seat,controllerId:e.target.value,publicKey:''})}/></label>
    <label>{t('govCredentialId')}<input value={seat.credentialId} onChange={e=>onChange({...seat,credentialId:e.target.value,publicKey:''})}/></label>
    {seat.publicKey?<p>{t('govPublicKey')}: <code>{seat.publicKey}</code></p>:<>
      <div className="stir-actions"><button type="button" onClick={generate}>{t('govGenerateHere')}</button></div>
      <details><summary>{t('govExportInvitation')}</summary><textarea rows={4} readOnly value={invitation}/><button type="button" onClick={()=>copy(invitation)}>{t('govCopy')}</button></details>
      <details><summary>{t('govImportContribution')}</summary><textarea rows={4} onBlur={e=>importContribution(e.target.value)} placeholder='{"kind":"CONTRIBUTION",...}'/></details>
    </>}
  </article>;
}

export function BootstrapWizard({sdk,t,communityId,onDone}) {
  const api=useMemo(()=>marketGovernanceApi(sdk,sdk.activeTenantId),[sdk.activeTenantId]);
  const [authorityId]=useState(uuid());
  const [seats,setSeats]=useState(()=>ORDINALS.map(ordinal=>({authorityId,ordinal,controllerId:uuid(),credentialId:uuid(),publicKey:''})));
  const [guardian,setGuardian]=useState({authorityId,controllerId:uuid(),credentialId:uuid(),publicKey:''});
  const [payload,setPayload]=useState(null),[payloadText,setPayloadText]=useState(''),[signatures,setSignatures]=useState({});
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const allKeysReady=seats.every(s=>s.publicKey)&&guardian.publicKey;
  const buildPayload=async()=>{
    const ordered=[...seats].sort((a,b)=>a.ordinal-b.ordinal);
    const constitutionDigest=await digestOf(INITIAL_CONSTITUTION);
    const value={format:'STIR-SEVEN-KEYS-BOOTSTRAP-1',tenantId:sdk.activeTenantId,communityId,authorityId,
      seats:ordered.map(s=>({ordinal:s.ordinal,controllerId:s.controllerId,credentialId:s.credentialId,publicKey:s.publicKey})),
      guardianCredentialId:guardian.credentialId,guardianPublicKey:guardian.publicKey,constitutionDigest};
    const text=canonicalText(value);
    setPayload(value);setPayloadText(text);
  };
  const signTask=(role)=>JSON.stringify({kind:'SIGN',authorityId,role,domain:BOOTSTRAP_DOMAIN,canonicalText:payloadText});
  const importSignature=(role,text)=>{try{const r=JSON.parse(text);if(r.kind!=='SIGNATURE'||r.role!==role)throw new Error();setSignatures(prev=>({...prev,[role]:r.signature}));}catch{/* ignore malformed paste until corrected */}};
  const signHere=async(role)=>{const signer=await getGovernanceSigner(authorityId,role);const signature=await signer.sign(messageForStoredPayload(BOOTSTRAP_DOMAIN,payloadText));setSignatures(prev=>({...prev,[role]:signature}));};
  const allSigned=payload&&seats.every(s=>signatures['seat-'+s.ordinal])&&signatures.guardian;
  const submit=async()=>{
    setBusy(true);setError('');
    try{
      const ordered=[...seats].sort((a,b)=>a.ordinal-b.ordinal);
      await api.bootstrap({authorityId,communityId,
        seats:ordered.map(s=>({ordinal:s.ordinal,controllerId:s.controllerId,credentialId:s.credentialId,publicKey:s.publicKey,possessionSignature:signatures['seat-'+s.ordinal]})),
        guardianCredentialId:guardian.credentialId,guardianPublicKey:guardian.publicKey,guardianPossessionSignature:signatures.guardian});
      onDone();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <section className="stir-panel"><h2>{t('govBootstrapStart')}</h2><p>{t('govNoAuthorityHint')}</p>
    <p><small>{t('govAuthorityId')}: <code>{authorityId}</code> · {t('govCommunityId')}: <code>{communityId}</code></small></p>
    {error&&<p role="alert">{t(error.replace('stir.',''))}</p>}
    {!payload&&<><h3>{t('govBootstrapStep1')}</h3>
      {seats.map(seat=><SeatRow key={seat.ordinal} t={t} role={'seat-'+seat.ordinal} label={t('govSeat')+' '+seat.ordinal} seat={seat}
        onChange={next=>setSeats(prev=>prev.map(s=>s.ordinal===seat.ordinal?next:s))}/>)}
      <SeatRow t={t} role="guardian" label={t('govGuardian')} seat={guardian} onChange={setGuardian}/>
      <div className="stir-actions"><button disabled={!allKeysReady} onClick={buildPayload}>{t('govBuildPayload')}</button></div>
    </>}
    {payload&&!allSigned&&<><h3>{t('govBootstrapStep2')}</h3>
      <details open><summary>{t('govFullPayload')}</summary><p>{t('govFullPayloadHint')}</p><textarea rows={8} readOnly value={payloadText}/><button type="button" onClick={()=>copy(payloadText)}>{t('govCopy')}</button></details>
      {[...seats.map(s=>['seat-'+s.ordinal,t('govSeat')+' '+s.ordinal]),['guardian',t('govGuardian')]].map(([role,label])=>
        <article key={role} className="stir-form"><h4>{label}</h4>
          {signatures[role]?<p>{t('govSignatureReady')}</p>:<>
            <div className="stir-actions"><button type="button" onClick={()=>signHere(role)}>{t('govSignWithDeviceKey')}</button></div>
            <details><summary>{t('govExportSignTask')}</summary><textarea rows={4} readOnly value={signTask(role)}/><button type="button" onClick={()=>copy(signTask(role))}>{t('govCopy')}</button></details>
            <details><summary>{t('govImportSignature')}</summary><textarea rows={4} onBlur={e=>importSignature(role,e.target.value)} placeholder='{"kind":"SIGNATURE",...}'/></details>
          </>}
        </article>)}
    </>}
    {allSigned&&<><h3>{t('govBootstrapStep3')}</h3><p>{t('govAllCollected')}</p>
      <div className="stir-actions"><button disabled={busy} onClick={submit}>{t('govSubmitBootstrap')}</button></div></>}
  </section>;
}

const CONSTITUTION_FIXED=new Set(['schema','provenanceRequired','historyImmutable','guardianMayGovern','maximumParticipantShareCeiling','constitutionalThreshold']);

function ProposeForm({t,api,communityId,data,onCreated}) {
  const [action,setAction]=useState('AMEND_CONSTITUTION');
  const [constitution,setConstitution]=useState(()=>({...data.constitution}));
  useEffect(()=>{setConstitution({...data.constitution});},[data.constitutionVersion]);
  const [seatOrdinal,setSeatOrdinal]=useState(1);
  const [newCredentialId,setNewCredentialId]=useState(uuid()),[newPublicKey,setNewPublicKey]=useState('');
  const [guardianCredentialId,setGuardianCredentialId]=useState(uuid()),[guardianPublicKey,setGuardianPublicKey]=useState('');
  const [finalResolutionId,setFinalResolutionId]=useState(''),[finalResolutionDigest,setFinalResolutionDigest]=useState('');
  const [reason,setReason]=useState(''),[evidenceRefs,setEvidenceRefs]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const suspendedSeats=data.seats.filter(s=>s.status==='EMERGENCY_SUSPENDED');
  useEffect(()=>{
    if((action!=='ROTATE_CREDENTIAL'&&action!=='REPLACE_CONTROLLER')||suspendedSeats.some(s=>s.ordinal===Number(seatOrdinal)))return;
    if(suspendedSeats.length)setSeatOrdinal(suspendedSeats[0].ordinal);
  },[action,suspendedSeats.map(s=>s.ordinal).join(',')]);
  const seat=data.seats.find(s=>s.ordinal===Number(seatOrdinal));
  const submit=async(e)=>{
    e.preventDefault();setBusy(true);setError('');
    try{
      let after,affectedFields;
      const refs=evidenceRefs.split('\n').map(s=>s.trim()).filter(Boolean);
      if(action==='AMEND_CONSTITUTION') {
        after=constitution;
        affectedFields=Object.keys(data.constitution).filter(k=>String(data.constitution[k])!==String(constitution[k]));
      } else if(action==='REMOVE_GUARDIAN') {
        after={guardianCredentialId:String(data.guardianCredentialId),status:'REMOVED'};affectedFields=['guardianCredentialId','status'];
      } else if(action==='APPOINT_GUARDIAN') {
        after={guardianCredentialId,publicKey:guardianPublicKey};affectedFields=['guardianCredentialId','publicKey'];
      } else if(action==='ROTATE_CREDENTIAL') {
        after={affectedSeat:Number(seatOrdinal),oldCredentialId:seat.credential_id,newCredentialId,newPublicKey,controllerId:seat.controller_id,continuityEvidenceRefs:refs,reason};
        affectedFields=['affectedSeat','oldCredentialId','newCredentialId','newPublicKey','controllerId','continuityEvidenceRefs','reason'];
      } else {
        after={affectedSeat:Number(seatOrdinal),oldCredentialId:seat.credential_id,newCredentialId,newPublicKey,controllerId:uuid(),finalResolutionId,finalResolutionDigest,reason};
        affectedFields=['affectedSeat','oldCredentialId','newCredentialId','newPublicKey','controllerId','finalResolutionId','finalResolutionDigest','reason'];
      }
      const created=await api.propose(communityId,{proposalId:uuid(),actionType:action,after,affectedFields,reason,evidenceRefs:refs});
      onCreated(created);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <details><summary>{t('govNewProposal')}</summary><form className="stir-form" onSubmit={submit}>
    <label>{t('govActionType')}<select value={action} onChange={e=>setAction(e.target.value)}>
      {['AMEND_CONSTITUTION','APPOINT_GUARDIAN','REMOVE_GUARDIAN','ROTATE_CREDENTIAL','REPLACE_CONTROLLER'].map(a=><option key={a} value={a}>{t('gov'+a)}</option>)}
    </select></label>
    {action==='AMEND_CONSTITUTION'&&<>
      <label>{t('govMinObservations')}<input type="number" min={5} value={constitution.minimumObservationFloor} onChange={e=>setConstitution({...constitution,minimumObservationFloor:Number(e.target.value)})}/></label>
      <label>{t('govMinParticipants')}<input type="number" min={6} value={constitution.minimumParticipantFloor} onChange={e=>setConstitution({...constitution,minimumParticipantFloor:Number(e.target.value)})}/></label>
      <label><input type="checkbox" checked={Boolean(constitution.independenceChecksRequired)} onChange={e=>setConstitution({...constitution,independenceChecksRequired:e.target.checked})}/>{t('govIndependenceChecks')}</label>
      <label><input type="checkbox" checked={Boolean(constitution.concentrationChecksRequired)} onChange={e=>setConstitution({...constitution,concentrationChecksRequired:e.target.checked})}/>{t('govConcentrationChecks')}</label>
      <p><small>{t('govFixedField')}: {[...CONSTITUTION_FIXED].map(k=>`${k}=${data.constitution[k]}`).join(', ')}</small></p>
    </>}
    {action==='APPOINT_GUARDIAN'&&<>
      <label>{t('govCredentialId')}<input value={guardianCredentialId} onChange={e=>setGuardianCredentialId(e.target.value)}/></label>
      <label>{t('govPublicKey')}<input required value={guardianPublicKey} onChange={e=>setGuardianPublicKey(e.target.value)}/></label>
    </>}
    {(action==='ROTATE_CREDENTIAL'||action==='REPLACE_CONTROLLER')&&<>
      <label>{t('govSeatOrdinal')}<select value={seatOrdinal} onChange={e=>setSeatOrdinal(e.target.value)}>{suspendedSeats.map(s=><option key={s.ordinal} value={s.ordinal}>{s.ordinal}</option>)}</select></label>
      {!suspendedSeats.length&&<p role="alert">{t('govRotateNeedsSuspendedSeat')}</p>}
      <label>{t('govCredentialId')}<input value={newCredentialId} onChange={e=>setNewCredentialId(e.target.value)}/></label>
      <label>{t('govPublicKey')}<input required value={newPublicKey} onChange={e=>setNewPublicKey(e.target.value)}/></label>
      {action==='REPLACE_CONTROLLER'&&<>
        <p role="alert">{t('govReplaceControllerWarning')}</p>
        <label>{t('govFinalResolutionId')}<input value={finalResolutionId} onChange={e=>setFinalResolutionId(e.target.value)}/></label>
        <label>{t('govFinalResolutionDigest')}<input value={finalResolutionDigest} onChange={e=>setFinalResolutionDigest(e.target.value)}/></label>
      </>}
    </>}
    <label className="stir-wide">{t('govReason')}<textarea data-testid="proposal-reason" required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <label className="stir-wide">{t('govEvidenceRefs')}<textarea rows={2} value={evidenceRefs} onChange={e=>setEvidenceRefs(e.target.value)}/></label>
    {error&&<p role="alert">{t(error.replace('stir.',''))}</p>}
    <button data-testid="proposal-submit" disabled={busy}>{t('govSubmitProposal')}</button>
  </form></details>;
}

function ProposalCard({t,api,data,authorityId,canPublish,proposal,onUpdate,onChange}) {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [guardianSig,setGuardianSig]=useState(''),[possessionSig,setPossessionSig]=useState('');
  // Signing/loading a payload never changes authority-level state (seats, constitution, guardian) -
  // patch this one proposal locally instead of a full refetch. Only activation can actually change
  // that state, so only activation pays for a full refresh(). Firing a full 5-request refetch after
  // every single seat signature (as this used to do) creates a trickling stream of async re-renders
  // that keeps shifting page layout for many seconds after a batch of signatures - long enough to
  // starve real users' attention and to make automated UI tests time out waiting for "stable" layout.
  const run=async(fn,{heavy}={})=>{setBusy(true);setError('');try{const next=await fn();if(heavy)onChange();else onUpdate(next);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const signedOrdinals=new Set((proposal.signatures||[]).map(s=>s.seat_ordinal));
  const [payloadJson,setPayloadJson]=useState(''),[importedSigs,setImportedSigs]=useState({});
  const loadPayload=()=>run(async()=>{const p=await api.signingPayload(proposal.id);setPayloadJson(p.payloadJson);return proposal;});
  const signWithDeviceKey=(seat)=>run(async()=>{
    const {payloadJson}=await api.signingPayload(proposal.id);
    const signer=await getGovernanceSigner(authorityId,'seat-'+seat.ordinal);
    const signatureBase64url=await signer.sign(messageForStoredPayload(DOMAIN,payloadJson));
    return api.sign(proposal.id,{seatOrdinal:seat.ordinal,credentialId:seat.credential_id,signatureBase64url});
  });
  const submitImported=(seat)=>run(async()=>api.sign(proposal.id,{seatOrdinal:seat.ordinal,credentialId:seat.credential_id,signatureBase64url:importedSigs[seat.ordinal]}));
  const activate=()=>run(async()=>{
    const needsRecovery=proposal.actionType==='ROTATE_CREDENTIAL'||proposal.actionType==='REPLACE_CONTROLLER';
    return api.activate(proposal.id,needsRecovery?{guardianSignature:guardianSig,newKeyPossessionSignature:possessionSig}:undefined);
  },{heavy:true});
  return <article className="stir-panel">
    <p><strong>{t('gov'+proposal.actionType)}</strong> · {t('govState'+proposal.state)} · {proposal.signatureCount}/{proposal.required}</p>
    {proposal.reason&&<p>{proposal.reason}</p>}
    {proposal.affectedFields&&<p><small>{proposal.affectedFields.map(k=>`${k}: ${String(proposal.after?.[k])}`).join(' · ')}</small></p>}
    <p><small>{proposal.beforeDigest} → {proposal.afterDigest}</small></p>
    {error&&<p role="alert">{t(error.replace('stir.',''))}</p>}
    {proposal.actionType==='REPLACE_CONTROLLER'&&<p role="alert">{t('govReplaceControllerWarning')}</p>}
    {proposal.state!=='ACTIVATED'&&canPublish&&<details><summary>{t('govSignatures')}</summary>
      {!payloadJson&&<button disabled={busy} type="button" onClick={loadPayload}>{t('govLoadPayload')}</button>}
      {payloadJson&&data.seats.filter(s=>s.status==='ACTIVE').map(seat=><div key={seat.ordinal}>
        {signedOrdinals.has(seat.ordinal)?<span>{t('govSeat')} {seat.ordinal}: {t('govSignatureReady')}</span>:<>
          <button disabled={busy} type="button" onClick={()=>signWithDeviceKey(seat)}>{t('govSignWithDeviceKey')} ({t('govSeat')} {seat.ordinal})</button>
          <details><summary>{t('govExportSignTask')}</summary><textarea rows={4} readOnly value={JSON.stringify({kind:'SIGN',authorityId,role:'seat-'+seat.ordinal,domain:DOMAIN,canonicalText:payloadJson})}/>
            <button type="button" onClick={()=>copy(JSON.stringify({kind:'SIGN',authorityId,role:'seat-'+seat.ordinal,domain:DOMAIN,canonicalText:payloadJson}))}>{t('govCopy')}</button></details>
          <details><summary>{t('govImportSignature')}</summary><textarea rows={4} onBlur={e=>{try{const r=JSON.parse(e.target.value);if(r.kind==='SIGNATURE'&&r.role==='seat-'+seat.ordinal)setImportedSigs(prev=>({...prev,[seat.ordinal]:r.signature}));}catch{/* ignore */}}}/>
            {importedSigs[seat.ordinal]&&<button disabled={busy} type="button" onClick={()=>submitImported(seat)}>{t('govSubmitProposal')}</button>}</details>
        </>}
      </div>)}
    </details>}
    {proposal.state!=='ACTIVATED'&&proposal.signatureCount>=proposal.required&&<details><summary>{t('govActivate')}</summary>
      {(proposal.actionType==='ROTATE_CREDENTIAL'||proposal.actionType==='REPLACE_CONTROLLER')&&<>
        <label>{t('govGuardianSignature')}<input value={guardianSig} onChange={e=>setGuardianSig(e.target.value)}/></label>
        <label>{t('govPossessionSignature')}<input value={possessionSig} onChange={e=>setPossessionSig(e.target.value)}/></label>
      </>}
      <div className="stir-actions"><button disabled={busy} onClick={activate}>{t('govActivate')}</button></div>
    </details>}
  </article>;
}

export function GuardianPanel({t,api,communityId,authorityId,data,onChange}) {
  const [seatOrdinal,setSeatOrdinal]=useState(1),[reasonCode,setReasonCode]=useState(''),[evidenceRefs,setEvidenceRefs]=useState('');
  const [signature,setSignature]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const seat=data.seats.find(s=>s.ordinal===Number(seatOrdinal));
  const declaredAt=useMemo(()=>new Date().toISOString(),[]);
  const payload=useMemo(()=>({format:'STIR-KEY-SUSPENSION-1',tenantId:data.tenantId,communityId,authorityId,seat:Number(seatOrdinal),
    credentialId:seat?.credential_id,reasonCode,evidenceRefs:evidenceRefs.split('\n').map(s=>s.trim()).filter(Boolean).sort(),
    sequence:data.nextSequence,declaredAt}),[seatOrdinal,reasonCode,evidenceRefs,seat,data,communityId,authorityId,declaredAt]);
  const payloadText=canonicalText(payload);
  const signHere=async()=>{const signer=await getGovernanceSigner(authorityId,'guardian');setSignature(await signer.sign(messageForOwnPayload(GUARDIAN_DOMAIN,payload)));};
  const signTask=JSON.stringify({kind:'SIGN',authorityId,role:'guardian',domain:GUARDIAN_DOMAIN,canonicalText:payloadText});
  const submit=async()=>{
    setBusy(true);setError('');
    try{await api.suspend(communityId,{seatOrdinal:Number(seatOrdinal),credentialId:seat.credential_id,expectedSequence:data.nextSequence,
      declaredAt,reasonCode,evidenceRefs:evidenceRefs.split('\n').map(s=>s.trim()).filter(Boolean),guardianSignature:signature});onChange();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  if(data.guardianStatus!=='ACTIVE') return <p>{t('govGuardianStatus')}: {data.guardianStatus}</p>;
  return <details><summary>{t('govSuspendSeat')}</summary>
    <label>{t('govSeatOrdinal')}<select value={seatOrdinal} onChange={e=>setSeatOrdinal(e.target.value)}>{data.seats.filter(s=>s.status==='ACTIVE').map(s=><option key={s.ordinal} value={s.ordinal}>{s.ordinal}</option>)}</select></label>
    <label>{t('govSuspendReasonCode')}<input required value={reasonCode} onChange={e=>setReasonCode(e.target.value)}/></label>
    <label className="stir-wide">{t('govEvidenceRefs')}<textarea rows={2} value={evidenceRefs} onChange={e=>setEvidenceRefs(e.target.value)}/></label>
    {error&&<p role="alert">{t(error.replace('stir.',''))}</p>}
    {signature?<p>{t('govSignatureReady')}</p>:<>
      <div className="stir-actions"><button type="button" onClick={signHere}>{t('govSignWithDeviceKey')}</button></div>
      <details><summary>{t('govExportSignTask')}</summary><textarea rows={4} readOnly value={signTask}/><button type="button" onClick={()=>copy(signTask)}>{t('govCopy')}</button></details>
      <details><summary>{t('govImportSignature')}</summary><textarea rows={4} onBlur={e=>{try{const r=JSON.parse(e.target.value);if(r.kind==='SIGNATURE'&&r.role==='guardian')setSignature(r.signature);}catch{/* ignore */}}}/></details>
    </>}
    <div className="stir-actions"><button disabled={busy||!signature||!reasonCode.trim()} onClick={submit}>{t('govSuspendSubmit')}</button></div>
  </details>;
}

export function AuthorityDashboard({sdk,t,communityId,data,onChange}) {
  const api=useMemo(()=>marketGovernanceApi(sdk,sdk.activeTenantId),[sdk.activeTenantId]);
  const refApi=useMemo(()=>referenceApi(sdk,sdk.activeTenantId),[sdk.activeTenantId]);
  const [proposals,setProposals]=useState([]),[events,setEvents]=useState([]),[audit,setAudit]=useState(null),[history,setHistory]=useState([]);
  const [canPublish,setCanPublish]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{Promise.all([api.proposals(communityId),api.events(communityId),api.audit(communityId),api.credentials(communityId)])
    .then(([p,e,a,h])=>{setProposals(p);setEvents(e);setAudit(a);setHistory(h);});refApi.canPublish().then(setCanPublish);},[api,refApi,communityId,revision]);
  const refresh=()=>{onChange();setRevision(n=>n+1);};
  const updateProposal=(updated)=>setProposals(prev=>prev.map(p=>p.id===updated.id?updated:p));
  const authorityId=data.authorityId;
  return <section className="stir-panel"><h2>{t('govTitle')}</h2>
    <p>{t('govAuthorityId')}: <code>{authorityId}</code></p>
    <p>{t('govConstitutionVersion')}: {data.constitutionVersion} · SHA-256: <code>{data.constitutionDigest}</code></p>
    <p>{t('govGuardianStatus')}: {data.guardianStatus} · <small>{t('govGuardianLimitedNote')}</small></p>
    <h3>{t('govSeats')}</h3>
    <ul>{data.seats.map(s=><li key={s.ordinal}>{t('govSeat')} {s.ordinal}: {s.status} · <code>{s.public_key.slice(0,16)}…</code></li>)}</ul>
    {canPublish?<ProposeForm t={t} api={api} communityId={communityId} data={{...data,tenantId:sdk.activeTenantId}} onCreated={refresh}/>:<p>{t('govPublisherRequired')}</p>}
    <h3>{t('govProposals')}</h3>
    {proposals.length===0?<p>{t('govNoProposals')}</p>:proposals.map(p=><ProposalCard key={p.id} t={t} api={api} data={{...data,tenantId:sdk.activeTenantId}} authorityId={authorityId} canPublish={canPublish} proposal={p} onUpdate={updateProposal} onChange={refresh}/>)}
    <h3>{t('govGuardianStatus')}</h3>
    <GuardianPanel t={t} api={api} communityId={communityId} authorityId={authorityId} data={{...data,tenantId:sdk.activeTenantId}} onChange={refresh}/>
    <h3>{t('govCredentialHistory')}</h3>
    <ul>{history.map((h,i)=><li key={i}>{t('govSeat')} {h.seat_ordinal} · {h.status} · <code>{h.credential_id}</code></li>)}</ul>
    <h3>{t('govAuditLog')}</h3>
    {audit&&<p>{t('govAuditValid')}: {String(audit.valid)} · {audit.eventCount} · SHA-256: <code>{audit.latestDigest}</code></p>}
    <ul>{events.map(e=><li key={e.sequence}>#{e.sequence} {e.event_type}</li>)}</ul>
    <GovernanceSignTool t={t}/>
  </section>;
}

export function Governance({sdk,t}) {
  const api=useMemo(()=>marketGovernanceApi(sdk,sdk.activeTenantId),[sdk.activeTenantId]);
  const refApi=useMemo(()=>referenceApi(sdk,sdk.activeTenantId),[sdk.activeTenantId]);
  const [phase,setPhase]=useState('loading'),[communityId,setCommunityId]=useState(null),[data,setData]=useState(null),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let live=true;
    // Only show the full-page loading placeholder on the very first fetch. A later revision
    // bump (a signature submitted, a proposal activated, a seat suspended...) must refresh the
    // authority data quietly in place - flashing back to 'loading' would unmount the whole
    // dashboard, including every in-progress ProposalCard's locally-held payload/signature state
    // and any <details> the operator has open mid-ceremony.
    if(revision===0)setPhase('loading');
    (async()=>{
      let c;
      try{c=await refApi.community();}catch{if(live)setPhase('noCommunity');return;}
      if(!live)return;
      setCommunityId(c.communityId);
      try{const view=await api.view(c.communityId);if(live){setData(view);setPhase('active');}}
      catch{if(live)setPhase('noAuthority');}
    })();
    return ()=>{live=false;};
  },[api,refApi,revision]);
  if(phase==='loading')return <p>{t('govLoading')}</p>;
  if(phase==='noCommunity')return <section className="stir-panel"><h2>{t('govTitle')}</h2><p role="alert">{t('govNoCommunity')}</p><p>{t('govNoCommunityHint')}</p></section>;
  if(phase==='noAuthority')return <BootstrapWizard sdk={sdk} t={t} communityId={communityId} onDone={()=>setRevision(n=>n+1)}/>;
  return <AuthorityDashboard sdk={sdk} t={t} communityId={communityId} data={data} onChange={()=>setRevision(n=>n+1)}/>;
}

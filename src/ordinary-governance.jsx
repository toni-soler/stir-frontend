// Ordinary community governance (ORDINARY_GOVERNANCE.md): quorum-based, explicitly separate from
// Seven Keys (governance.jsx). Kept in its own file/API surface (ordinaryGovernanceApi in api.js)
// deliberately - a proposal/vote/quorum capability that has nothing route-, layout- or branding-
// specific baked in, so a different presentation could reuse the same logic without pulling in
// this screen too.
import { ordinaryGovernanceApi, referenceApi } from './api.js';
const React = window.__IDAX_MODULE_SDK__.React;
const { useState, useEffect, useMemo } = React;

const CHOICES = ['APPROVE', 'REJECT', 'ABSTAIN'];

function ProposalCard({ sdk, t, proposal, onChanged }) {
  const api = useMemo(() => ordinaryGovernanceApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [detail, setDetail] = useState(proposal);
  const [votes, setVotes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = () => Promise.all([api.proposal(proposal.id), api.votes(proposal.id)]).then(([p, v]) => { setDetail(p); setVotes(v); });
  useEffect(() => { load().catch(e => setError(e.message)); }, [proposal.id]);
  const run = async (fn) => { setBusy(true); setError(''); try { await fn(); await load(); onChanged?.(); } catch (e) { setError(e.status === 403 ? t('govNotEligible') : t(e.message.replace('stir.', ''))); } finally { setBusy(false); } };
  const cast = (choice) => run(() => api.vote(proposal.id, choice));
  const close = () => run(() => api.close(proposal.id));
  const execute = () => run(() => api.execute(proposal.id));
  return <article className="stir-panel">
    <p><strong>{t('govType' + detail.proposal_type)}</strong> · <strong>{t('govStatus' + detail.status)}</strong>
      {detail.stale && <> · <span role="alert">{t('govStale')}</span></>}</p>
    <p>{t('govVotingWindow')}: {detail.voting_opens_at} – {detail.voting_closes_at}</p>
    <p>{t('govElectorateSize')}: {detail.electorateSize} · {t('govVotesApprove')}: {detail.votesAPPROVE} · {t('govVotesReject')}: {detail.votesREJECT} · {t('govVotesAbstain')}: {detail.votesABSTAIN}</p>
    {error && <p role="alert">{error}</p>}
    {detail.status === 'OPEN' && <div className="stir-actions">
      {CHOICES.map(c => <button key={c} disabled={busy} className={c === 'APPROVE' ? '' : 'secondary'} onClick={() => cast(c)}>{t('govCast' + c)}</button>)}
      <button disabled={busy} className="secondary" onClick={close}>{t('govCheckClose')}</button>
    </div>}
    {detail.status === 'APPROVED' && !detail.stale && <button disabled={busy} onClick={execute}>{t('govExecute')}</button>}
    <details><summary>{t('govBallot')}</summary>
      {votes.length === 0 ? <p>{t('govNoVotesYet')}</p> : votes.map(v => <p key={v.voter_id}><code>{String(v.voter_id).slice(0, 8)}</code> · {t('govCast' + v.choice)} · {v.cast_at}</p>)}
    </details>
  </article>;
}

/** Publisher/elector toolkit: electorate roll, voting policy, and the proposal lifecycle itself.
 * When ordinaryGovernanceEnabled is false (the default), this only ever shows the opt-in toggle -
 * every other publisher action in references.jsx keeps working exactly as before. */
export function OrdinaryGovernancePanel({ sdk, t, definitionId, communityId, canManage }) {
  const api = useMemo(() => ordinaryGovernanceApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const refApi = useMemo(() => referenceApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [settings, setSettings] = useState(null);
  const [members, setMembers] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [referenceProposals, setReferenceProposals] = useState([]);
  const [newMember, setNewMember] = useState('');
  const [policyForm, setPolicyForm] = useState({ quorumNumerator: 1, quorumDenominator: 2, approvalNumerator: 2, approvalDenominator: 3, votingWindowHours: 168, abstentionRule: 'COUNTS_TOWARD_QUORUM_NOT_APPROVAL', explanation: '' });
  const [policyChangeForm, setPolicyChangeForm] = useState(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!communityId) return;
    setError('');
    api.settings(communityId).then(setSettings).catch(e => setError(e.message));
    api.members(communityId).then(setMembers).catch(() => {});
    api.currentPolicy(communityId).then(setPolicy).catch(() => setPolicy(null));
    api.proposals(communityId).then(setProposals).catch(() => {});
    refApi.proposals(definitionId).then(setReferenceProposals).catch(() => {});
  }, [api, refApi, communityId, definitionId, revision]);
  const run = async (fn) => { setBusy(true); setError(''); try { await fn(); setRevision(n => n + 1); } catch (e) { setError(t(e.message.replace('stir.', ''))); } finally { setBusy(false); } };
  if (!communityId) return null;
  const proposalsForThisDefinition = proposals.filter(p => p.definition_id === definitionId);
  const votableReferenceProposals = referenceProposals.filter(rp => !proposalsForThisDefinition.some(p => p.status !== 'REJECTED' && p.status !== 'EXPIRED'));
  return <details><summary>{t('govOrdinaryTitle')}</summary>
    <p>{t('govOrdinaryHint')}</p>
    {error && <p role="alert">{error}</p>}
    {canManage && <label><input type="checkbox" checked={Boolean(settings?.ordinaryGovernanceEnabled)} disabled={busy} onChange={e => run(() => api.setEnabled(communityId, e.target.checked))}/>{t('govEnabled')}</label>}
    {!settings?.ordinaryGovernanceEnabled && <p>{t('govDisabledHint')}</p>}
    {settings?.ordinaryGovernanceEnabled && <>
      {canManage && <details><summary>{t('govElectorate')}</summary>
        <p>{t('govElectorateHint')}</p>
        <ul>{members.map(m => <li key={m.user_id}><code>{String(m.user_id).slice(0, 8)}</code> <button type="button" className="stir-link" disabled={busy} onClick={() => run(() => api.removeMember(communityId, m.user_id))}>{t('govRemoveMember')}</button></li>)}</ul>
        <form className="stir-form" onSubmit={e => { e.preventDefault(); run(() => api.addMember(communityId, newMember.trim())).then(() => setNewMember('')); }}>
          <label>{t('govMemberUserId')}<input required value={newMember} onChange={e => setNewMember(e.target.value)}/></label>
          <button disabled={busy}>{t('govAddMember')}</button>
        </form>
      </details>}
      {canManage && <details><summary>{t('govPolicyConfig')}</summary>
        <p>{t('govPolicyHint')}</p>
        {policy && <p>{t('govCurrentPolicy')}: {t('govQuorum')} {policy.quorum_numerator}/{policy.quorum_denominator} · {t('govApproval')} {policy.approval_numerator}/{policy.approval_denominator} · {t('govWindowHours')} {policy.voting_window_hours}h · v{policy.version}</p>}
        <form className="stir-form" onSubmit={e => { e.preventDefault(); run(() => api.setPolicy(communityId, policyForm)); }}>
          <label>{t('govQuorumNumerator')}<input type="number" min={1} required value={policyForm.quorumNumerator} onChange={e => setPolicyForm({ ...policyForm, quorumNumerator: Number(e.target.value) })}/></label>
          <label>{t('govQuorumDenominator')}<input type="number" min={1} required value={policyForm.quorumDenominator} onChange={e => setPolicyForm({ ...policyForm, quorumDenominator: Number(e.target.value) })}/></label>
          <label>{t('govApprovalNumerator')}<input type="number" min={1} required value={policyForm.approvalNumerator} onChange={e => setPolicyForm({ ...policyForm, approvalNumerator: Number(e.target.value) })}/></label>
          <label>{t('govApprovalDenominator')}<input type="number" min={1} required value={policyForm.approvalDenominator} onChange={e => setPolicyForm({ ...policyForm, approvalDenominator: Number(e.target.value) })}/></label>
          <label>{t('govWindowHours')}<input type="number" min={1} max={2160} required value={policyForm.votingWindowHours} onChange={e => setPolicyForm({ ...policyForm, votingWindowHours: Number(e.target.value) })}/></label>
          <label>{t('govAbstentionRule')}<select value={policyForm.abstentionRule} onChange={e => setPolicyForm({ ...policyForm, abstentionRule: e.target.value })}>
            <option value="COUNTS_TOWARD_QUORUM_NOT_APPROVAL">{t('govAbstentionCountsQuorum')}</option>
            <option value="DOES_NOT_COUNT_TOWARD_QUORUM">{t('govAbstentionExcluded')}</option>
          </select></label>
          <label className="stir-wide">{t('refPolicyExplanation')}<textarea required maxLength={2000} value={policyForm.explanation} onChange={e => setPolicyForm({ ...policyForm, explanation: e.target.value })}/></label>
          <button disabled={busy}>{t('govSavePolicy')}</button>
        </form>
      </details>}
      <details><summary>{t('govStartVote')}</summary>
        <p>{t('govStartVoteHint')}</p>
        {votableReferenceProposals.length === 0 ? <p>{t('govNoVotableProposals')}</p> : votableReferenceProposals.map(rp =>
          <p key={rp.id}><code>{String(rp.id).slice(0, 8)}</code> · {t('ref' + rp.kind)}: {rp.lower_value} – {rp.upper_value}
            <button type="button" disabled={busy} onClick={() => run(() => api.proposePublishReference(definitionId, rp.id))}>{t('govStartVoteAction')}</button></p>)}
        <button type="button" disabled={busy} onClick={() => setPolicyChangeForm(policyChangeForm ? null : { windowDays: 90, minimumObservations: 5, minimumParticipants: 6, maximumParticipantShare: '0.40', freshnessDays: 30, explanation: '' })}>{t('govProposePolicyChange')}</button>
        {policyChangeForm && <form className="stir-form" onSubmit={e => { e.preventDefault(); run(() => api.proposePolicyChange(definitionId, policyChangeForm)).then(() => setPolicyChangeForm(null)); }}>
          <label>{t('refWindowDays')}<input type="number" min={7} max={365} required value={policyChangeForm.windowDays} onChange={e => setPolicyChangeForm({ ...policyChangeForm, windowDays: Number(e.target.value) })}/></label>
          <label>{t('refMinObservations')}<input type="number" min={5} required value={policyChangeForm.minimumObservations} onChange={e => setPolicyChangeForm({ ...policyChangeForm, minimumObservations: Number(e.target.value) })}/></label>
          <label>{t('refMinParticipants')}<input type="number" min={6} required value={policyChangeForm.minimumParticipants} onChange={e => setPolicyChangeForm({ ...policyChangeForm, minimumParticipants: Number(e.target.value) })}/></label>
          <label>{t('refMaxParticipantShare')}<input type="number" min="0.1" max="0.5" step="0.01" required value={policyChangeForm.maximumParticipantShare} onChange={e => setPolicyChangeForm({ ...policyChangeForm, maximumParticipantShare: e.target.value })}/></label>
          <label>{t('refFreshnessDays')}<input type="number" min={1} required value={policyChangeForm.freshnessDays} onChange={e => setPolicyChangeForm({ ...policyChangeForm, freshnessDays: Number(e.target.value) })}/></label>
          <label className="stir-wide">{t('refPolicyExplanation')}<textarea required maxLength={2000} value={policyChangeForm.explanation} onChange={e => setPolicyChangeForm({ ...policyChangeForm, explanation: e.target.value })}/></label>
          <button disabled={busy}>{t('govOrdinarySubmitProposal')}</button>
        </form>}
      </details>
      <h4>{t('govOrdinaryProposals')}</h4>
      {proposalsForThisDefinition.length === 0 ? <p>{t('govNoProposalsYet')}</p> :
        proposalsForThisDefinition.map(p => <ProposalCard key={p.id} sdk={sdk} t={t} proposal={p} onChanged={() => setRevision(n => n + 1)}/>)}
    </>}
  </details>;
}

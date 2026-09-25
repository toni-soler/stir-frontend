import test from 'node:test';
import assert from 'node:assert/strict';
import {comparison,proposalDeviation} from '../src/reference-comparison.js';
import {offerPayload,listingPayload,negotiationApi} from '../src/api.js';
import fs from 'node:fs';
const d={unit_ref:'unit',quantity_unit:'hour',quantity_basis:'1'},r={lower_value:'10',upper_value:'20'};
test('below, within and above guidance all remain valid proposals',()=>{
  for(const [amount,label] of [['1','BELOW'],['15','WITHIN'],['1000','ABOVE']]){
    const offer={proposedAmount:amount,quantity:'1',unitLabel:'hour',proposedUnitRef:'unit'};
    assert.equal(comparison(offer,d,r),label);assert.equal(offerPayload(offer).proposedAmount,amount);
  }
});
test('different units and absent quantities never imply convertibility',()=>{
  assert.equal(comparison({proposedAmount:'10',quantity:1,unitLabel:'hour',proposedUnitRef:'EUR'},d,r),'NOT_COMPARABLE');
  assert.equal(comparison({proposedAmount:10},d,r),'NOT_COMPARABLE');
});
test('bilateral statistics consent is opt-in and travels independently of economic terms',async()=>{
  assert.equal(offerPayload({message:'x'}).shareReferenceObservation,undefined);
  assert.equal(offerPayload({message:'x',shareReferenceObservation:true}).shareReferenceObservation,true);
  let payload;const sdk={fetchWithAuth:async(url,opts)=>{payload=JSON.parse(opts.body);return {ok:true,text:async()=>'{}'};}};
  await negotiationApi(sdk,'tenant').accept('n','o',1,true);
  assert.deepEqual(payload,{offerId:'o',expectedVersion:1,shareReferenceObservation:true});
});
test('listing association never forwards forged reference amounts or identity',()=>{
  const p=listingPayload({referenceDefinitionId:'def',referenceValue:4,tenantId:'forged'},false);
  assert.equal(p.referenceDefinitionId,'def');assert.equal(p.referenceValue,undefined);assert.equal(p.tenantId,undefined);
});
test('all reference messages and dynamic evidence states exist in every locale',()=>{
  const bundles=JSON.parse(fs.readFileSync(new URL('../src/locales.json',import.meta.url),'utf8'));
  const source=fs.readFileSync(new URL('../src/references.jsx',import.meta.url),'utf8');
  const keys=new Set([...source.matchAll(/t\('(ref[A-Za-z_]+)'\)/g)].map(m=>m[1]));
  for(const suffix of ['VALUE','BAND','CONVENTION','QUALITATIVE','SUFFICIENT_DATA','INSUFFICIENT_DATA','SMALL_SAMPLE','LOW_DIVERSITY','CONCENTRATED','STALE','NOT_COMPARABLE','BELOW','ABOVE','WITHIN',
    'SOURCE_NOT_AGREEMENT','NO_BILATERAL_CONSENT','OUTSIDE_WINDOW','MISSING_COUNTERPARTY'])keys.add('ref'+suffix);
  for(const status of ['SIGNAL','UNDER_REVIEW','FINAL','DISMISSED'])keys.add('refCaseStatus'+status);
  for(const code of ['REPEATED_RELATIONSHIP','HIGH_COUNTERPARTY_CONCENTRATION','RELATED_PARTICIPANT_CLUSTER','CIRCULAR_ACTIVITY','OUTLIER_PENDING_REVIEW','OTHER_EXPLAINED_SIGNAL'])keys.add('refSignal'+code);
  for(const deviation of ['MATCHES_OBSERVED_RANGE','DEVIATES_FROM_OBSERVED'])keys.add('refDeviation_'+deviation);
  for(const [locale,bundle] of Object.entries(bundles))for(const key of keys)assert.ok(bundle[key]?.trim(),locale+': '+key);
});
test('proposal deviation is descriptive only and never blocks a departure from observed evidence',()=>{
  const sufficient={status:'SUFFICIENT_DATA',lowerQuartile:'10.00',upperQuartile:'20.00'};
  assert.equal(proposalDeviation('12','15',sufficient),'MATCHES_OBSERVED_RANGE');
  assert.equal(proposalDeviation('100','100',sufficient),'DEVIATES_FROM_OBSERVED');
  assert.equal(proposalDeviation('1','1',sufficient),'DEVIATES_FROM_OBSERVED');
  assert.equal(proposalDeviation('100','100',{status:'INSUFFICIENT_DATA'}),null);
  assert.equal(proposalDeviation('','',sufficient),null);
});

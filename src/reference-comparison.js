/** How a proposed reference range sits against the raw observed evidence (median/IQR) - purely
 * descriptive, never blocks anything. The community may deliberately depart from what was
 * observed (a convention, a normative choice); this only decides whether that departure should
 * be called out for the explanation the proposal already always requires. */
export function proposalDeviation(lowerValue,upperValue,evidence) {
  if(!evidence||evidence.status!=='SUFFICIENT_DATA'||evidence.lowerQuartile==null)return null;
  if(lowerValue===''||lowerValue==null)return null;
  const lower=Number(lowerValue),upper=Number(upperValue===''||upperValue==null?lowerValue:upperValue);
  if(!Number.isFinite(lower)||!Number.isFinite(upper))return null;
  const q1=Number(evidence.lowerQuartile),q3=Number(evidence.upperQuartile);
  return upper<q1||lower>q3?'DEVIATES_FROM_OBSERVED':'MATCHES_OBSERVED_RANGE';
}

/** Comparison only when quantity and unit identities match; never blocks a proposal. */
export function comparison(offer,definition,reference) {
  if(!reference||reference.lower_value==null||offer.proposedAmount==null||offer.proposedAmount===''||
    offer.proposedUnitRef!==definition.unit_ref||offer.unitLabel!==definition.quantity_unit||!(Number(offer.quantity)>0))return 'NOT_COMPARABLE';
  const amount=Number(offer.proposedAmount)*Number(definition.quantity_basis)/Number(offer.quantity);
  if(!Number.isFinite(amount))return 'NOT_COMPARABLE';
  return amount<Number(reference.lower_value)?'BELOW':amount>Number(reference.upper_value)?'ABOVE':'WITHIN';
}

/** Comparison only when quantity and unit identities match; never blocks a proposal. */
export function comparison(offer,definition,reference) {
  if(!reference||reference.lower_value==null||offer.proposedAmount==null||offer.proposedAmount===''||
    offer.proposedUnitRef!==definition.unit_ref||offer.unitLabel!==definition.quantity_unit||!(Number(offer.quantity)>0))return 'NOT_COMPARABLE';
  const amount=Number(offer.proposedAmount)*Number(definition.quantity_basis)/Number(offer.quantity);
  if(!Number.isFinite(amount))return 'NOT_COMPARABLE';
  return amount<Number(reference.lower_value)?'BELOW':amount>Number(reference.upper_value)?'ABOVE':'WITHIN';
}

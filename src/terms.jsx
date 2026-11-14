// What is offered or needed, and what a proposal covers (STRUCTURED_TERMS_AND_NEEDS.md). Every field is
// optional: a listing or offer without them reads exactly as before.
import { CONDITIONS, FULFILMENT_MODES, AVAILABILITY, DIMENSIONS, offerExpired } from './catalog-client.js';

const React = window.__IDAX_MODULE_SDK__.React;

function Choice({ t, label, value, options, prefix, onChange }) {
  return <label>{t(label)}<select value={value || ''} onChange={e => onChange(e.target.value)}>
    <option value="">{t('termsNotStated')}</option>
    {options.map(code => <option key={code} value={code}>{t(prefix + code)}</option>)}
  </select></label>;
}

function dimensionState(value, dimension) {
  if ((value.flexibleOn || []).includes(dimension)) return 'FLEXIBLE';
  if ((value.firmOn || []).includes(dimension)) return 'FIRM';
  return '';
}

export function ListingDetailsFields({ t, value, change }) {
  const setDimension = (dimension, state) => {
    const flexible = (value.flexibleOn || []).filter(d => d !== dimension);
    const firm = (value.firmOn || []).filter(d => d !== dimension);
    if (state === 'FLEXIBLE') flexible.push(dimension);
    if (state === 'FIRM') firm.push(dimension);
    change('flexibleOn', flexible); change('firmOn', firm);
  };
  return <fieldset className="stir-wide stir-fieldset" data-testid="listing-details">
    <legend>{t('detailsTitle')}</legend>
    <p><small>{t('detailsHint')}</small></p>
    <Choice t={t} label="itemCondition" value={value.itemCondition} options={CONDITIONS} prefix="condition" onChange={v => change('itemCondition', v)} />
    <Choice t={t} label="fulfilmentMode" value={value.fulfilmentMode} options={FULFILMENT_MODES} prefix="fulfilment" onChange={v => change('fulfilmentMode', v)} />
    <label className="stir-wide">{t('includedItems')}<input maxLength={1000} value={value.includedItems || ''} onChange={e => change('includedItems', e.target.value)} /><small>{t('includedItemsHint')}</small></label>
    <label>{t('availability')}<select value={value.availability || 'AVAILABLE'} onChange={e => change('availability', e.target.value)}>
      {AVAILABILITY.map(code => <option key={code} value={code}>{t('availability' + code)}</option>)}
    </select></label>
    <label>{t('availableUntil')}<input type="date" value={value.availableUntil || ''} onChange={e => change('availableUntil', e.target.value)} /></label>
    {value.direction === 'WANTED' && <>
      <label>{t('neededBy')}<input type="date" value={value.neededBy || ''} onChange={e => change('neededBy', e.target.value)} /></label>
      <div className="stir-wide stir-dimensions">
        <p><small>{t('dimensionsHint')}</small></p>
        {DIMENSIONS.map(dimension => <label key={dimension}>{t('dimension' + dimension)}
          <select data-dimension={dimension} value={dimensionState(value, dimension)} onChange={e => setDimension(dimension, e.target.value)}>
            <option value="">{t('termsNotStated')}</option><option value="FLEXIBLE">{t('dimensionFlexible')}</option><option value="FIRM">{t('dimensionFirm')}</option>
          </select></label>)}
      </div>
    </>}
    <label className="stir-wide">{t('counterpartNote')}<textarea maxLength={2000} rows={2} value={value.counterpartNote || ''} onChange={e => change('counterpartNote', e.target.value)} /><small>{t('counterpartNoteHint')}</small></label>
  </fieldset>;
}

export function ListingDetailsView({ t, listing }) {
  const rows = [
    listing.itemCondition && [t('itemCondition'), t('condition' + listing.itemCondition)],
    listing.fulfilmentMode && [t('fulfilmentMode'), t('fulfilment' + listing.fulfilmentMode)],
    listing.includedItems && [t('includedItems'), listing.includedItems],
    listing.availability && [t('availability'), t('availability' + listing.availability)],
    listing.availableUntil && [t('availableUntil'), listing.availableUntil],
    listing.neededBy && [t('neededBy'), listing.neededBy],
    listing.flexibleOn?.length > 0 && [t('dimensionFlexible'), listing.flexibleOn.map(d => t('dimension' + d)).join(', ')],
    listing.firmOn?.length > 0 && [t('dimensionFirm'), listing.firmOn.map(d => t('dimension' + d)).join(', ')],
  ].filter(Boolean);
  return <>
    {rows.length > 0 && <dl className="stir-details" data-testid="listing-details-view">{rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>}
    {listing.counterpartNote && <aside className="stir-private-note" data-testid="counterpart-note"><strong>{t('counterpartNote')}</strong><p>{listing.counterpartNote}</p><small>{t('counterpartNoteVisibility')}</small></aside>}
    {!listing.counterpartNote && listing.hasCounterpartNote && <p data-testid="counterpart-note-hidden"><small>{t('counterpartNoteHidden')}</small></p>}
  </>;
}

/** viewerIsOwner: whether the person filling the form published the listing; task labels speak to them. */
export function StructuredTermsFields({ t, value, change, viewerIsOwner }) {
  const mine = viewerIsOwner ? 'ownerTasks' : 'initiatorTasks';
  const theirs = viewerIsOwner ? 'initiatorTasks' : 'ownerTasks';
  return <fieldset className="stir-wide stir-fieldset" data-testid="structured-terms">
    <legend>{t('termsTitle')}</legend>
    <p><small>{t('termsHint')}</small></p>
    <label className="stir-wide">{t('termsScope')}<textarea maxLength={2000} rows={2} value={value.scope || ''} onChange={e => change('scope', e.target.value)} /><small>{t('termsScopeHint')}</small></label>
    <label className="stir-wide">{t('termsYourTasks')}<textarea maxLength={1000} rows={2} data-terms={mine} value={value[mine] || ''} onChange={e => change(mine, e.target.value)} /></label>
    <label className="stir-wide">{t('termsTheirTasks')}<textarea maxLength={1000} rows={2} data-terms={theirs} value={value[theirs] || ''} onChange={e => change(theirs, e.target.value)} /></label>
    <Choice t={t} label="fulfilmentMode" value={value.fulfilmentMode} options={FULFILMENT_MODES} prefix="fulfilment" onChange={v => change('fulfilmentMode', v)} />
    <label>{t('termsFulfilBy')}<input type="date" value={value.fulfilBy || ''} onChange={e => change('fulfilBy', e.target.value)} /></label>
    <label className="stir-wide">{t('termsOpenQuestions')}<textarea maxLength={1000} rows={2} value={value.openQuestions || ''} onChange={e => change('openQuestions', e.target.value)} /><small>{t('termsOpenQuestionsHint')}</small></label>
    <label>{t('termsValidUntil')}<input type="datetime-local" value={value.validUntil || ''} onChange={e => change('validUntil', e.target.value)} /></label>
  </fieldset>;
}

/** Renders the structured terms of an offer or of an accepted snapshot, from the reader's side. */
export function StructuredTermsView({ t, terms, viewerIsOwner, acknowledged }) {
  const mine = viewerIsOwner ? terms.ownerTasks : terms.initiatorTasks;
  const theirs = viewerIsOwner ? terms.initiatorTasks : terms.ownerTasks;
  const validUntil = terms.validUntil || terms.offerValidUntil;
  const rows = [
    terms.scope && [t('termsScope'), terms.scope],
    mine && [t('termsYourTasks'), mine],
    theirs && [t('termsTheirTasks'), theirs],
    terms.fulfilmentMode && [t('fulfilmentMode'), t('fulfilment' + terms.fulfilmentMode)],
    terms.fulfilBy && [t('termsFulfilBy'), terms.fulfilBy],
    validUntil && [t('termsValidUntil'), new Date(validUntil).toLocaleString()],
  ].filter(Boolean);
  if (!rows.length && !terms.openQuestions) return null;
  return <div className="stir-terms" data-testid="terms-view">
    {rows.length > 0 && <dl className="stir-details">{rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>}
    {terms.openQuestions && <p className="stir-open-questions" data-testid="open-questions"><strong>{t('termsOpenQuestions')}:</strong> {terms.openQuestions}
      {acknowledged && <small> {t('termsOpenQuestionsAcknowledged')}</small>}</p>}
    {terms.status === 'PROPOSED' && offerExpired(terms) && <p className="stir-expired" data-testid="offer-expired">{t('termsExpired')}</p>}
  </div>;
}

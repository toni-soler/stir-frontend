import { References, ReferenceSelector } from './references.jsx';
import { Governance, GovernanceSignTool } from './governance.jsx';
import { instanceApi, moderationApi } from './api.js';
import { createCatalogClient, listingPayload } from './catalog-client.js';
import { MyProfile, PublicProfile } from './profile.jsx';
import { ListingDetail } from './listing.jsx';
import { NegotiationList, NegotiationDetail } from './negotiation.jsx';
import { AgreementList, AgreementDetail } from './agreement.jsx';
import { MyEconomicProfile } from './economic.jsx';
import { PhotoUploader, ListingThumbnail } from './attachments.jsx';
import { NotificationBell, NotificationList } from './notifications.jsx';
import { ModerationQueue } from './moderation.jsx';
import { LegalPage } from './legal.jsx';
import { Home } from './home.jsx';
import bundles from './locales.json';
import './style.css';

const React = window.__IDAX_MODULE_SDK__.React;
const {useEffect,useState,useMemo} = React;
Object.entries(bundles).forEach(([locale,bundle])=>window.__IDAX_MODULE_SDK__.i18n.addResourceBundle(locale,'translation',{stir:bundle}));

function ListingEditor({initial, api, sdk, catalogs, t, onCancel, onSaved, justCreated}) {
  const [value,setValue]=useState(initial || {direction:'OFFER',title:'',description:'',category:'general',resourceKind:'physical',location:''});
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const change=(key,next)=>setValue(current=>({...current,[key]:next}));
  const submit=async(event)=>{event.preventDefault();setBusy(true);setError('');try{
    const payload=listingPayload(value,Boolean(initial));
    if(initial){await api.update(initial.id,payload);onSaved();}
    else{const created=await api.create(payload);onSaved(created);}
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  return <section className="stir-panel"><h2>{t(initial?'edit':'create')}</h2>
  {justCreated && <p role="status" className="stir-success">{t('createdNowAddPhotos')}</p>}
  <form className="stir-form" onSubmit={submit}>
    <label>{t('direction')}<select value={value.direction} onChange={e=>change('direction',e.target.value)}><option value="OFFER">{t('OFFER')}</option><option value="WANTED">{t('WANTED')}</option></select></label>
    <label>{t('title')} *<input maxLength={160} required placeholder={t('titlePlaceholder')} value={value.title} onChange={e=>change('title',e.target.value)}/></label>
    <label className="stir-wide">{t('description')} *<textarea maxLength={8000} required rows={6} placeholder={t('descriptionPlaceholder')} value={value.description} onChange={e=>change('description',e.target.value)}/></label>
    <label>{t('category')}<select value={value.category} onChange={e=>change('category',e.target.value)}>{catalogs.categories.map(code=><option key={code} value={code}>{t(code)}</option>)}</select></label>
    <label>{t('resourceKind')}<select value={value.resourceKind} onChange={e=>change('resourceKind',e.target.value)}>{catalogs.resourceKinds.map(code=><option key={code} value={code}>{t(code)}</option>)}</select></label>
    <ReferenceSelector sdk={sdk} t={t} value={value.referenceDefinitionId} onChange={v=>change('referenceDefinitionId',v)}/>
    <label className="stir-wide">{t('location')}<input maxLength={160} value={value.location||''} onChange={e=>change('location',e.target.value)}/><small>{t('locationHint')}</small></label>
    <p className="stir-wide"><small>{t('requiredFieldsHint')}</small></p>
    <p>{t('status')}: {t('ACTIVE')}</p>
    {error && <p role="alert">{t(error.replace('stir.',''))}</p>}
    <div className="stir-actions stir-wide"><button disabled={busy} type="submit">{t(busy?'saving':(initial?'save':'saveAndAddPhotos'))}</button><button disabled={busy} type="button" className="secondary" onClick={onCancel}>{t(justCreated?'done':'cancel')}</button></div>
  </form>
  <PhotoUploader sdk={sdk} t={t} listingId={initial?.id}/>
  </section>;
}

function Marketplace() {
  const sdk=window.__IDAX_MODULE_SDK__; const t=(key)=>sdk.i18n.t('stir.'+key,bundles.en[key] || bundles.en.error);
  const siteName=useSiteName(sdk);
  const [canModerate,setCanModerate]=useState(false);
  const {useNavigate,useLocation}=sdk.router; const navigate=useNavigate(); const location=useLocation(); const path=location.pathname;
  const mine=path.startsWith('/stir/mine'); const creating=path==='/stir/new';
  const editRequestId=mine?new URLSearchParams(location.search).get('edit'):null;
  const api=useMemo(()=>sdk.demo || !sdk.activeTenantId ? null : createCatalogClient(sdk,sdk.activeTenantId),[sdk.activeTenantId,sdk.demo]);
  const [catalogs,setCatalogs]=useState({categories:[],resourceKinds:[]});
  const [filters,setFilters]=useState({q:'',direction:'',category:'',resourceKind:'',status:'ACTIVE'});
  const [page,setPage]=useState(0); const [result,setResult]=useState({content:[],totalPages:0});
  const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [editing,setEditing]=useState(null); const [justCreatedId,setJustCreatedId]=useState(null); const [revision,setRevision]=useState(0); const [busy,setBusy]=useState(false);
  const [saved,setSaved]=useState([]); const [filterName,setFilterName]=useState('');
  const preferences=`/api/shell/v1/tenants/${encodeURIComponent(sdk.activeTenantId)}/saved-filters/stir.listings`;
  useEffect(()=>{setEditing(null);setPage(0);},[path]);
  useEffect(()=>{if(!api||!editRequestId)return;api.read(editRequestId).then(setEditing).catch(e=>setError(e.message));},[api,editRequestId]);
  useEffect(()=>{if(!api)return;api.catalogs().then(setCatalogs).catch(e=>setError(e.message)); sdk.fetchWithAuth(preferences).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(setSaved).catch(()=>{});},[api]);
  useEffect(()=>{if(!api)return;moderationApi(sdk,sdk.activeTenantId).canModerate().then(setCanModerate);},[api]);
  useEffect(()=>{if(!api){setLoading(false);return;}const controller=new AbortController();setLoading(true);setError('');
    api.list({...filters,mine,page,size:20},controller.signal).then(setResult).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
  },[api,filters,mine,page,revision]);
  const filter=(key,value)=>{setFilters(current=>({...current,[key]:value}));setPage(0);};
  // "No listings match these filters" used to show for BOTH "nobody has published anything yet"
  // and "your search matched nothing" - same message, no way to tell which, no way to recover
  // from the second one except manually resetting every control.
  const hasActiveFilters=Boolean(filters.q.trim()||filters.direction||filters.category||filters.resourceKind||filters.status!=='ACTIVE');
  const clearFilters=()=>{setFilters({q:'',direction:'',category:'',resourceKind:'',status:'ACTIVE'});setPage(0);};
  const saveFilter=async()=>{if(!filterName.trim())return;const next=[...saved,{id:crypto.randomUUID(),name:filterName.trim(),filters}];try{const response=await sdk.fetchWithAuth(preferences,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});if(!response.ok)throw new Error('stir.error');setSaved(next);setFilterName('');}catch(e){setError(e.message);}};
  const close=async(row)=>{if(!window.confirm(t('confirmClose')))return;setBusy(true);try{await api.close(row.id,row.version);setRevision(n=>n+1);}catch(e){setError(e.message);}finally{setBusy(false);}};
  if(!api)return <section className="stir"><p role="alert">{t('realSessionRequired')}</p></section>;
  return <main className="stir"><header className="stir-heading"><div><span className="stir-brand">{siteName}</span><p>{t('tagline')}</p></div><NotificationBell sdk={sdk} t={t} navigate={navigate}/><button onClick={()=>navigate('/stir/new')}>+ {t('create')}</button></header>
    <nav className="stir-tabs" aria-label="STIR">
      <button onClick={()=>navigate('/stir/home')}>{t('dashboardHome')}</button>
      <button className={!mine&&!creating?'active':''} onClick={()=>navigate('/stir')}>{t('marketplace')}</button>
      <button className={mine?'active':''} onClick={()=>navigate('/stir/mine')}>{t('mine')}</button>
      <button onClick={()=>navigate('/stir/negotiations')}>{t('myNegotiations')}</button>
      <button onClick={()=>navigate('/stir/references')}>{t('refCommunity')}</button>
      <button onClick={()=>navigate('/stir/governance')}>{t('govTab')}</button>
      <button onClick={()=>navigate('/stir/agreements')}>{t('myAgreements')}</button>
      <button onClick={()=>navigate('/stir/economic')}>{t('economicActivation')}</button>
      <button onClick={()=>navigate('/stir/profile')}>{t('myProfile')}</button>
      {canModerate && <button onClick={()=>navigate('/stir/moderation')}>{t('moderationQueue')}</button>}
    </nav>
    {(creating||editing) ? <ListingEditor key={editing?.id || 'new'} initial={editing} justCreated={Boolean(editing) && editing.id===justCreatedId} api={api} sdk={sdk} catalogs={catalogs} t={t} onCancel={()=>{setEditing(null);setJustCreatedId(null);setRevision(n=>n+1);navigate('/stir/mine');}} onSaved={(created)=>{setRevision(n=>n+1); if(created){setJustCreatedId(created.id);setEditing(created);} else {setEditing(null);setJustCreatedId(null);navigate('/stir/mine');}}}/> : <>
      <section className="stir-intro"><h2>{t(mine?'mine':'headline')}</h2><p>{t('intro')}</p></section>
      <form className="stir-filters" onSubmit={e=>e.preventDefault()}><label>{t('search')}<input value={filters.q} maxLength={160} onChange={e=>filter('q',e.target.value)}/></label>
        {[['direction',['OFFER','WANTED']],['category',catalogs.categories],['resourceKind',catalogs.resourceKinds],['status',['ACTIVE','CLOSED']]].map(([key,values])=><label key={key}>{t(key)}<select value={filters[key]} onChange={e=>filter(key,e.target.value)}>{key!=='status'&&<option value="">{t('all')}</option>}{values.map(code=><option key={code} value={code}>{t(code)}</option>)}</select></label>)}
        {hasActiveFilters && <button type="button" className="secondary" onClick={clearFilters}>{t('clearFilters')}</button>}
      </form>
      <div className="stir-saved"><input aria-label={t('filterName')} placeholder={t('filterName')} maxLength={80} value={filterName} onChange={e=>setFilterName(e.target.value)}/><button onClick={saveFilter}>{t('saveFilter')}</button>{saved.map(item=><button key={item.id} className="secondary" onClick={()=>{setFilters({...filters,...item.filters});setPage(0);}}>{item.name}</button>)}</div>
      {error && <p role="alert">{t(error.replace('stir.',''))}</p>}
      {loading?<p role="status">{t('loading')}</p>:<section className="stir-grid">{result.content.map(row=><article className="stir-card" key={row.id}><ListingThumbnail sdk={sdk} attachmentId={row.mainPhotoId} alt={row.title}/><span className={'stir-badge '+row.direction}>{t(row.direction)}</span>{row.hidden&&<span className="stir-badge">{t('listingHiddenNotice')}</span>}<small>{t(row.resourceKind)} · {t(row.category)}</small><h3><button type="button" className="stir-link" onClick={()=>navigate('/stir/listing/'+row.id)}>{row.title}</button></h3>{row.ownerDisplayName && <small>{t('listingBy')} {row.ownerDisplayName}</small>}<p className="stir-description">{row.description}</p>{row.location&&<p>⌖ {row.location}</p>}<footer><span>{t(row.status)}</span>{mine&&row.status==='ACTIVE'&&<div><button disabled={busy} onClick={()=>setEditing(row)}>{t('edit')}</button><button disabled={busy} className="secondary" onClick={()=>close(row)}>{t('close')}</button></div>}</footer></article>)}{!result.content.length&&<div className="stir-empty-state">{hasActiveFilters?<><p>{t('empty')}</p><button type="button" className="secondary" onClick={clearFilters}>{t('clearFilters')}</button></>:mine?<><p>{t('emptyMineNoListingsYet')}</p><button type="button" onClick={()=>navigate('/stir/new')}>{t('createFirstListing')}</button></>:<p>{t('emptyNoListingsYet')}</p>}</div>}</section>}
      <div className="stir-actions"><button disabled={page===0} onClick={()=>setPage(n=>n-1)}>{t('previous')}</button><span>{page+1} / {Math.max(1,result.totalPages)}</span><button disabled={page+1>=result.totalPages} onClick={()=>setPage(n=>n+1)}>{t('next')}</button></div>
    </>}
  </main>;
}

function sdkAndT() {
  const sdk=window.__IDAX_MODULE_SDK__;
  return [sdk,(key)=>sdk.i18n.t('stir.'+key,bundles.en[key] || bundles.en.error)];
}
// Instance branding (section 18 of the 0.4 brief) never changes at runtime, so one fetch per page
// load is cached module-wide rather than re-requested by every header that renders.
let instanceCache=null;
function useSiteName(sdk) {
  const [siteName,setSiteName]=useState('STIR');
  useEffect(()=>{ (instanceCache ||= instanceApi(sdk).get().catch(()=>({siteName:'STIR'}))).then(i=>setSiteName(i.siteName||'STIR')); },[]);
  return siteName;
}
function withNav(t, navigate, node, sdk) {
  const siteName=useSiteName(sdk);
  return <main className="stir">
    <header className="stir-heading"><div><span className="stir-brand">{siteName}</span></div></header>
    <nav className="stir-tabs" aria-label="STIR">
      <button onClick={()=>navigate('/stir/home')}>{t('dashboardHome')}</button>
      <button onClick={()=>navigate('/stir')}>{t('backToMarketplace')}</button>
    </nav>
    {node}
  </main>;
}
function ListingDetailRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate,useParams}=sdk.router; const navigate=useNavigate(); const {id}=useParams(); return withNav(t,navigate,<ListingDetail sdk={sdk} t={t} id={id} navigate={navigate}/>,sdk); }
function NegotiationListRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate}=sdk.router; const navigate=useNavigate(); return withNav(t,navigate,<NegotiationList sdk={sdk} t={t} navigate={navigate}/>,sdk); }
function NegotiationDetailRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate,useParams}=sdk.router; const navigate=useNavigate(); const {id}=useParams(); return withNav(t,navigate,<NegotiationDetail sdk={sdk} t={t} id={id} navigate={navigate}/>,sdk); }
function AgreementListRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate}=sdk.router; const navigate=useNavigate(); return withNav(t,navigate,<AgreementList sdk={sdk} t={t} navigate={navigate}/>,sdk); }
function AgreementDetailRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate,useParams}=sdk.router; const navigate=useNavigate(); const {id}=useParams(); return withNav(t,navigate,<AgreementDetail sdk={sdk} t={t} id={id} navigate={navigate}/>,sdk); }
function MyProfileRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate}=sdk.router; const navigate=useNavigate(); return withNav(t,navigate,<MyProfile sdk={sdk} t={t} navigate={navigate}/>,sdk); }
function MyEconomicProfileRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate}=sdk.router; const navigate=useNavigate(); return withNav(t,navigate,<MyEconomicProfile sdk={sdk} t={t} navigate={navigate}/>,sdk); }
function PublicProfileRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate,useParams}=sdk.router; const navigate=useNavigate(); const {userId}=useParams(); return withNav(t,navigate,<PublicProfile sdk={sdk} t={t} userId={userId}/>,sdk); }
function HomeRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate}=sdk.router; const navigate=useNavigate(); return withNav(t,navigate,<Home sdk={sdk} t={t} navigate={navigate}/>,sdk); }
function NotificationListRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate}=sdk.router; const navigate=useNavigate(); return withNav(t,navigate,<NotificationList sdk={sdk} t={t} navigate={navigate}/>,sdk); }
function ModerationQueueRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate}=sdk.router; const navigate=useNavigate(); return withNav(t,navigate,<ModerationQueue sdk={sdk} t={t} navigate={navigate}/>,sdk); }
function PrivacyRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate}=sdk.router; const navigate=useNavigate(); return withNav(t,navigate,<LegalPage sdk={sdk} kind="privacy"/>,sdk); }
function TermsRoute(){ const [sdk,t]=sdkAndT(); const {useNavigate}=sdk.router; const navigate=useNavigate(); return withNav(t,navigate,<LegalPage sdk={sdk} kind="terms"/>,sdk); }

function ReferencesRoute(){const [sdk,t]=sdkAndT();const navigate=sdk.router.useNavigate();return withNav(t,navigate,<References sdk={sdk} t={t}/>,sdk);}
function GovernanceRoute(){const [sdk,t]=sdkAndT();const navigate=sdk.router.useNavigate();return withNav(t,navigate,<Governance sdk={sdk} t={t}/>,sdk);}
function GovernanceSignRoute(){const [sdk,t]=sdkAndT();const navigate=sdk.router.useNavigate();return withNav(t,navigate,<GovernanceSignTool t={t}/>,sdk);}
function StirRoot() {
  const [sdk,t]=sdkAndT();
  const {Routes,Route}=sdk.router;
  if(sdk.demo || !sdk.activeTenantId) return <section className="stir"><p role="alert">{t('realSessionRequired')}</p></section>;
  return <Routes>
    <Route path="/stir/references" element={<ReferencesRoute/>}/>
    <Route path="/stir/governance" element={<GovernanceRoute/>}/>
    <Route path="/stir/governance/sign" element={<GovernanceSignRoute/>}/>
    <Route path="/stir/listing/:id" element={<ListingDetailRoute/>}/>
    <Route path="/stir/negotiations" element={<NegotiationListRoute/>}/>
    <Route path="/stir/negotiations/:id" element={<NegotiationDetailRoute/>}/>
    <Route path="/stir/agreements" element={<AgreementListRoute/>}/>
    <Route path="/stir/agreements/:id" element={<AgreementDetailRoute/>}/>
    <Route path="/stir/profile" element={<MyProfileRoute/>}/>
    <Route path="/stir/economic" element={<MyEconomicProfileRoute/>}/>
    <Route path="/stir/participants/:userId" element={<PublicProfileRoute/>}/>
    <Route path="/stir/home" element={<HomeRoute/>}/>
    <Route path="/stir/notifications" element={<NotificationListRoute/>}/>
    <Route path="/stir/moderation" element={<ModerationQueueRoute/>}/>
    <Route path="/stir/privacy" element={<PrivacyRoute/>}/>
    <Route path="/stir/terms" element={<TermsRoute/>}/>
    <Route path="/stir/*" element={<Marketplace/>}/>
  </Routes>;
}
window.__IDAX_MODULE_EXTENSIONS__ ||= {};
window.__IDAX_MODULE_EXTENSIONS__.stir={component:StirRoot};
window.dispatchEvent(new CustomEvent('idaxModuleExtensionRegistered',{detail:{module:'stir'}}));

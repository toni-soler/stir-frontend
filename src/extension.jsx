import { listingApi, listingPayload } from './api.js';
import bundles from './locales.json';
import './style.css';

const React = window.__IDAX_MODULE_SDK__.React;
const {useEffect,useState,useMemo} = React;
Object.entries(bundles).forEach(([locale,bundle])=>window.__IDAX_MODULE_SDK__.i18n.addResourceBundle(locale,'translation',{stir:bundle}));

function ListingEditor({initial, api, catalogs, t, onCancel, onSaved}) {
  const [value,setValue]=useState(initial || {direction:'OFFER',title:'',description:'',category:'general',resourceKind:'physical',location:''});
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const change=(key,next)=>setValue(current=>({...current,[key]:next}));
  const submit=async(event)=>{event.preventDefault();setBusy(true);setError('');try{
    const payload=listingPayload(value,Boolean(initial));
    if(initial) await api.update(initial.id,payload); else await api.create(payload);
    onSaved();
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  return <section className="stir-panel"><h2>{t(initial?'edit':'create')}</h2><form className="stir-form" onSubmit={submit}>
    <label>{t('direction')}<select value={value.direction} onChange={e=>change('direction',e.target.value)}><option value="OFFER">{t('OFFER')}</option><option value="WANTED">{t('WANTED')}</option></select></label>
    <label>{t('title')}<input maxLength={160} required value={value.title} onChange={e=>change('title',e.target.value)}/></label>
    <label className="stir-wide">{t('description')}<textarea maxLength={8000} required rows={6} value={value.description} onChange={e=>change('description',e.target.value)}/></label>
    <label>{t('category')}<select value={value.category} onChange={e=>change('category',e.target.value)}>{catalogs.categories.map(code=><option key={code} value={code}>{t(code)}</option>)}</select></label>
    <label>{t('resourceKind')}<select value={value.resourceKind} onChange={e=>change('resourceKind',e.target.value)}>{catalogs.resourceKinds.map(code=><option key={code} value={code}>{t(code)}</option>)}</select></label>
    <label className="stir-wide">{t('location')}<input maxLength={160} value={value.location||''} onChange={e=>change('location',e.target.value)}/><small>{t('locationHint')}</small></label>
    <p>{t('status')}: {t('ACTIVE')}</p>
    {error && <p role="alert">{t(error.replace('stir.',''))}</p>}
    <div className="stir-actions stir-wide"><button disabled={busy} type="submit">{t(busy?'saving':'save')}</button><button disabled={busy} type="button" className="secondary" onClick={onCancel}>{t('cancel')}</button></div>
  </form></section>;
}

function Marketplace() {
  const sdk=window.__IDAX_MODULE_SDK__; const t=(key)=>sdk.i18n.t('stir.'+key,bundles.en[key] || bundles.en.error);
  const {useNavigate,useLocation}=sdk.router; const navigate=useNavigate(); const path=useLocation().pathname;
  const mine=path.startsWith('/stir/mine'); const creating=path==='/stir/new';
  const api=useMemo(()=>sdk.demo || !sdk.activeTenantId ? null : listingApi(sdk,sdk.activeTenantId),[sdk.activeTenantId,sdk.demo]);
  const [catalogs,setCatalogs]=useState({categories:[],resourceKinds:[]});
  const [filters,setFilters]=useState({q:'',direction:'',category:'',resourceKind:'',status:'ACTIVE'});
  const [page,setPage]=useState(0); const [result,setResult]=useState({content:[],totalPages:0});
  const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [editing,setEditing]=useState(null); const [revision,setRevision]=useState(0); const [busy,setBusy]=useState(false);
  const [saved,setSaved]=useState([]); const [filterName,setFilterName]=useState('');
  const preferences=`/api/shell/v1/tenants/${encodeURIComponent(sdk.activeTenantId)}/saved-filters/stir.listings`;
  useEffect(()=>{setEditing(null);setPage(0);},[path]);
  useEffect(()=>{if(!api)return;api.catalogs().then(setCatalogs).catch(e=>setError(e.message)); sdk.fetchWithAuth(preferences).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(setSaved).catch(()=>{});},[api]);
  useEffect(()=>{if(!api){setLoading(false);return;}const controller=new AbortController();setLoading(true);setError('');
    api.list({...filters,mine,page,size:20},controller.signal).then(setResult).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
  },[api,filters,mine,page,revision]);
  const filter=(key,value)=>{setFilters(current=>({...current,[key]:value}));setPage(0);};
  const saveFilter=async()=>{if(!filterName.trim())return;const next=[...saved,{id:crypto.randomUUID(),name:filterName.trim(),filters}];try{const response=await sdk.fetchWithAuth(preferences,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});if(!response.ok)throw new Error('stir.error');setSaved(next);setFilterName('');}catch(e){setError(e.message);}};
  const close=async(row)=>{if(!window.confirm(t('confirmClose')))return;setBusy(true);try{await api.close(row.id,row.version);setRevision(n=>n+1);}catch(e){setError(e.message);}finally{setBusy(false);}};
  if(!api)return <section className="stir"><p role="alert">{t('realSessionRequired')}</p></section>;
  return <main className="stir"><header className="stir-heading"><div><span className="stir-brand">STIR</span><p>{t('tagline')}</p></div><button onClick={()=>navigate('/stir/new')}>+ {t('create')}</button></header>
    <nav className="stir-tabs" aria-label="STIR"><button className={!mine&&!creating?'active':''} onClick={()=>navigate('/stir')}>{t('marketplace')}</button><button className={mine?'active':''} onClick={()=>navigate('/stir/mine')}>{t('mine')}</button></nav>
    {(creating||editing) ? <ListingEditor key={editing?.id || 'new'} initial={editing} api={api} catalogs={catalogs} t={t} onCancel={()=>{setEditing(null);navigate('/stir/mine');}} onSaved={()=>{setEditing(null);setRevision(n=>n+1);navigate('/stir/mine');}}/> : <>
      <section className="stir-intro"><h2>{t(mine?'mine':'headline')}</h2><p>{t('intro')}</p></section>
      <form className="stir-filters" onSubmit={e=>e.preventDefault()}><label>{t('search')}<input value={filters.q} maxLength={160} onChange={e=>filter('q',e.target.value)}/></label>
        {[['direction',['OFFER','WANTED']],['category',catalogs.categories],['resourceKind',catalogs.resourceKinds],['status',['ACTIVE','CLOSED']]].map(([key,values])=><label key={key}>{t(key)}<select value={filters[key]} onChange={e=>filter(key,e.target.value)}>{key!=='status'&&<option value="">{t('all')}</option>}{values.map(code=><option key={code} value={code}>{t(code)}</option>)}</select></label>)}
      </form>
      <div className="stir-saved"><input aria-label={t('filterName')} placeholder={t('filterName')} maxLength={80} value={filterName} onChange={e=>setFilterName(e.target.value)}/><button onClick={saveFilter}>{t('saveFilter')}</button>{saved.map(item=><button key={item.id} className="secondary" onClick={()=>{setFilters({...filters,...item.filters});setPage(0);}}>{item.name}</button>)}</div>
      {error && <p role="alert">{t(error.replace('stir.',''))}</p>}
      {loading?<p role="status">{t('loading')}</p>:<section className="stir-grid">{result.content.map(row=><article className="stir-card" key={row.id}><span className={'stir-badge '+row.direction}>{t(row.direction)}</span><small>{t(row.resourceKind)} · {t(row.category)}</small><h3>{row.title}</h3><p className="stir-description">{row.description}</p>{row.location&&<p>⌖ {row.location}</p>}<footer><span>{t(row.status)}</span>{mine&&row.status==='ACTIVE'&&<div><button disabled={busy} onClick={()=>setEditing(row)}>{t('edit')}</button><button disabled={busy} className="secondary" onClick={()=>close(row)}>{t('close')}</button></div>}</footer></article>)}{!result.content.length&&<p>{t('empty')}</p>}</section>}
      <div className="stir-actions"><button disabled={page===0} onClick={()=>setPage(n=>n-1)}>{t('previous')}</button><span>{page+1} / {Math.max(1,result.totalPages)}</span><button disabled={page+1>=result.totalPages} onClick={()=>setPage(n=>n+1)}>{t('next')}</button></div>
    </>}
  </main>;
}
window.__IDAX_MODULE_EXTENSIONS__ ||= {};
window.__IDAX_MODULE_EXTENSIONS__.stir={component:Marketplace};
window.dispatchEvent(new CustomEvent('idaxModuleExtensionRegistered',{detail:{module:'stir'}}));

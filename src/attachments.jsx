import { attachmentApi } from './api.js';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState, useMemo } = React;

/** Attachments are served through an authenticated endpoint (never a public bucket URL), so a
 * plain <img src="..."> cannot carry the bearer token - fetch the bytes once and render a local
 * object URL instead, revoking it on unmount/change so we never leak blob URLs. */
export function AttachmentImage({ sdk, attachmentId, alt, className }) {
  const api = useMemo(() => attachmentApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!attachmentId) { setUrl(null); return; }
    let current = null; let cancelled = false;
    api.contentUrl(attachmentId).then((objectUrl) => {
      if (cancelled) { URL.revokeObjectURL(objectUrl); return; }
      current = objectUrl; setUrl(objectUrl);
    }).catch(() => {});
    return () => { cancelled = true; if (current) URL.revokeObjectURL(current); };
  }, [attachmentId, sdk.activeTenantId]);
  if (!url) return null;
  return <img className={className} src={url} alt={alt} />;
}

/** Marketplace/home card thumbnail: a plain placeholder when a listing has no photo yet - never an
 * empty broken-image icon. */
export function ListingThumbnail({ sdk, attachmentId, alt }) {
  if (!attachmentId) return <div className="stir-thumb stir-thumb-empty" aria-hidden="true" />;
  return <AttachmentImage sdk={sdk} attachmentId={attachmentId} alt={alt} className="stir-thumb" />;
}

/** Upload control for a Listing's photos: preview grid, delete, main-photo indicator (position 0,
 * assigned server-side by upload order - never client-controlled). Up to 6 photos. */
export function PhotoUploader({ sdk, t, listingId }) {
  const api = useMemo(() => attachmentApi(sdk, sdk.activeTenantId), [sdk.activeTenantId]);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = () => api.listingPhotos(listingId).then(setPhotos).catch((e) => setError(e.message));
  useEffect(() => { if (listingId) load(); }, [listingId]);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    try { await api.uploadListingPhoto(listingId, file); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async (id) => {
    setBusy(true); setError('');
    try { await api.remove(id); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!listingId) return <p>{t('photosSaveListingFirst')}</p>;
  return <div className="stir-photo-uploader">
    <label>{t('photos')}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || photos.length >= 6} onChange={upload} />
    </label>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    <div className="stir-photo-grid">
      {photos.map((photo, index) => <div className="stir-photo-item" key={photo.id}>
        <AttachmentImage sdk={sdk} attachmentId={photo.id} alt={`${t('photos')} ${index + 1}/${photos.length}`} />
        {index === 0 && <span className="stir-badge">{t('mainPhoto')}</span>}
        <button type="button" className="secondary" disabled={busy} onClick={() => remove(photo.id)}>{t('remove')}</button>
      </div>)}
    </div>
    <small>{photos.length}/6</small>
  </div>;
}

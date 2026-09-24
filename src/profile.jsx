import { participantApi, attachmentApi } from './api.js';
import { AttachmentImage } from './attachments.jsx';

const React = window.__IDAX_MODULE_SDK__.React;
const { useEffect, useState } = React;

function AvatarUploader({ sdk, t, profile, onUploaded }) {
  const api = useMemoized(() => attachmentApi(sdk, sdk.activeTenantId), sdk);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    try { await api.uploadAvatar(file); onUploaded(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="stir-avatar-uploader">
    {profile?.avatarAttachmentId
      ? <AttachmentImage sdk={sdk} attachmentId={profile.avatarAttachmentId} alt={t('avatarOf') + ' ' + profile.displayName} className="stir-avatar" />
      : <div className="stir-avatar stir-avatar-empty" aria-hidden="true" />}
    <label>{t('avatarUpload')}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={upload} /></label>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
  </div>;
}

export function useDisplayName(sdk, api, userId, cache) {
  const [name, setName] = useState(cache.current.get(userId) || '');
  useEffect(() => {
    if (!userId || cache.current.has(userId)) { setName(cache.current.get(userId) || ''); return; }
    let active = true;
    api.view(userId).then(profile => { if (active) { cache.current.set(userId, profile.displayName); setName(profile.displayName); } }).catch(() => {});
    return () => { active = false; };
  }, [userId]);
  return name;
}

export function ProfileForm({ t, value, busy, error, onChange, onSubmit }) {
  return <form className="stir-form" onSubmit={onSubmit}>
    <label>{t('profileDisplayName')}<input required maxLength={80} value={value.displayName} onChange={e => onChange('displayName', e.target.value)} /><small>{t('profileDisplayNameHint')}</small></label>
    <label className="stir-wide">{t('profileBio')}<textarea maxLength={500} rows={4} value={value.bio || ''} onChange={e => onChange('bio', e.target.value)} /></label>
    <label>{t('profileLocation')}<input maxLength={160} value={value.location || ''} onChange={e => onChange('location', e.target.value)} /></label>
    {error && <p role="alert">{t(error.replace('stir.', ''))}</p>}
    <div className="stir-actions stir-wide"><button disabled={busy} type="submit">{t(busy ? 'saving' : 'save')}</button></div>
  </form>;
}

export function MyProfile({ sdk, t, navigate }) {
  const api = useMemoized(() => participantApi(sdk, sdk.activeTenantId), sdk);
  const [profile, setProfile] = useState(null);
  const [value, setValue] = useState({ displayName: '', bio: '', location: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api.me().then(found => { setProfile(found); setValue({ displayName: found.displayName, bio: found.bio || '', location: found.location || '' }); })
      .catch(e => { if (e.status !== 404) setError(e.message); })
      .finally(() => setLoading(false));
  }, []);
  const change = (key, next) => setValue(current => ({ ...current, [key]: next }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setSaved(false);
    try { const stored = await api.updateMe(value); setProfile(stored); setSaved(true); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  if (loading) return <p role="status">{t('loading')}</p>;
  return <section className="stir-panel">
    <h2>{t('myProfile')}</h2>
    {!profile && <p>{t('profileSetupHint')}</p>}
    {saved && <p role="status">{t('profileSaved')}</p>}
    {profile && <AvatarUploader sdk={sdk} t={t} profile={profile} onUploaded={() => api.me().then(setProfile)} />}
    <ProfileForm t={t} value={value} busy={busy} error={error} onChange={change} onSubmit={submit} />
  </section>;
}

export function PublicProfile({ sdk, t, userId }) {
  const api = useMemoized(() => participantApi(sdk, sdk.activeTenantId), sdk);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    setLoading(true); setError('');
    api.view(userId).then(setProfile).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [userId]);
  if (loading) return <p role="status">{t('loading')}</p>;
  if (error) return <p role="alert">{t(error.replace('stir.', ''))}</p>;
  return <section className="stir-panel">
    {profile.avatarAttachmentId && <AttachmentImage sdk={sdk} attachmentId={profile.avatarAttachmentId} alt={t('avatarOf') + ' ' + profile.displayName} className="stir-avatar" />}
    <h2>{profile.displayName}</h2>
    {profile.location && <p>⌖ {profile.location}</p>}
    {profile.bio && <p className="stir-description">{profile.bio}</p>}
  </section>;
}

function useMemoized(factory, dep) { const { useMemo } = React; return useMemo(factory, [dep]); }

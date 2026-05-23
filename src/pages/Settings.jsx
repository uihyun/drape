import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Zap, LogOut, ChevronRight, Trash2 } from 'lucide-react';
import { IdentityService } from '../services/identity-service.js';
import { CameraService } from '../services/camera.js';
import { ProfileService, HANDLE_RE, BIO_MAX, DISPLAY_NAME_MAX, INSTAGRAM_MAX, LOCATION_MAX } from '../services/profile-service.js';
import { useLocale, LANG_LABELS, SUPPORTED_LANGS } from '../hooks/useLocale.jsx';
import { useCredits } from '../services/credits-service.js';

// One Settings page (Lekondo tone). Sections, ordered by frequency of use:
// 1. Profile — handle (one-time claim), displayName, bio, instagram, location
// 2. Try-on identity refs (existing flow)
// 3. Account — language, credits, sign out
// 4. Legal — privacy, terms, support
export function Settings({ user, onSignIn, onSignOut }) {
  const { t, lang, setLang } = useLocale();
  const credits = useCredits(user);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!user || user.isAnonymous) { setProfile(null); return; }
    return ProfileService.subscribeByUid(user.uid, setProfile);
  }, [user]);

  if (!user || user.isAnonymous) {
    return (
      <div className="settings">
        <div className="empty-state">
          <h2>{t('settings')}</h2>
          <p>{t('settingsSignInBody')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="settings">
      <h1 className="settings-h1">{t('settings')}</h1>

      <ProfileSection profile={profile} user={user} t={t} />
      <IdentitySection user={user} t={t} />
      <AccountSection
        user={user}
        credits={credits}
        lang={lang}
        setLang={setLang}
        onSignOut={onSignOut}
        t={t}
      />
      <LegalSection t={t} />
    </div>
  );
}

function ProfileSection({ profile, user, t }) {
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  // Sync inputs from server snapshot once available — but only if the
  // user hasn't started typing (otherwise their in-flight edits get
  // clobbered). We compare against the controlled state.
  useEffect(() => {
    if (!profile) return;
    setHandle(prev => prev || profile.handle || '');
    setDisplayName(prev => prev || profile.displayName || user.displayName || '');
    setBio(prev => prev || profile.bio || '');
    setInstagram(prev => prev || profile.instagram || '');
    setLocation(prev => prev || profile.location || '');
  }, [profile?.handle, profile?.displayName, profile?.bio, profile?.instagram, profile?.location]);

  const claimedHandle = profile?.handle || '';
  const canClaim = !claimedHandle && HANDLE_RE.test(handle);

  const flash = (msg) => {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(null), 1800);
  };

  const onClaim = async () => {
    setErr(null);
    setBusy('handle');
    try {
      await ProfileService.claimHandle(handle.trim().toLowerCase());
      flash(t('saved'));
    } catch (e) {
      setErr(e.code === 'HANDLE_TAKEN' ? t('handleTaken') : (e.message || 'Failed'));
    } finally { setBusy(null); }
  };

  const onSave = async (field, value, updater) => {
    setErr(null);
    setBusy(field);
    try {
      await updater(value);
      flash(t('saved'));
    } catch (e) {
      setErr(e.message || 'Failed');
    } finally { setBusy(null); }
  };

  return (
    <section className="settings-card">
      <h2 className="settings-h2">{t('profile')}</h2>

      {/* Handle (one-time claim, immutable once set in v1) */}
      <div className="settings-row settings-row-col">
        <label className="settings-label">{t('handle')}</label>
        {claimedHandle ? (
          <p className="settings-static">@{claimedHandle} <span className="muted">· {t('handleImmutable')}</span></p>
        ) : (
          <div className="settings-input-row">
            <span className="settings-input-prefix">@</span>
            <input
              className="settings-input"
              value={handle}
              onChange={e => setHandle(e.target.value.toLowerCase())}
              placeholder={t('handlePlaceholder')}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button
              type="button"
              className="settings-save-btn"
              disabled={!canClaim || busy === 'handle'}
              onClick={onClaim}
            >
              {busy === 'handle' ? t('saving') : t('claim')}
            </button>
          </div>
        )}
        <p className="settings-hint">{t('handleHint')}</p>
      </div>

      <FieldRow
        label={t('displayName')}
        value={displayName}
        setValue={setDisplayName}
        max={DISPLAY_NAME_MAX}
        placeholder={t('displayNamePlaceholder')}
        busy={busy === 'displayName'}
        onSave={() => onSave('displayName', displayName, ProfileService.updateDisplayName)}
        t={t}
      />
      <FieldRow
        label={t('bio')}
        value={bio}
        setValue={setBio}
        max={BIO_MAX}
        placeholder={t('bioPlaceholder')}
        textarea
        busy={busy === 'bio'}
        onSave={() => onSave('bio', bio, ProfileService.updateBio)}
        t={t}
      />
      <FieldRow
        label={t('location')}
        value={location}
        setValue={setLocation}
        max={LOCATION_MAX}
        placeholder={t('locationPlaceholder')}
        busy={busy === 'location'}
        onSave={() => onSave('location', location, ProfileService.updateLocation)}
        t={t}
      />
      <FieldRow
        label={t('instagram')}
        value={instagram}
        setValue={setInstagram}
        prefix="@"
        max={INSTAGRAM_MAX}
        placeholder={t('instagramPlaceholder')}
        busy={busy === 'instagram'}
        onSave={() => onSave('instagram', instagram, ProfileService.updateInstagram)}
        t={t}
      />

      {err && <p className="settings-error">{err}</p>}
      {okMsg && <p className="settings-ok">{okMsg}</p>}
    </section>
  );
}

function FieldRow({ label, value, setValue, max, placeholder, prefix, textarea, busy, onSave, t }) {
  return (
    <div className="settings-row settings-row-col">
      <label className="settings-label">{label}</label>
      <div className="settings-input-row">
        {prefix && <span className="settings-input-prefix">{prefix}</span>}
        {textarea ? (
          <textarea
            className="settings-input"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            maxLength={max}
            rows={3}
          />
        ) : (
          <input
            className="settings-input"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            maxLength={max}
          />
        )}
        <button
          type="button"
          className="settings-save-btn"
          onClick={onSave}
          disabled={busy}
        >
          {busy ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}

function IdentitySection({ user, t }) {
  const [refs, setRefs] = useState([]);
  const [adding, setAdding] = useState(false);
  const fileInput = useRef();

  useEffect(() => {
    IdentityService.getMyRefs().then(setRefs).catch(() => setRefs([]));
  }, [user.uid]);

  const onAdd = async (file) => {
    if (!file) return;
    setAdding(true);
    try {
      const blob = await CameraService.compressImage(file);
      setRefs(await IdentityService.addRef(blob));
    } catch (e) { alert(e.message); }
    finally { setAdding(false); }
  };
  const onRemove = async (i) => setRefs(await IdentityService.removeRef(i));

  return (
    <section className="settings-card">
      <h2 className="settings-h2">{t('identityRefsTitle')}</h2>
      <p className="settings-hint">{t('identityRefsHint', { max: IdentityService.MAX_IDENTITY_REFS })}</p>
      <div className="identity-refs">
        {refs.map((r, i) => (
          <div key={i} className="identity-ref">
            <img src={r.url} alt="" />
            <button type="button" className="slot-remove" onClick={() => onRemove(i)} aria-label={t('remove')}>
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          </div>
        ))}
        {refs.length < IdentityService.MAX_IDENTITY_REFS && (
          <button
            type="button"
            className="identity-ref identity-ref-add"
            onClick={() => fileInput.current?.click()}
            disabled={adding}
          >
            <Camera size={20} strokeWidth={1.5} />
            <span>{adding ? t('uploading') : t('addRef')}</span>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => onAdd(e.target.files?.[0])}
            />
          </button>
        )}
      </div>
    </section>
  );
}

function AccountSection({ user, credits, lang, setLang, onSignOut, t }) {
  return (
    <section className="settings-card">
      <h2 className="settings-h2">{t('account')}</h2>

      <div className="settings-row">
        <span className="settings-row-label">{t('signedInAs')}</span>
        <span className="settings-row-value">{user.email || user.displayName || user.uid.slice(0, 8)}</span>
      </div>

      <div className="settings-row">
        <span className="settings-row-label">
          <Zap size={14} strokeWidth={1.8} style={{ marginRight: 4, verticalAlign: -2 }} />
          {t('credits')}
        </span>
        <span className="settings-row-value">{credits?.credits ?? '—'}</span>
      </div>

      <div className="settings-row">
        <span className="settings-row-label">{t('langLabel')}</span>
        <select
          className="settings-select"
          value={lang}
          onChange={e => setLang(e.target.value)}
          aria-label={t('langLabel')}
        >
          {SUPPORTED_LANGS.map(code => (
            <option key={code} value={code}>{LANG_LABELS[code]}</option>
          ))}
        </select>
      </div>

      <button type="button" className="settings-row settings-row-action" onClick={onSignOut}>
        <span className="settings-row-label">
          <LogOut size={14} strokeWidth={1.8} style={{ marginRight: 4, verticalAlign: -2 }} />
          {t('signOut')}
        </span>
        <ChevronRight size={16} strokeWidth={1.5} className="muted" />
      </button>
    </section>
  );
}

function LegalSection({ t }) {
  return (
    <section className="settings-card">
      <h2 className="settings-h2">{t('legal')}</h2>
      <Link to="/privacy" className="settings-row settings-row-action">
        <span className="settings-row-label">{t('privacyPolicy')}</span>
        <ChevronRight size={16} strokeWidth={1.5} className="muted" />
      </Link>
      <Link to="/terms" className="settings-row settings-row-action">
        <span className="settings-row-label">{t('termsOfService')}</span>
        <ChevronRight size={16} strokeWidth={1.5} className="muted" />
      </Link>
      <Link to="/support" className="settings-row settings-row-action">
        <span className="settings-row-label">{t('support')}</span>
        <ChevronRight size={16} strokeWidth={1.5} className="muted" />
      </Link>
    </section>
  );
}

export default Settings;

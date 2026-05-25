import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Zap, LogOut, ChevronRight, Trash2, AlertTriangle, X } from 'lucide-react';
import { IdentityService } from '../services/identity-service.js';
import { CameraService } from '../services/camera.js';
import { ProfileService, HANDLE_RE, BIO_MAX, DISPLAY_NAME_MAX, INSTAGRAM_MAX, LOCATION_MAX } from '../services/profile-service.js';
import { DeleteAccountModal } from '../components/DeleteAccountModal.jsx';
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
      <DangerSection t={t} />
    </div>
  );
}

function DangerSection({ t }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <section className="settings-card settings-danger">
      <h2 className="settings-h2">{t('dangerZone')}</h2>
      <button
        type="button"
        className="settings-row settings-row-action settings-row-danger"
        onClick={() => setOpen(true)}
      >
        <span className="settings-row-label">
          <AlertTriangle size={14} strokeWidth={1.8} style={{ marginRight: 4, verticalAlign: -2 }} />
          {t('deleteAccount')}
        </span>
        <ChevronRight size={16} strokeWidth={1.5} className="muted" />
      </button>
      {open && (
        <DeleteAccountModal
          onClose={() => setOpen(false)}
          onDeleted={() => navigate('/welcome', { replace: true })}
        />
      )}
    </section>
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
  // Backend claimHandle txn already supports re-claim (drops the old
  // handle doc and writes the new one atomically), so the field is
  // always editable. Disabled only when the input equals the current
  // handle (nothing to save) or fails the regex.
  const canClaim = HANDLE_RE.test(handle) && handle.trim().toLowerCase() !== claimedHandle;

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

      {/* Handle — editable. The handles/<doc> collection is rewritten
          atomically by the claimHandle Cloud Function (drops old, claims
          new), so changing it is safe and the user's uid is unaffected. */}
      <div className="settings-row settings-row-col">
        <label className="settings-label">{t('handle')}</label>
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
            {busy === 'handle' ? t('saving') : t('save')}
          </button>
        </div>
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
  const [previewUrl, setPreviewUrl] = useState(null);
  // Pointer-drag reorder state. dragIdx = currently dragging slot;
  // overIdx = hovered drop target. We separate "press start" (recorded
  // in pressRef) from "drag active" so a tap can still trigger the
  // photo preview — drag only kicks in once the pointer moves past a
  // small threshold. Touch-action: pan-y on the slot lets the page
  // scroll vertically even when the finger lands on a slot.
  const [dragIdx, setDragIdx] = useState(-1);
  const [overIdx, setOverIdx] = useState(-1);
  const pressRef = useRef(null);
  const fileInput = useRef();
  const DRAG_THRESHOLD = 6;

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

  const onSlotDown = (e, i) => {
    if (e.target.closest('button')) return; // let buttons handle their own tap
    pressRef.current = { idx: i, x: e.clientX, y: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onSlotMove = (e, i) => {
    const p = pressRef.current;
    if (!p) return;
    if (dragIdx === -1) {
      const dx = Math.abs(e.clientX - p.x);
      const dy = Math.abs(e.clientY - p.y);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        setDragIdx(p.idx);
      }
    } else if (i !== overIdx) {
      setOverIdx(i);
    }
  };
  const onSlotUp = async () => {
    const from = dragIdx;
    const to = overIdx;
    pressRef.current = null;
    setDragIdx(-1);
    setOverIdx(-1);
    if (from < 0 || to < 0 || from === to) return;
    const order = refs.map((_, i) => i);
    const [picked] = order.splice(from, 1);
    order.splice(to, 0, picked);
    setRefs(await IdentityService.reorderRefs(order));
  };
  const onSlotCancel = () => {
    pressRef.current = null;
    setDragIdx(-1);
    setOverIdx(-1);
  };

  return (
    <section className="settings-card">
      <h2 className="settings-h2">{t('identityRefsTitle')}</h2>
      <p className="settings-hint">{t('identityRefsHint', { max: IdentityService.MAX_IDENTITY_REFS })}</p>
      {refs.length > 0 && (
        <p className="settings-hint identity-refs-primary-hint">
          {t('identityRefsPrimaryDragHint')}
        </p>
      )}
      <div className="identity-refs">
        {refs.map((r, i) => (
          <div
            key={i}
            className={`identity-ref${i === 0 ? ' is-primary' : ''}${dragIdx === i ? ' is-dragging' : ''}${overIdx === i && dragIdx !== i ? ' is-drop-target' : ''}`}
            onPointerDown={(e) => onSlotDown(e, i)}
            onPointerMove={(e) => onSlotMove(e, i)}
            onPointerEnter={() => { if (dragIdx !== -1 && dragIdx !== i) setOverIdx(i); }}
            onPointerUp={onSlotUp}
            onPointerCancel={onSlotCancel}
          >
            <button
              type="button"
              className="identity-ref-preview-btn"
              onClick={() => dragIdx === -1 && setPreviewUrl(r.url)}
              aria-label={t('view')}
            >
              <img src={r.url} alt="" />
            </button>
            {i === 0 && <span className="identity-ref-badge">{t('identityRefsPrimaryBadge')}</span>}
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
      {previewUrl && (
        <div className="lightbox" onClick={() => setPreviewUrl(null)} role="dialog">
          <button type="button" className="lightbox-close" onClick={() => setPreviewUrl(null)} aria-label={t('close')}>
            <X size={22} strokeWidth={1.8} />
          </button>
          <img src={previewUrl} alt="" onClick={e => e.stopPropagation()} />
        </div>
      )}
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

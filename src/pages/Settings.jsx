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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  // Server-truth snapshot for the dirty-check on the single Save button.
  const original = {
    handle: profile?.handle || '',
    displayName: profile?.displayName || user.displayName || '',
    bio: profile?.bio || '',
    instagram: profile?.instagram || '',
    location: profile?.location || '',
  };

  // Sync inputs from server snapshot once available — but only if the
  // user hasn't started typing (otherwise their in-flight edits get
  // clobbered).
  useEffect(() => {
    if (!profile) return;
    setHandle(prev => prev || profile.handle || '');
    setDisplayName(prev => prev || profile.displayName || user.displayName || '');
    setBio(prev => prev || profile.bio || '');
    setInstagram(prev => prev || profile.instagram || '');
    setLocation(prev => prev || profile.location || '');
  }, [profile?.handle, profile?.displayName, profile?.bio, profile?.instagram, profile?.location]);

  const handleNormalized = handle.trim().toLowerCase();
  // Per-field dirty + validity flags drive the single Save button.
  const handleChanged = handleNormalized !== original.handle;
  const handleValid = handle === '' || HANDLE_RE.test(handle);
  const displayNameChanged = displayName !== original.displayName;
  const bioChanged = bio !== original.bio;
  const locationChanged = location !== original.location;
  const instagramChanged = instagram !== original.instagram;
  const anyChanged = handleChanged || displayNameChanged || bioChanged || locationChanged || instagramChanged;
  const canSave = anyChanged && (!handleChanged || (handleValid && handle !== ''));

  const flash = (msg) => {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(null), 1800);
  };

  const onSaveAll = async () => {
    if (!canSave || busy) return;
    setErr(null);
    setBusy(true);
    try {
      // claimHandle first — it owns the atomic swap of /handles/<doc> +
      // /profiles/<uid>.handle. Running other updates in parallel after
      // is fine since they touch separate fields.
      if (handleChanged) {
        await ProfileService.claimHandle(handleNormalized);
      }
      const updates = [];
      if (displayNameChanged) updates.push(ProfileService.updateDisplayName(displayName));
      if (bioChanged) updates.push(ProfileService.updateBio(bio));
      if (locationChanged) updates.push(ProfileService.updateLocation(location));
      if (instagramChanged) updates.push(ProfileService.updateInstagram(instagram));
      await Promise.all(updates);
      flash(t('saved'));
    } catch (e) {
      setErr(e.code === 'HANDLE_TAKEN' ? t('handleTaken') : (e.message || 'Failed'));
    } finally { setBusy(false); }
  };

  return (
    <section className="settings-card">
      <h2 className="settings-h2">{t('profile')}</h2>

      <FieldRow
        label={t('handle')}
        value={handle}
        setValue={(v) => setHandle(v.toLowerCase())}
        prefix="@"
        max={20}
        placeholder={t('handlePlaceholder')}
        hint={t('handleHint')}
        error={handleChanged && !handleValid ? t('handleHint') : null}
        autoCapitalize="none"
        autoCorrect="off"
      />
      <FieldRow
        label={t('displayName')}
        value={displayName}
        setValue={setDisplayName}
        max={DISPLAY_NAME_MAX}
        placeholder={t('displayNamePlaceholder')}
      />
      <FieldRow
        label={t('bio')}
        value={bio}
        setValue={setBio}
        max={BIO_MAX}
        placeholder={t('bioPlaceholder')}
        textarea
      />
      <FieldRow
        label={t('location')}
        value={location}
        setValue={setLocation}
        max={LOCATION_MAX}
        placeholder={t('locationPlaceholder')}
      />
      <FieldRow
        label={t('instagram')}
        value={instagram}
        setValue={setInstagram}
        prefix="@"
        max={INSTAGRAM_MAX}
        placeholder={t('instagramPlaceholder')}
      />

      {err && <p className="settings-error">{err}</p>}
      {okMsg && <p className="settings-ok">{okMsg}</p>}

      <div className="settings-card-footer">
        <button
          type="button"
          className="btn btn-primary settings-save-all"
          onClick={onSaveAll}
          disabled={!canSave || busy}
        >
          {busy ? t('saving') : t('save')}
        </button>
      </div>
    </section>
  );
}

function FieldRow({ label, value, setValue, max, placeholder, prefix, textarea, hint, error, autoCapitalize, autoCorrect }) {
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
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
          />
        )}
      </div>
      {error
        ? <p className="settings-error">{error}</p>
        : hint ? <p className="settings-hint">{hint}</p> : null}
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
  // Set when a pointerdown turned into a drag; checked by the preview
  // button's onClick to suppress the lightbox open that would otherwise
  // fire right after a drag (since the photo IS the preview button —
  // the click event fires regardless of how we handled the pointer
  // sequence).
  const justDraggedRef = useRef(false);
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
    // Only the trash icon must NOT start a drag — the preview button
    // wraps the whole photo so excluding all buttons here was killing
    // every drag attempt before it started.
    if (e.target.closest('.slot-remove')) return;
    pressRef.current = { idx: i, x: e.clientX, y: e.clientY };
    // Capture pointer on the source slot — guarantees we get pointermove
    // + pointerup even if the finger moves off the element. Drop target
    // is found via document.elementFromPoint below.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onSlotMove = (e) => {
    const p = pressRef.current;
    if (!p) return;
    const dx = Math.abs(e.clientX - p.x);
    const dy = Math.abs(e.clientY - p.y);
    if (dragIdx === -1) {
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        setDragIdx(p.idx);
      }
      return;
    }
    // Drag active: find the slot under the pointer via hit-testing.
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const slot = el?.closest?.('.identity-ref:not(.identity-ref-add)');
    const idxStr = slot?.getAttribute('data-ref-idx');
    const targetIdx = idxStr === null || idxStr === undefined ? -1 : Number(idxStr);
    if (targetIdx !== overIdx) setOverIdx(targetIdx);
  };
  const onSlotUp = async () => {
    const from = dragIdx;
    const to = overIdx;
    const wasDragging = from !== -1;
    pressRef.current = null;
    setDragIdx(-1);
    setOverIdx(-1);
    if (wasDragging) {
      // Suppress the click that fires immediately after pointerup on the
      // preview button. Reset on the next tick after the click handler
      // has had a chance to bail.
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 0);
    }
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
            data-ref-idx={i}
            className={`identity-ref${i === 0 ? ' is-primary' : ''}${dragIdx === i ? ' is-dragging' : ''}${overIdx === i && dragIdx !== i ? ' is-drop-target' : ''}`}
            onPointerDown={(e) => onSlotDown(e, i)}
            onPointerMove={onSlotMove}
            onPointerUp={onSlotUp}
            onPointerCancel={onSlotCancel}
          >
            <button
              type="button"
              className="identity-ref-preview-btn"
              onClick={() => {
                if (justDraggedRef.current) return;
                setPreviewUrl(r.url);
              }}
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

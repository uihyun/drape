import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Image as ImageIcon, Camera as CameraIcon, Trash2, Search } from 'lucide-react';
import { OotdService } from '../services/ootd-service.js';
import { BoardService } from '../services/board-service.js';
import { GenerationService } from '../services/generation-service.js';
import { CameraService } from '../services/camera.js';
import { CameraCaptureModal } from './CameraCaptureModal.jsx';
import { isNativeApp } from '../services/platform-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

const isMobileUA = typeof navigator !== 'undefined'
  && /iPhone|iPad|iPod|Android/.test(navigator.userAgent || '');

// Sheet that opens when the user taps a Calendar cell. Lets them log
// today's (or that date's) OOTD — pick a photo, optionally link a board
// or try-on they made that same day, leave a quick note. Same date can
// be re-saved later to add more (OotdService.upsertOotd merges).
export function OotdSheet({ open, date, user, existing, onClose, onSaved }) {
  const { t } = useLocale();
  const fileRef = useRef();
  const [boards, setBoards] = useState([]);
  const [tryons, setTryons] = useState([]);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [linkedId, setLinkedId] = useState('');
  const [linkedType, setLinkedType] = useState('');
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [linkSearch, setLinkSearch] = useState('');

  // Seed from existing OOTD on open (edit case).
  useEffect(() => {
    if (!open) return;
    setPhotoBlob(null);
    setPhotoPreview(existing?.photoUrl || null);
    setLinkedId(existing?.outfitId || '');
    setLinkedType(existing?.linkedType || (existing?.outfitId ? 'outfit' : ''));
    setNote(existing?.note || '');
    setIsPublic(existing?.isPublic === true);
    setLinkSearch('');
    setError(null);
  }, [open, existing?.id]);

  useEffect(() => {
    if (!open || !user || user.isAnonymous) return;
    let cancelled = false;
    BoardService.listMyBoards({ pageSize: 30 })
      .then(b => { if (!cancelled) setBoards(b || []); })
      .catch(() => setBoards([]));
    GenerationService.listMyGenerations({ uid: user.uid, pageSize: 30 })
      .then(({ generations }) => { if (!cancelled) setTryons(generations || []); })
      .catch(() => setTryons([]));
    return () => { cancelled = true; };
  }, [open, user]);

  // Local object URL preview when a fresh blob is staged.
  useEffect(() => {
    if (!photoBlob) return;
    const url = URL.createObjectURL(photoBlob);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoBlob]);

  // Link candidates: every ready try-on + every board, newest first.
  // NOT day-bound — a try-on or board is usually made ahead of time to
  // plan a look, then worn (and logged) on a later day, possibly more
  // than once. Restricting to same-day creations hid exactly the items
  // the user wants to attach.
  const candidates = useMemo(() => {
    const tryonCards = tryons
      .filter(g => g.status === 'ready' && (g.variantUrls?.length ?? 0) > 0)
      .map(g => ({
        kind: 'tryon',
        id: g.id,
        label: g.title || t('tryOnBadge'),
        thumbUrl: g.variantUrls?.[0] || null,
        sortMs: g.createdAt?.toMillis?.() ?? 0,
      }));
    const boardCards = boards.map(b => ({
      kind: 'board',
      id: b.id,
      label: b.name || t('untitledBoard'),
      thumbUrl: b.coverUrl || null,
      sortMs: b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0,
    }));
    return [...tryonCards, ...boardCards].sort((a, b) => b.sortMs - a.sortMs);
  }, [boards, tryons, t]);

  // Filter the picker by label (try-on title / board name) — once a user
  // has many saved looks the horizontal strip alone isn't enough.
  const visibleCandidates = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(c => (c.label || '').toLowerCase().includes(q));
  }, [candidates, linkSearch]);

  if (!open) return null;

  const stagePicked = (file) => {
    if (!file) return;
    setError(null);
    setPhotoBlob(file);
  };

  const toggleCard = (c) => {
    if (linkedId === c.id && linkedType === c.kind) {
      setLinkedId(''); setLinkedType('');
    } else {
      setLinkedId(c.id); setLinkedType(c.kind);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      let blob = null;
      let photoUrlFromTryon = null;
      if (photoBlob) {
        blob = await CameraService.compressImage(photoBlob);
      } else if (linkedType === 'tryon' && linkedId) {
        // Derive the OOTD photo from the linked try-on variant UNLESS a
        // user-uploaded photo already owns the slot. We key off photoPath
        // (set only for uploaded blobs) instead of photoUrl — a try-on-
        // derived photo has photoUrl but no photoPath, so switching the
        // linked try-on on such an OOTD correctly swaps the image.
        const gen = tryons.find(g => g.id === linkedId);
        const variantUrl = gen?.variantUrls?.[0] || null;
        const userUploaded = !!existing?.photoPath;
        // Only push a new URL when it actually changes the current photo —
        // avoids a needless re-process when the same try-on stays linked.
        if (variantUrl && !userUploaded && variantUrl !== existing?.photoUrl) {
          photoUrlFromTryon = variantUrl;
        }
      }
      await OotdService.upsertOotd({
        // existing.id present → update that specific OOTD; absent →
        // addDoc creates a brand-new entry for the date (multi-OOTD).
        id: existing?.id || null,
        date,
        outfitId: linkedId || null,
        linkedType: linkedId ? linkedType : null,
        photoBlob: blob, // only re-uploads if a new blob is staged
        photoUrlFromTryon,
        note: note.trim(),
        isPublic,
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e.message || 'save_failed');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!existing?.id) { onClose?.(); return; }
    if (!confirm(t('ootdConfirmDelete'))) return;
    setSaving(true);
    try {
      await OotdService.deleteOotd({ id: existing.id });
      onSaved?.();
      onClose?.();
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="create-sheet-overlay" onClick={onClose}>
        <div className="create-sheet ootd-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="create-sheet-handle" />
          <button type="button" className="create-sheet-close" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>

          <header className="ootd-sheet-head">
            <span className="ootd-sheet-date">{date}</span>
            <h3 className="create-sheet-title" style={{ margin: 0 }}>{t('ootdSheetTitle')}</h3>
          </header>

          {/* Photo area */}
          <div className="ootd-sheet-photo">
            {photoPreview ? (
              <img src={photoPreview} alt="" />
            ) : (
              <div className="ootd-sheet-photo-empty">{t('ootdPickPhoto')}</div>
            )}
          </div>

          <div className="ootd-sheet-photo-actions">
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              <ImageIcon size={14} strokeWidth={1.7} /> {t('uploadPhoto')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => stagePicked(e.target.files?.[0])}
            />
            {isMobileUA && !isNativeApp() ? (
              <label className="btn btn-secondary">
                <CameraIcon size={14} strokeWidth={1.7} /> {t('takePhoto')}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => stagePicked(e.target.files?.[0])}
                />
              </label>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => setCameraOpen(true)}>
                <CameraIcon size={14} strokeWidth={1.7} /> {t('takePhoto')}
              </button>
            )}
          </div>

          {/* Outfit linker — try-ons + boards (newest first, any date) */}
          <label className="ootd-sheet-label">{t('ootdLinkOutfit')}</label>
          {candidates.length > 10 && (
            <div className="closet-search-bar ootd-link-search">
              <Search size={15} strokeWidth={1.6} />
              <input
                type="search"
                value={linkSearch}
                onChange={e => setLinkSearch(e.target.value)}
                placeholder={t('ootdLinkSearchPlaceholder')}
                className="closet-search-input"
              />
              {linkSearch && (
                <button type="button" className="icon-btn" onClick={() => setLinkSearch('')} aria-label={t('clear')}>
                  <X size={15} strokeWidth={1.7} />
                </button>
              )}
            </div>
          )}
          {candidates.length > 0 ? (
            <div className="ootd-link-row">
              <button
                type="button"
                className={`ootd-link-card none${!linkedId ? ' selected' : ''}`}
                onClick={() => { setLinkedId(''); setLinkedType(''); }}
              >
                <div className="ootd-link-thumb ootd-link-thumb-none"><span>—</span></div>
                <span className="ootd-link-label">{t('ootdNoOutfit')}</span>
              </button>
              {visibleCandidates.map(c => {
                const selected = linkedId === c.id && linkedType === c.kind;
                return (
                  <button
                    key={`${c.kind}-${c.id}`}
                    type="button"
                    className={`ootd-link-card${selected ? ' selected' : ''}`}
                    onClick={() => toggleCard(c)}
                  >
                    <div className="ootd-link-thumb">
                      {c.thumbUrl
                        ? <img src={c.thumbUrl} alt={c.label} loading="lazy" />
                        : <div className="item-card-skeleton" />}
                      <span className={`ootd-link-badge ${c.kind}`}>{t(`ootdLinkKind_${c.kind}`)}</span>
                    </div>
                    <span className="ootd-link-label">{c.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="ootd-link-empty">{t('ootdLinkEmpty')}</p>
          )}

          {/* Note */}
          <label className="ootd-sheet-label">{t('ootdNoteLabel')}</label>
          <textarea
            className="ootd-sheet-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('ootdNotePlaceholder')}
            rows={2}
            maxLength={200}
          />

          {/* Publish toggle */}
          <label className="ootd-sheet-public">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
            />
            <span className="ootd-sheet-public-label">
              <strong>{t('ootdPublishLabel')}</strong>
              <small>{t('ootdPublishHint')}</small>
            </span>
          </label>

          {error && <p className="settings-error" style={{ margin: '0.5rem 0' }}>{error}</p>}

          <div className="ootd-sheet-actions">
            {existing && (
              <button type="button" className="btn btn-secondary danger-btn" onClick={remove} disabled={saving}>
                <Trash2 size={14} strokeWidth={1.7} /> {t('delete')}
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              {t('cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={saving || (!photoBlob && !existing?.photoUrl && !linkedId && !note.trim())}
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      </div>

      <CameraCaptureModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(blob) => { setCameraOpen(false); stagePicked(blob); }}
      />
    </>
  );
}

export default OotdSheet;

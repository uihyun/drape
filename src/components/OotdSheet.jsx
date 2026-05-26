import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Image as ImageIcon, Camera as CameraIcon, Trash2 } from 'lucide-react';
import { OotdService } from '../services/ootd-service.js';
import { BoardService } from '../services/board-service.js';
import { GenerationService } from '../services/generation-service.js';
import { CameraService } from '../services/camera.js';
import { CameraCaptureModal } from './CameraCaptureModal.jsx';
import { isNativeApp } from '../services/platform-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

const isMobileUA = typeof navigator !== 'undefined'
  && /iPhone|iPad|iPod|Android/.test(navigator.userAgent || '');

// Half-open [startMs, endMs) for the local day at YYYY-MM-DD. Local TZ
// is intentional — the OOTD date the user typed matches their wall clock,
// not UTC.
function dayBounds(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  return [start, start + 24 * 60 * 60 * 1000];
}

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

  // Seed from existing OOTD on open (edit case).
  useEffect(() => {
    if (!open) return;
    setPhotoBlob(null);
    setPhotoPreview(existing?.photoUrl || null);
    setLinkedId(existing?.outfitId || '');
    setLinkedType(existing?.linkedType || (existing?.outfitId ? 'outfit' : ''));
    setNote(existing?.note || '');
    setIsPublic(existing?.isPublic === true);
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

  // Today-bound link candidates: ready try-ons (createdAt in-day) +
  // boards (updatedAt or createdAt in-day). Newest first.
  const candidates = useMemo(() => {
    if (!date) return [];
    const [startMs, endMs] = dayBounds(date);
    const inDay = (ts) => {
      const ms = ts?.toMillis?.() ?? 0;
      return ms >= startMs && ms < endMs;
    };
    const tryonCards = tryons
      .filter(g => g.status === 'ready'
        && (g.variantUrls?.length ?? 0) > 0
        && inDay(g.createdAt))
      .map(g => ({
        kind: 'tryon',
        id: g.id,
        label: t('tryOnBadge'),
        thumbUrl: g.variantUrls?.[0] || null,
        sortMs: g.createdAt?.toMillis?.() ?? 0,
      }));
    const boardCards = boards
      .filter(b => inDay(b.updatedAt) || inDay(b.createdAt))
      .map(b => ({
        kind: 'board',
        id: b.id,
        label: b.name || t('untitledBoard'),
        thumbUrl: b.coverUrl || null,
        sortMs: b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0,
      }));
    return [...tryonCards, ...boardCards].sort((a, b) => b.sortMs - a.sortMs);
  }, [boards, tryons, date, t]);

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
      if (photoBlob) {
        blob = await CameraService.compressImage(photoBlob);
      }
      await OotdService.upsertOotd({
        date,
        outfitId: linkedId || null,
        linkedType: linkedId ? linkedType : null,
        photoBlob: blob, // only re-uploads if a new blob is staged
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
    if (!existing) { onClose?.(); return; }
    if (!confirm(t('ootdConfirmDelete'))) return;
    setSaving(true);
    try {
      await OotdService.deleteOotd({ uid: user.uid, date });
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

          {/* Outfit linker — try-ons + boards made on this date */}
          <label className="ootd-sheet-label">{t('ootdLinkOutfit')}</label>
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
              {candidates.map(c => {
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
                      <span className={`ootd-link-badge ${c.kind}`}>{c.label}</span>
                    </div>
                    <span className="ootd-link-label">{c.kind === 'board' ? c.label : t('tryOnBadge')}</span>
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

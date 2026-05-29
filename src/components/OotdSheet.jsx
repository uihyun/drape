import { useEffect, useRef, useState } from 'react';
import { X, Image as ImageIcon, Camera as CameraIcon, Trash2 } from 'lucide-react';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
import { OutfitService } from '../services/outfit-service.js';
import { CameraService } from '../services/camera.js';
import { CameraCaptureModal } from './CameraCaptureModal.jsx';
import { isNativeApp } from '../services/platform-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

const isMobileUA = typeof navigator !== 'undefined'
  && /iPhone|iPad|iPod|Android/.test(navigator.userAgent || '');

// Sheet that opens when the user taps a Calendar cell. Logs that date's
// OOTD — a photo of what they wore + a quick note. Linking the actual
// closet items / boards happens on a separate, closet-sized page after
// save (onSaved receives the saved id). Same date can hold multiple OOTDs.
export function OotdSheet({ open, date, user, existing, onClose, onSaved }) {
  const { t } = useLocale();
  const { sheetStyle: ootdSheetStyle, handleProps: ootdHandleProps } = useSheetDrag(onClose);
  const fileRef = useRef();
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
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
    setNote(existing?.note || '');
    setIsPublic(existing?.isPublic === true);
    setError(null);
  }, [open, existing?.id]);

  // Local object URL preview when a fresh blob is staged.
  useEffect(() => {
    if (!photoBlob) return;
    const url = URL.createObjectURL(photoBlob);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoBlob]);

  if (!open) return null;

  const stagePicked = (file) => {
    if (!file) return;
    setError(null);
    setPhotoBlob(file);
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
      const { id } = await OutfitService.upsertOotd({
        id: existing?.id || null,
        date,
        photoBlob: blob, // only re-uploads if a new blob is staged
        note: note.trim(),
        isPublic,
      });
      onSaved?.(id);
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
      await OutfitService.deleteOotd({ id: existing.id });
      onSaved?.();
      onClose?.();
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="create-sheet-overlay" onClick={onClose}>
        <div className="create-sheet ootd-sheet" style={ootdSheetStyle} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="create-sheet-handle" {...ootdHandleProps} style={{ cursor: 'grab' }} />
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

          {/* Item / board linking moved to a dedicated closet-sized page
              opened after save (so search + multi-select fit). */}

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
              disabled={saving || (!photoBlob && !existing?.photoUrl && !note.trim())}
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

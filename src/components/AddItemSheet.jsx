import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, Camera as CameraIcon, X, Layers, ChevronRight } from 'lucide-react';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
import { ItemService } from '../services/item-service.js';
import { CameraService } from '../services/camera.js';
import { CameraCaptureModal } from './CameraCaptureModal.jsx';
import { isNativeApp } from '../services/platform-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Quick closet-add as a bottom sheet (photo + an optional shop URL to jump
// straight to where it's sold). Mirrors OotdSheet so the create menu feels
// consistent; the heavy flows (try-on, analyze, builders) stay full pages.
// Naming/tagging is still auto-filled server-side after upload.
export function AddItemSheet({ open, user, onClose, onSaved }) {
  const { t } = useLocale();
  const { sheetStyle, handleProps } = useSheetDrag(onClose);
  const fileRef = useRef();
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [url, setUrl] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setBlob(null); setPreview(null); setUrl(''); setError(null);
  }, [open]);

  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  if (!open) return null;

  const pick = (file) => { if (file) setBlob(file); };

  // Take photo must reach the actual camera on every platform: the native
  // Capacitor camera on device, the web getUserMedia modal on desktop.
  // (Mobile web uses an <input capture> below — most reliable there.)
  const handleTakePhoto = async () => {
    if (isNativeApp()) {
      try {
        const b = await CameraService.takePhoto();
        if (b) pick(b);
      } catch (e) {
        setError(e?.message || 'camera_failed');
      }
      return;
    }
    setCameraOpen(true);
  };

  const save = async () => {
    if (!blob || saving) return;
    setSaving(true);
    setError(null);
    try {
      const compressed = await CameraService.compressImage(blob);
      const link = url.trim();
      const { id } = await ItemService.createItem({
        blob: compressed,
        mime: compressed.type || 'image/jpeg',
        shopUrl: link ? normalizeUrl(link) : '',
      });
      onSaved?.(id);
      onClose?.();
    } catch (e) {
      setError(e.message || 'save_failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="create-sheet-overlay" onClick={onClose}>
        <div className="create-sheet" style={sheetStyle} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="create-sheet-handle" {...handleProps} style={{ cursor: 'grab' }} />
          <button type="button" className="create-sheet-close" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
          <h3 className="create-sheet-title">{t('createAddItem')}</h3>

          {preview ? (
            <div className="add-sheet-photo">
              <img src={preview} alt="" />
              <button
                type="button"
                className="add-sheet-photo-rm"
                onClick={() => { setBlob(null); setPreview(null); }}
                aria-label={t('remove')}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div className="add-sheet-pickers">
              <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
                <ImageIcon size={16} strokeWidth={1.6} /> {t('uploadPhoto')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleTakePhoto}>
                <CameraIcon size={16} strokeWidth={1.6} /> {t('takePhoto')}
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }}
          />

          {/* Several garments in one photo → the bulk path (analyze pipeline
              in owned mode). Only offered before a single photo is staged. */}
          {!preview && (
            <Link to="/analyze?owned=1" className="add-sheet-bulk" onClick={onClose}>
              <Layers size={16} strokeWidth={1.7} />
              <span className="add-sheet-bulk-text">
                <strong>{t('addItemBulkTitle')}</strong>
                <span>{t('addItemBulkHint')}</span>
              </span>
              <ChevronRight size={16} strokeWidth={1.7} />
            </Link>
          )}

          <label className="add-sheet-label">{t('tagShopUrl')}</label>
          <input
            className="add-sheet-input"
            type="url"
            inputMode="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder={t('tagShopUrlPlaceholder')}
            autoCapitalize="none"
            autoCorrect="off"
          />

          {error && <p className="settings-error" style={{ margin: '0.5rem 0' }}>{error}</p>}

          <button
            type="button"
            className="btn btn-primary add-sheet-cta"
            onClick={save}
            disabled={!blob || saving}
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
      {cameraOpen && (
        <CameraCaptureModal
          open
          onClose={() => setCameraOpen(false)}
          onCapture={(b) => { setCameraOpen(false); pick(b); }}
        />
      )}
    </>
  );
}

// Tolerate users pasting "brand.com/x" without the scheme.
function normalizeUrl(u) {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

export default AddItemSheet;

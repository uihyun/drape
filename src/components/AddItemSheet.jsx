import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Camera as CameraIcon, X, Layers, ChevronRight, ChevronLeft } from 'lucide-react';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
import { ItemService } from '../services/item-service.js';
import { CameraService } from '../services/camera.js';
import { CameraCaptureModal } from './CameraCaptureModal.jsx';
import { bulkAddOwned } from '../services/bulk-add.js';
import { isNativeApp } from '../services/platform-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Quick closet-add as a bottom sheet (photo + an optional shop URL to jump
// straight to where it's sold). Mirrors OotdSheet so the create menu feels
// consistent; the heavy flows (try-on, analyze, builders) stay full pages.
// Naming/tagging is still auto-filled server-side after upload.
const BULK_MAX = 8;

export function AddItemSheet({ open, user, onClose, onSaved }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { sheetStyle, handleProps } = useSheetDrag(onClose);
  // 'single' | 'bulk' — bulk swaps this sheet's body rather than navigating.
  // Sending a one-tap action to a full page lost the user's place for what is
  // still just "pick photos, confirm".
  const [mode, setMode] = useState('single');
  const [bulk, setBulk] = useState([]); // { blob, previewUrl }
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [url, setUrl] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setBlob(null); setPreview(null); setUrl(''); setError(null);
    setMode('single'); setBulk([]);
  }, [open]);

  // Object URLs for the bulk strip are created per pick and revoked together
  // when the sheet closes — the strip is small and short-lived.
  useEffect(() => () => bulk.forEach(b => URL.revokeObjectURL(b.previewUrl)), [bulk]);

  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  if (!open) return null;

  const pick = (file) => { if (file) setBlob(file); };

  // Upload = pick an existing photo. Native goes straight to the photo library
  // (no Photo Library / Take Photo / Choose File menu); web opens the file picker.
  const handleUpload = async () => {
    try {
      const b = await CameraService.pickFromLibrary();
      if (b) pick(b);
    } catch (e) {
      setError(e?.message || 'upload_failed');
    }
  };

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

  const addBulkPhotos = (files) => {
    const room = BULK_MAX - bulk.length;
    if (room <= 0) return;
    const accepted = Array.from(files || []).filter(Boolean).slice(0, room);
    if (!accepted.length) return;
    setError(null);
    setBulk(prev => [...prev, ...accepted.map(b => ({ blob: b, previewUrl: URL.createObjectURL(b) }))]);
  };

  const handleBulkUpload = async () => {
    try {
      addBulkPhotos(await CameraService.pickManyFromLibrary(BULK_MAX - bulk.length));
    } catch (e) {
      setError(e?.message || 'upload_failed');
    }
  };

  const handleBulkSnap = async () => {
    if (isNativeApp()) {
      try {
        const b = await CameraService.takePhoto();
        if (b) addBulkPhotos([b]);
      } catch (e) {
        setError(e?.message || 'camera_failed');
      }
      return;
    }
    setCameraOpen(true);
  };

  const removeBulk = (i) => setBulk(prev => {
    const copy = [...prev];
    const [gone] = copy.splice(i, 1);
    if (gone) URL.revokeObjectURL(gone.previewUrl);
    return copy;
  });

  // Detection runs after we leave: the closet fills in with Processing cards,
  // which beats holding the sheet open behind a spinner for N photos.
  const confirmBulk = () => {
    if (!bulk.length) return;
    const photos = bulk.map(b => b.blob);
    const link = url.trim();
    setBulk([]);
    onClose?.();
    navigate('/profile/closet');
    bulkAddOwned(photos, { shopUrl: link ? normalizeUrl(link) : '' });
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
          {mode === 'bulk' ? (
            <button
              type="button"
              className="add-sheet-back"
              onClick={() => setMode('single')}
              aria-label={t('back')}
            >
              <ChevronLeft size={16} strokeWidth={1.9} />
              <span className="create-sheet-title">{t('addItemBulkTitle')}</span>
            </button>
          ) : (
            <h3 className="create-sheet-title">{t('createAddItem')}</h3>
          )}

          {mode === 'bulk' ? (
            <>
              {bulk.length > 0 && (
                <div className="add-sheet-strip" role="list">
                  {bulk.map((b, i) => (
                    <div className="add-sheet-strip-item" role="listitem" key={b.previewUrl}>
                      <img src={b.previewUrl} alt="" />
                      <button
                        type="button"
                        className="add-sheet-photo-rm"
                        onClick={() => removeBulk(i)}
                        aria-label={t('remove')}
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {bulk.length < BULK_MAX && (
                <div className="add-sheet-pickers">
                  <button type="button" className="btn btn-primary" onClick={handleBulkUpload}>
                    <ImageIcon size={16} strokeWidth={1.6} /> {t('uploadPhotos')}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleBulkSnap}>
                    <CameraIcon size={16} strokeWidth={1.6} /> {t('burstCapture')}
                  </button>
                </div>
              )}
              <p className="add-sheet-hint">
                {bulk.length
                  ? t('analyzeMultiHint', { max: BULK_MAX })
                  : t('analyzeUploadHint2', { max: BULK_MAX })}
              </p>
            </>
          ) : (
            <>
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
                  <button type="button" className="btn btn-primary" onClick={handleUpload}>
                    <ImageIcon size={16} strokeWidth={1.6} /> {t('uploadPhoto')}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleTakePhoto}>
                    <CameraIcon size={16} strokeWidth={1.6} /> {t('takePhoto')}
                  </button>
                </div>
              )}

              {/* Several garments in one photo → the bulk view, in this same
                  sheet. Only offered before a single photo is staged. */}
              {!preview && (
                <button type="button" className="add-sheet-bulk" onClick={() => setMode('bulk')}>
                  <Layers size={16} strokeWidth={1.7} />
                  <span className="add-sheet-bulk-text">{t('addItemBulkTitle')}</span>
                  <ChevronRight size={16} strokeWidth={1.7} />
                </button>
              )}
            </>
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

          {mode === 'bulk' ? (
            <button
              type="button"
              className="btn btn-primary add-sheet-cta"
              onClick={confirmBulk}
              disabled={!bulk.length}
            >
              {bulk.length ? t('detailedFilterApply', { n: bulk.length }) : t('bulkAddRun')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary add-sheet-cta"
              onClick={save}
              disabled={!blob || saving}
            >
              {saving ? t('saving') : t('save')}
            </button>
          )}
        </div>
      </div>
      {cameraOpen && (
        <CameraCaptureModal
          open
          onClose={() => setCameraOpen(false)}
          onCapture={(b) => {
            setCameraOpen(false);
            if (mode === 'bulk') addBulkPhotos([b]); else pick(b);
          }}
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

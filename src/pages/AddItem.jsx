import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, UploadCloud, Camera as CameraIcon, Image as ImageIcon, Lock } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { CameraService } from '../services/camera.js';
import { isNativeApp } from '../services/platform-service.js';
import { CameraCaptureModal } from '../components/CameraCaptureModal.jsx';

// Three platforms, three camera paths:
// - Native (Capacitor): @capacitor/camera plugin via CameraService
// - Mobile web: <input capture="environment"> as a real user-gesture
//   click — iOS Safari opens the system camera UI, Android Chrome too
// - Desktop web: getUserMedia in an in-page modal — laptops have
//   webcams; previously we hid the button which read as broken
const isMobileUA = typeof navigator !== 'undefined'
  && /iPhone|iPad|iPod|Android/.test(navigator.userAgent || '');
import { useLocale } from '../hooks/useLocale.jsx';

// Add a clothing item. Two-step flow: pick (gallery or camera) → preview →
// Cancel/Upload. The preview takes over the screen so the photo is the
// thing being decided about, not chrome.
export function AddItem({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const fileInputRef = useRef();
  const cameraInputRef = useRef();
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingBlob, setPendingBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Revoke the object URL when the preview changes / unmounts to avoid
  // leaking blobs in long sessions.
  useEffect(() => {
    if (!pendingBlob) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(pendingBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingBlob]);

  if (!user || user.isAnonymous) {
    return (
      <div className="empty-state">
        <Lock size={32} strokeWidth={1.4} />
        <p>{t('signInRequired')}</p>
        <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
      </div>
    );
  }

  const stagePicked = (file) => {
    if (!file) return;
    setError(null);
    setPendingBlob(file);
  };

  const cancel = () => {
    if (uploading) return;
    setPendingBlob(null);
  };

  const upload = async () => {
    if (!pendingBlob) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await CameraService.compressImage(pendingBlob);
      await ItemService.createItem({ blob, mime: blob.type || 'image/jpeg' });
      navigate('/profile/closet');
    } catch (err) {
      console.warn('add item failed', err.message);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="page add-item">
        <h1 className="page-h1">{t('addItem')}</h1>
        <p className="page-sub">{t('addItemHint')}</p>

        <div className="add-item-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <ImageIcon size={16} strokeWidth={1.6} /> {t('uploadPhoto')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={e => stagePicked(e.target.files?.[0])}
          />

          {isNativeApp() ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  const blob = await CameraService.takePhoto();
                  if (blob) stagePicked(blob);
                } catch (err) {
                  setError(err.message);
                }
              }}
              disabled={uploading}
            >
              <CameraIcon size={16} strokeWidth={1.6} /> {t('takePhoto')}
            </button>
          ) : isMobileUA ? (
            <label className={`btn btn-secondary ${uploading ? 'is-disabled' : ''}`}>
              <CameraIcon size={16} strokeWidth={1.6} /> {t('takePhoto')}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => stagePicked(e.target.files?.[0])}
                disabled={uploading}
              />
            </label>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCameraModalOpen(true)}
              disabled={uploading}
            >
              <CameraIcon size={16} strokeWidth={1.6} /> {t('takePhoto')}
            </button>
          )}
        </div>

        {error && <p style={{ color: 'var(--error)' }}>{error}</p>}

        <div className="add-item-guide">
          <h3>{t('addItemGuideTitle')}</h3>
          <ul>
            <li>{t('addItemGuide1')}</li>
            <li>{t('addItemGuide2')}</li>
            <li>{t('addItemGuide3')}</li>
          </ul>
        </div>
      </div>

      {previewUrl && (
        <div className="upload-preview" role="dialog" aria-modal="true">
          <button
            type="button"
            className="upload-preview-close"
            onClick={cancel}
            disabled={uploading}
            aria-label={t('cancel')}
          >
            <X size={22} strokeWidth={1.8} />
          </button>

          <div className="upload-preview-stage">
            <img src={previewUrl} alt="" />
          </div>

          <div className="upload-preview-actions">
            <button
              type="button"
              className="btn-pill btn-pill--ghost"
              onClick={cancel}
              disabled={uploading}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              className="btn-pill btn-pill--accent"
              onClick={upload}
              disabled={uploading}
            >
              <UploadCloud size={18} strokeWidth={1.8} />
              {uploading ? t('uploading') : t('upload')}
            </button>
          </div>
        </div>
      )}

      <CameraCaptureModal
        open={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={(blob) => {
          setCameraModalOpen(false);
          stagePicked(blob);
        }}
      />
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, UploadCloud, Camera as CameraIcon, Image as ImageIcon, Lock } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { CameraService } from '../services/camera.js';
import { isNativeApp } from '../services/platform-service.js';

// Camera capture only makes sense where there actually is one. Native
// (Capacitor) always; mobile web by UA sniff. On desktop we hide the
// button entirely — the input[capture] attribute is ignored there and
// silently falls through to a regular file picker, which read as "I
// clicked Take Photo but got the gallery again."
function hasUsableCamera() {
  if (isNativeApp()) return true;
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod|Android/.test(ua);
}
import { useLocale } from '../hooks/useLocale.jsx';

// Add a clothing item. Two-step flow: pick (gallery or camera) → preview →
// Cancel/Upload. The preview takes over the screen so the photo is the
// thing being decided about, not chrome.
export function AddItem({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const fileInputRef = useRef();
  const cameraInputRef = useRef();
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

          {/* Hide on desktop (no camera). On native, lean on Capacitor's
              @capacitor/camera; on mobile web, use a direct <input
              capture="environment"> click so the click stays inside the
              user gesture and iOS Safari opens the real camera. */}
          {hasUsableCamera() && (
            isNativeApp() ? (
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
            ) : (
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
            )
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
    </>
  );
}

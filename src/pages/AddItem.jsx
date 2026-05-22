import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ItemService } from '../services/item-service.js';
import { CameraService } from '../services/camera.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Add a clothing item. Either upload from disk or open the camera.
// On success we immediately navigate back to the closet — the placeholder
// skeleton card is already there waiting for processItem to fill it in.
export function AddItem({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const fileInputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  if (!user || user.isAnonymous) {
    return (
      <div className="empty-state">
        <i className="material-icons">lock</i>
        <p>{t('signInRequired')}</p>
        <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
      </div>
    );
  }

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // Compress / orient-fix before upload so the cropped output stays sane.
      const blob = await CameraService.compressImage(file);
      await ItemService.createItem({ blob, mime: blob.type || 'image/jpeg' });
      navigate('/closet');
    } catch (err) {
      console.warn('add item failed', err.message);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="add-item">
      <h2 className="section-title">{t('addItem')}</h2>
      <p style={{ color: 'var(--text-secondary)' }}>{t('addItemHint')}</p>

      <div className="add-item-actions">
        <button
          className="btn btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <i className="material-icons">cloud_upload</i>
          {t('uploadPhoto')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />

        <button
          className="btn btn-secondary"
          onClick={async () => {
            try {
              const blob = await CameraService.takePhoto();
              if (blob) await handleFile(blob);
            } catch (err) {
              setError(err.message);
            }
          }}
          disabled={uploading}
        >
          <i className="material-icons">camera_alt</i>
          {t('takePhoto')}
        </button>
      </div>

      {uploading && <p className="muted">{t('uploading')}</p>}
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
  );
}

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Camera as CameraIcon, ExternalLink, Plus, Sparkles, RefreshCw } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { CameraCaptureModal } from '../components/CameraCaptureModal.jsx';
import { isNativeApp } from '../services/platform-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// "What's in this photo?" — upload an OOTD / someone else's outfit /
// magazine shot, get Gemini's reading of the look + each visible piece,
// then optionally save any of them into your closet and follow a
// search link to find similar online.
const isMobileUA = typeof navigator !== 'undefined'
  && /iPhone|iPad|iPod|Android/.test(navigator.userAgent || '');

export function AnalyzePhoto({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const fileRef = useRef();
  const [previewUrl, setPreviewUrl] = useState(null);
  const [pendingBlob, setPendingBlob] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null); // { style, notes, items }
  const [savedIds, setSavedIds] = useState(new Set());
  const [savingIdx, setSavingIdx] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pendingBlob) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(pendingBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingBlob]);

  if (!user || user.isAnonymous) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('analyzeTitle')}</h1>
        <div className="empty-state empty-state-card">
          <p>{t('analyzeSignInBody')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
        </div>
      </div>
    );
  }

  const pick = (file) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setSavedIds(new Set());
    setPendingBlob(file);
  };

  const analyze = async () => {
    if (!pendingBlob || analyzing) return;
    setAnalyzing(true); setError(null);
    try {
      const data = await ItemService.analyzePhoto({
        blob: pendingBlob,
        mime: pendingBlob.type || 'image/jpeg',
      });
      setResult(data);
    } catch (e) {
      setError(e.message || 'analyze_failed');
    } finally { setAnalyzing(false); }
  };

  const saveItem = async (idx) => {
    if (!result?.items?.[idx] || savingIdx !== null) return;
    setSavingIdx(idx);
    try {
      await ItemService.createFromDetected({
        blob: pendingBlob,
        detected: result.items[idx],
        sourceLabel: result.style || '',
      });
      setSavedIds(prev => new Set(prev).add(idx));
    } catch (e) {
      setError(e.message || 'save_failed');
    } finally { setSavingIdx(null); }
  };

  const reset = () => {
    setResult(null);
    setPendingBlob(null);
    setSavedIds(new Set());
    setError(null);
  };

  const searchUrl = (q) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;

  return (
    <div className="page analyze-photo">
      <h1 className="page-h1">{t('analyzeTitle')}</h1>
      <p className="page-sub">{t('analyzeBody')}</p>

      {!previewUrl && (
        <div className="add-item-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon size={16} strokeWidth={1.6} /> {t('uploadPhoto')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => pick(e.target.files?.[0])}
          />
          {isMobileUA && !isNativeApp() ? (
            <label className="btn btn-secondary">
              <CameraIcon size={16} strokeWidth={1.6} /> {t('takePhoto')}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => pick(e.target.files?.[0])}
              />
            </label>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCameraOpen(true)}
            >
              <CameraIcon size={16} strokeWidth={1.6} /> {t('takePhoto')}
            </button>
          )}
        </div>
      )}

      {previewUrl && (
        <div className="analyze-preview">
          <img src={previewUrl} alt="" />
        </div>
      )}

      {previewUrl && !result && (
        <div className="analyze-actions">
          <button className="btn btn-secondary" onClick={reset} disabled={analyzing}>
            {t('cancel')}
          </button>
          <button className="btn btn-primary" onClick={analyze} disabled={analyzing}>
            {analyzing
              ? <><RefreshCw size={16} strokeWidth={1.7} className="spin" /> {t('analyzing')}</>
              : <><Sparkles size={16} strokeWidth={1.7} /> {t('analyzeRun')}</>}
          </button>
        </div>
      )}

      {error && <p className="settings-error" style={{ margin: '0.75rem 0' }}>{error}</p>}

      {result && (
        <section className="analyze-result">
          {result.style && (
            <div className="analyze-style">
              <span className="analyze-style-label">{t('styleLabel')}</span>
              <h2>{result.style}</h2>
              {result.notes && <p className="muted">{result.notes}</p>}
            </div>
          )}

          {result.items.length === 0 ? (
            <div className="empty-state empty-state-card">
              <p>{t('analyzeNoItems')}</p>
            </div>
          ) : (
            <div className="analyze-items">
              {result.items.map((it, idx) => {
                const saved = savedIds.has(idx);
                return (
                  <div key={idx} className="analyze-item">
                    <div className="analyze-item-text">
                      {it.category && (
                        <span className="analyze-item-cat">
                          {t(`taxonomy.categories.${it.category}`)}
                        </span>
                      )}
                      <p className="analyze-item-desc">{it.description}</p>
                      <p className="analyze-item-meta">
                        {(it.colors || []).map(c => t(`taxonomy.colors.${c}`)).join(' · ')}
                        {it.brand && <> · {it.brand}</>}
                      </p>
                    </div>
                    <div className="analyze-item-actions">
                      <a
                        href={searchUrl(it.searchQuery || it.description)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        <ExternalLink size={13} strokeWidth={1.8} /> {t('findSimilar')}
                      </a>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => saveItem(idx)}
                        disabled={saved || savingIdx === idx}
                      >
                        {saved
                          ? t('savedToCloset')
                          : <><Plus size={13} strokeWidth={1.9} /> {t('saveToCloset')}</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="analyze-footer">
            <button className="btn btn-secondary" onClick={reset}>{t('analyzeAnother')}</button>
            <button className="btn btn-primary" onClick={() => navigate('/profile/closet')}>
              {t('goToCloset')}
            </button>
          </div>
        </section>
      )}

      <CameraCaptureModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(blob) => { setCameraOpen(false); pick(blob); }}
      />
    </div>
  );
}

export default AnalyzePhoto;

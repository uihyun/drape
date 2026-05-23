import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Camera as CameraIcon, ExternalLink, Plus, Sparkles, RefreshCw, X } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { CameraCaptureModal } from '../components/CameraCaptureModal.jsx';
import { isNativeApp } from '../services/platform-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// "What's in this photo?" — pick one or more photos (OOTD selfies,
// magazine shots, etc.). Each runs through the detectItems Cloud
// Function in sequence (parallel would risk Gemini rate-limit on a
// shared key). Detected pieces from all photos collect into a single
// candidate list with the source photo shown next to each row, so the
// user picks-and-saves in one pass instead of repeating the flow per
// photo. This is the Magic Upload variant of the analyze flow.
const isMobileUA = typeof navigator !== 'undefined'
  && /iPhone|iPad|iPod|Android/.test(navigator.userAgent || '');

export function AnalyzePhoto({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const fileRef = useRef();
  // batches: [{ blob, previewUrl, status: 'pending'|'analyzing'|'done'|'failed', style, notes, items: [...] }]
  const [batches, setBatches] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  // savedKey is `"${batchIdx}:${itemIdx}"` for items that have been added
  const [savedKeys, setSavedKeys] = useState(new Set());
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState(null);

  // Object URLs on each batch — revoke when batches list changes / unmounts.
  useEffect(() => {
    return () => batches.forEach(b => b.previewUrl && URL.revokeObjectURL(b.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const addFiles = (filesLike) => {
    const files = Array.from(filesLike || []).filter(Boolean).slice(0, 8); // cap per batch
    if (files.length === 0) return;
    setError(null);
    const newBatches = files.map(blob => ({
      blob,
      previewUrl: URL.createObjectURL(blob),
      status: 'pending',
      style: '',
      notes: '',
      items: [],
    }));
    setBatches(prev => [...prev, ...newBatches]);
  };

  const removeBatch = (idx) => {
    setBatches(prev => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
    // Drop saved markers tied to this batch index — and shift later ones down.
    setSavedKeys(prev => {
      const next = new Set();
      for (const key of prev) {
        const [b, i] = key.split(':').map(Number);
        if (b === idx) continue;
        next.add(b > idx ? `${b - 1}:${i}` : key);
      }
      return next;
    });
  };

  const runAnalyzeAll = async () => {
    const queue = batches
      .map((b, idx) => ({ b, idx }))
      .filter(({ b }) => b.status === 'pending' || b.status === 'failed');
    if (queue.length === 0) return;
    setError(null);
    for (const { idx } of queue) {
      setBatches(prev => prev.map((x, i) => i === idx ? { ...x, status: 'analyzing' } : x));
      try {
        const blob = batches[idx].blob;
        const data = await ItemService.analyzePhoto({
          blob,
          mime: blob.type || 'image/jpeg',
        });
        setBatches(prev => prev.map((x, i) => i === idx
          ? { ...x, status: 'done', style: data.style || '', notes: data.notes || '', items: data.items || [] }
          : x));
      } catch (e) {
        setBatches(prev => prev.map((x, i) => i === idx ? { ...x, status: 'failed' } : x));
        setError(e.message || 'analyze_failed');
      }
    }
  };

  const saveItem = async (batchIdx, itemIdx) => {
    const key = `${batchIdx}:${itemIdx}`;
    if (savingKey !== null) return;
    const batch = batches[batchIdx];
    const detected = batch?.items?.[itemIdx];
    if (!batch || !detected) return;
    setSavingKey(key);
    try {
      await ItemService.createFromDetected({
        blob: batch.blob,
        detected,
        sourceLabel: batch.style || '',
      });
      setSavedKeys(prev => new Set(prev).add(key));
    } catch (e) {
      setError(e.message || 'save_failed');
    } finally { setSavingKey(null); }
  };

  const reset = () => {
    batches.forEach(b => b.previewUrl && URL.revokeObjectURL(b.previewUrl));
    setBatches([]);
    setSavedKeys(new Set());
    setError(null);
  };

  const pendingCount = batches.filter(b => b.status === 'pending').length;
  const anyDone = batches.some(b => b.status === 'done');
  const searchUrl = (q) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;

  return (
    <div className="page analyze-photo">
      <h1 className="page-h1">{t('analyzeTitle')}</h1>
      <p className="page-sub">{t('analyzeBody')}</p>

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
          multiple
          className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
        />
        {isMobileUA && !isNativeApp() ? (
          <label className="btn btn-secondary">
            <CameraIcon size={16} strokeWidth={1.6} /> {t('takePhoto')}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
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

      {batches.length > 0 && (
        <div className="analyze-batch-row">
          {batches.map((b, idx) => (
            <div key={idx} className={`analyze-batch-tile status-${b.status}`}>
              <img src={b.previewUrl} alt="" />
              <button
                type="button"
                className="analyze-batch-rm"
                onClick={() => removeBatch(idx)}
                aria-label={t('remove')}
              >
                <X size={12} strokeWidth={2} />
              </button>
              {b.status === 'analyzing' && <span className="analyze-batch-spin"><RefreshCw size={14} strokeWidth={1.8} className="spin" /></span>}
              {b.status === 'failed' && <span className="analyze-batch-bad">!</span>}
            </div>
          ))}
        </div>
      )}

      {batches.length > 0 && (
        <div className="analyze-actions">
          <button className="btn btn-secondary" onClick={reset}>
            {t('clear')}
          </button>
          <button
            className="btn btn-primary"
            onClick={runAnalyzeAll}
            disabled={pendingCount === 0 && !batches.some(b => b.status === 'failed')}
          >
            <Sparkles size={16} strokeWidth={1.7} />
            {pendingCount > 0
              ? `${t('analyzeRun')}${batches.length > 1 ? ` · ${pendingCount}` : ''}`
              : t('analyzeRun')}
          </button>
        </div>
      )}

      {error && <p className="settings-error" style={{ margin: '0.75rem 0' }}>{error}</p>}

      {anyDone && (
        <section className="analyze-result">
          {batches.map((b, batchIdx) => {
            if (b.status !== 'done') return null;
            return (
              <div key={batchIdx} className="analyze-batch-block">
                {b.style && (
                  <div className="analyze-style analyze-style-sm">
                    <img src={b.previewUrl} alt="" className="analyze-style-thumb" />
                    <div>
                      <span className="analyze-style-label">{t('styleLabel')}</span>
                      <h3>{b.style}</h3>
                      {b.notes && <p className="muted">{b.notes}</p>}
                    </div>
                  </div>
                )}

                {b.items.length === 0 ? (
                  <p className="muted" style={{ padding: '0.5rem 0 1rem' }}>{t('analyzeNoItems')}</p>
                ) : (
                  <div className="analyze-items">
                    {b.items.map((it, itemIdx) => {
                      const key = `${batchIdx}:${itemIdx}`;
                      const saved = savedKeys.has(key);
                      return (
                        <div key={itemIdx} className="analyze-item">
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
                              onClick={() => saveItem(batchIdx, itemIdx)}
                              disabled={saved || savingKey === key}
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
              </div>
            );
          })}

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
        onCapture={(blob) => { setCameraOpen(false); addFiles([blob]); }}
      />
    </div>
  );
}

export default AnalyzePhoto;

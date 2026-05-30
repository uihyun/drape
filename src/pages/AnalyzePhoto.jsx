import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Camera as CameraIcon, ExternalLink, Plus, Sparkles, RefreshCw, X, Bookmark, Check } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { OutfitService } from '../services/outfit-service.js';
import { CameraCaptureModal } from '../components/CameraCaptureModal.jsx';
import { isNativeApp } from '../services/platform-service.js';
import { matchCloset } from '../utils/itemMatch.js';
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

// Analyze results live only in memory until explicitly saved. Keep them in
// a module-level cache so navigating away (tapping a closet match, opening
// "find similar", hitting the tab bar) and pressing back returns to the
// RESULT page instead of a blank input screen. Cleared only by reset().
const analyzeCache = { batches: [], savedKeys: new Set(), savedBatchIds: new Map() };

// Tolerate "brand.com/x" pasted without a scheme.
function normalizePieceUrl(u) {
  const s = (u || '').trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function AnalyzePhoto({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const fileRef = useRef();
  // batches: [{ blob, previewUrl, status: 'pending'|'analyzing'|'done'|'failed', style, notes, items: [...] }]
  const [batches, setBatches] = useState(analyzeCache.batches);
  const [cameraOpen, setCameraOpen] = useState(false);
  // savedKey is `"${batchIdx}:${itemIdx}"` for items that have been added
  const [savedKeys, setSavedKeys] = useState(analyzeCache.savedKeys);
  // Per-batch "Save analysis" state — kind='analyzed' outfit doc id once saved.
  const [savedBatchIds, setSavedBatchIds] = useState(analyzeCache.savedBatchIds);
  const [savingBatchIdx, setSavingBatchIdx] = useState(-1);
  const [savingKey, setSavingKey] = useState(null);
  const [pieceUrls, setPieceUrls] = useState({}); // `${batchIdx}:${itemIdx}` -> shop url
  const [error, setError] = useState(null);
  // Closet items power the "from your closet" match strip under each
  // detected piece (tag-based, no model call). Ready + non-archived only.
  const [closet, setCloset] = useState([]);
  useEffect(() => {
    if (!user || user.isAnonymous) { setCloset([]); return; }
    return ItemService.subscribeMyCloset(user.uid, list =>
      setCloset(list.filter(i => i.status === 'ready' && !i.isArchived)));
  }, [user]);

  // Mirror result state into the module cache so a remount (back nav)
  // restores exactly what was on screen. Object URLs are deliberately NOT
  // revoked on unmount — they must stay valid for the cached previews;
  // reset() / removeBatch() revoke explicitly instead.
  useEffect(() => { analyzeCache.batches = batches; }, [batches]);
  useEffect(() => { analyzeCache.savedKeys = savedKeys; }, [savedKeys]);
  useEffect(() => { analyzeCache.savedBatchIds = savedBatchIds; }, [savedBatchIds]);

  if (!user || user.isAnonymous) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('analyzeTitle')}</h1>
        <div className="empty-state empty-state-card">
          <p>{t('analyzeSignInBody')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
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
      style: [],
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
        shopUrl: pieceUrls[key] ? normalizePieceUrl(pieceUrls[key]) : '',
      });
      setSavedKeys(prev => new Set(prev).add(key));
    } catch (e) {
      setError(e.message || 'save_failed');
    } finally { setSavingKey(null); }
  };

  const saveAnalysis = async (batchIdx) => {
    if (savingBatchIdx !== -1 || savedBatchIds.has(batchIdx)) return;
    const batch = batches[batchIdx];
    if (!batch || batch.status !== 'done') return;
    setSavingBatchIdx(batchIdx);
    try {
      const { id } = await OutfitService.createAnalyzedOutfit({
        photoBlob: batch.blob,
        style: batch.style || [],
        notes: batch.notes || '',
        detectedItems: batch.items || [],
        itemIds: [],
      });
      setSavedBatchIds(prev => new Map(prev).set(batchIdx, id));
    } catch (e) {
      setError(e.message || 'save_failed');
    } finally { setSavingBatchIdx(-1); }
  };

  const reset = () => {
    batches.forEach(b => b.previewUrl && URL.revokeObjectURL(b.previewUrl));
    analyzeCache.batches = [];
    analyzeCache.savedKeys = new Set();
    analyzeCache.savedBatchIds = new Map();
    setBatches([]);
    setSavedKeys(new Set());
    setSavedBatchIds(new Map());
    setError(null);
  };

  const pendingCount = batches.filter(b => b.status === 'pending').length;
  const anyDone = batches.some(b => b.status === 'done');
  const searchUrl = (q) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;

  return (
    <div className="page analyze-photo">
      {!anyDone ? (
        // ── INPUT MODE: pick photos + run analyze ────────────────────
        <>
          <h1 className="page-h1">{t('analyzeTitle')}</h1>
          <p className="page-sub">{t('analyzeBody')}</p>

          {/* Large preview hero — when one or more photos staged, show them
              big enough to actually see what's being analyzed. */}
          {batches.length > 0 && (
            <div className="analyze-staged">
              {batches.map((b, idx) => (
                <div key={idx} className={`analyze-staged-card status-${b.status}`}>
                  <img src={b.previewUrl} alt="" />
                  <button
                    type="button"
                    className="analyze-staged-rm"
                    onClick={() => removeBatch(idx)}
                    aria-label={t('remove')}
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                  {b.status === 'analyzing' && (
                    <span className="analyze-staged-overlay">
                      <RefreshCw size={20} strokeWidth={1.8} className="spin" />
                    </span>
                  )}
                  {b.status === 'failed' && <span className="analyze-staged-bad">!</span>}
                </div>
              ))}
            </div>
          )}

          <div className="analyze-input-actions">
            <button
              type="button"
              className="btn btn-primary analyze-input-btn"
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
              <label className="btn btn-secondary analyze-input-btn">
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
                className="btn btn-secondary analyze-input-btn"
                onClick={() => setCameraOpen(true)}
              >
                <CameraIcon size={16} strokeWidth={1.6} /> {t('takePhoto')}
              </button>
            )}
          </div>

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
        </>
      ) : (
        // ── RESULT MODE: hero photo + scrollable details ────────────
        <section className="analyze-result-v2">
          {error && <p className="settings-error" style={{ margin: '0.5rem 1rem' }}>{error}</p>}
          {batches.map((b, batchIdx) => {
            if (b.status !== 'done') return null;
            const analysisSaved = savedBatchIds.has(batchIdx);
            return (
              <article key={batchIdx} className="analyze-result-batch">
                {/* Hero — big edge-to-edge photo so the user can actually
                    see what was analyzed. */}
                <div className="analyze-hero">
                  <img src={b.previewUrl} alt="" />
                </div>

                {/* Style summary card sits right under the hero so the
                    style + notes read like an editorial caption. */}
                {((Array.isArray(b.style) && b.style.length > 0) || b.notes) && (
                  <div className="analyze-style-card">
                    <span className="analyze-style-eyebrow">{t('styleLabel')}</span>
                    {b.notes && <p className="analyze-style-notes">{b.notes}</p>}
                    {Array.isArray(b.style) && b.style.length > 0 && (
                      <ul className="analyze-style-list">
                        {b.style.map((c, i) => {
                          const pct = Math.max(0, Math.min(100, ((c.level || 0) / 5) * 100));
                          return (
                            <li key={i} className="style-bars-row">
                              <span className="style-bars-label">{t(`taxonomy.styles.${c.label}`) || c.label}</span>
                              <div className="style-bars-bar" role="meter" aria-valuemin="0" aria-valuemax="5" aria-valuenow={c.level || 0} aria-label={c.label}>
                                <div className="style-bars-bar-fill" style={{ width: `${pct}%` }} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <button
                      type="button"
                      className={`btn ${analysisSaved ? 'btn-secondary' : 'btn-primary'} analyze-style-save`}
                      onClick={() => saveAnalysis(batchIdx)}
                      disabled={analysisSaved || savingBatchIdx === batchIdx}
                    >
                      {analysisSaved
                        ? <><Check size={14} strokeWidth={2} /> {t('analysisSaved')}</>
                        : <><Bookmark size={14} strokeWidth={1.8} /> {t('saveAnalysis')}</>}
                    </button>
                  </div>
                )}


                {b.items.length === 0 ? (
                  <p className="muted" style={{ padding: '0.75rem 1rem 1rem' }}>{t('analyzeNoItems')}</p>
                ) : (
                  <div className="analyze-items-v2">
                    <h3 className="analyze-items-head">{t('itemsInPhoto')}</h3>
                    {b.items.map((it, itemIdx) => {
                      const key = `${batchIdx}:${itemIdx}`;
                      const saved = savedKeys.has(key);
                      return (
                        <div key={itemIdx} className="analyze-item-v2">
                          <div className="analyze-item-v2-head">
                            {it.category && (
                              <span className="analyze-item-cat">
                                {t(`taxonomy.categories.${it.category}`)}
                              </span>
                            )}
                            <h4 className="analyze-item-v2-name">
                              {it.name || it.description || t('untitledItem')}
                            </h4>
                          </div>
                          {(it.name && it.description) && (
                            <p className="analyze-item-v2-desc">{it.description}</p>
                          )}
                          <p className="analyze-item-v2-meta">
                            {(it.colors || []).map(c => t(`taxonomy.colors.${c}`)).join(' · ')}
                            {it.brand && <> · <strong>{it.brand}</strong></>}
                          </p>
                          <input
                            type="url"
                            inputMode="url"
                            className="analyze-item-url"
                            value={pieceUrls[key] || ''}
                            onChange={e => setPieceUrls(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder={t('tagShopUrlPlaceholder')}
                            autoCapitalize="none"
                            autoCorrect="off"
                          />
                          <div className="analyze-item-v2-actions">
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
                                ? <><Check size={13} strokeWidth={2} /> {t('savedToCloset')}</>
                                : <><Plus size={13} strokeWidth={1.9} /> {t('saveToCloset')}</>}
                            </button>
                          </div>
                          <ClosetMatchStrip piece={it} closet={closet} t={t} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
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

// "From your closet" — tag-matched items the user already owns for this
// detected piece. Pure tag scoring (utils/itemMatch). Tapping a card opens
// the item; the strip only renders when there's at least one decent match.
function ClosetMatchStrip({ piece, closet, t }) {
  const matches = matchCloset(piece, closet);
  if (matches.length === 0) return null;
  return (
    <div className="analyze-match-strip">
      <span className="analyze-match-label">{t('fromYourCloset')}</span>
      <div className="analyze-match-row">
        {matches.map(({ item }) => {
          const cover = item.croppedUrl || item.originalUrl;
          return (
            <Link key={item.id} to={`/i/${item.id}`} className="analyze-match-card" title={item.name || ''}>
              {cover
                ? <img src={cover} alt={item.name || ''} loading="lazy" />
                : <div className="item-card-skeleton" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default AnalyzePhoto;

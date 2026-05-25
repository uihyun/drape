import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Sparkles, Upload, X } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { IdentityService } from '../services/identity-service.js';
import { OutfitService } from '../services/outfit-service.js';
import { GenerationService } from '../services/generation-service.js';
import { CameraService } from '../services/camera.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Try-on entry. Two axes to pick:
//   - WHO: identityRefs (default) OR a one-shot custom photo
//   - WHAT: individual items OR a saved outfit (set)
// When you submit, navigates to /tryon/:generationId for the variant gallery.
export function TryOn({ user, onSignIn, onOpenCredits }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [refs, setRefs] = useState(null);
  const [items, setItems] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [selected, setSelected] = useState(() => {
    const ids = search.get('items');
    return new Set(ids ? ids.split(',') : []);
  });
  const [pickedOutfitId, setPickedOutfitId] = useState(null);
  const [tier, setTier] = useState('pro');
  const [whatTab, setWhatTab] = useState('items'); // 'items' | 'outfits'
  const [customBlob, setCustomBlob] = useState(null);
  const [customPreview, setCustomPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    IdentityService.getMyRefs().then(setRefs);
    const unsub = ItemService.subscribeMyCloset(user.uid, list => {
      setItems(list.filter(i => i.status === 'ready'));
    });
    OutfitService.listMyOutfits({ uid: user.uid, kind: 'mine' })
      .then(({ outfits }) => setOutfits(outfits))
      .catch(() => setOutfits([]));
    return unsub;
  }, [user]);

  // Object URL cleanup for the custom-photo preview.
  useEffect(() => {
    if (!customBlob) { setCustomPreview(null); return; }
    const url = URL.createObjectURL(customBlob);
    setCustomPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [customBlob]);

  const itemsById = useMemo(
    () => Object.fromEntries(items.map(i => [i.id, i])),
    [items],
  );

  if (!user || user.isAnonymous) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('navTryOn')}</h1>
        <div className="empty-state empty-state-card">
          <h2>{t('tryOnSignInTitle')}</h2>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
        </div>
      </div>
    );
  }

  // Refs only required when no custom photo is provided.
  const needRefs = refs !== null && refs.length === 0 && !customBlob;

  if (needRefs) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('navTryOn')}</h1>
        <div className="empty-state empty-state-card">
          <h2>{t('addIdentityRefsTitle')}</h2>
          <p>{t('addIdentityRefsBody')}</p>
          <div className="empty-state-actions">
            <Link to="/settings" className="btn btn-primary">{t('goToSettings')}</Link>
            <label className="btn btn-secondary">
              <Upload size={14} strokeWidth={1.8} /> {t('useCustomPhoto')}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const blob = await CameraService.compressImage(f);
                  setCustomBlob(blob);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  const toggleItem = (id) => {
    setPickedOutfitId(null);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pickOutfit = (o) => {
    setPickedOutfitId(o.id);
    setSelected(new Set((o.itemIds || []).filter(id => itemsById[id]?.status === 'ready')));
  };

  const onCustomFile = async (file) => {
    if (!file) return;
    const blob = await CameraService.compressImage(file);
    setCustomBlob(blob);
  };

  const submit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    // Kick off in the background so the user can browse other tabs while
    // the model runs. The cloud function writes a 'pending' generation
    // doc early, then TryOnHistory's live subscription shows it as a
    // pending card and flips to ready when done. We only await long
    // enough to surface pre-flight errors (credits, missing identity
    // refs, etc.) — otherwise we navigate to the tryon tab immediately.
    try {
      const promise = GenerationService.startTryOn({
        itemIds: Array.from(selected),
        modelTier: tier,
        customPhotoBlob: customBlob,
      });
      // Race the request against a short timeout — long enough to catch
      // synchronous validation errors, short enough that we don't make
      // the user wait for the actual Gemini call.
      const result = await Promise.race([
        promise.then(r => ({ kind: 'ok', r })),
        new Promise(resolve => setTimeout(() => resolve({ kind: 'timeout' }), 1500)),
      ]);
      if (result.kind === 'ok') {
        // Fast path: tiny refs / Flash tier — finished within 1.5s
        navigate(`/tryon/${result.r.generationId}`);
      } else {
        // Slow path: still running. Let it continue in the background;
        // log any eventual failure but don't block the user.
        promise.catch(err => console.warn('background tryon failed:', err?.message));
        navigate('/profile/tryon');
      }
    } catch (err) {
      setError(err.message);
      if (/credit|quota/i.test(err.message || '')) onOpenCredits?.();
    } finally { setSubmitting(false); }
  };

  return (
    <div className="page tryon-entry">
      <h1 className="page-h1">{t('tryOnPick')}</h1>

      {/* ── Reference: identity refs OR custom one-shot photo ─────── */}
      <section className="tryon-source">
        <h3 className="tryon-section-head">{t('tryOnSource')}</h3>
        <p className="tryon-source-hint">
          {customBlob ? t('tryOnHintCustom') : t('tryOnHintRefs')}
        </p>
        {customBlob ? (
          <div className="tryon-custom-card">
            <img src={customPreview} alt="" />
            <button
              type="button"
              className="tryon-custom-remove"
              onClick={() => setCustomBlob(null)}
              aria-label={t('remove')}
            >
              <X size={14} strokeWidth={2} />
            </button>
            <div className="tryon-custom-meta">
              <strong>{t('customPhotoActive')}</strong>
              <span className="muted">{t('customPhotoHint')}</span>
            </div>
          </div>
        ) : (
          <div className="tryon-source-row">
            {/* Whole refs cluster is a link to /settings so the user can
                change their identity photos in one tap. Hint label sits
                next to it. Uniform thumb size regardless of source ratio
                — padding inside the chip + object-fit:contain. */}
            <Link to="/settings" className="tryon-source-refs" aria-label={t('editRefs')}>
              {(refs || []).slice(0, 3).map((r, i) => (
                <span key={i} className="tryon-source-thumb">
                  <img src={r.url} alt="" referrerPolicy="no-referrer" />
                </span>
              ))}
              <span className="tryon-source-label">
                {refs?.length || 0} {t('savedRefs')}
              </span>
            </Link>
            <label className="btn btn-secondary btn-sm">
              <Upload size={13} strokeWidth={1.8} /> {t('useCustomPhoto')}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { onCustomFile(e.target.files?.[0]); e.target.value = ''; }}
              />
            </label>
          </div>
        )}
      </section>

      {/* ── Tier toggle ───────────────────────────────────────────── */}
      <div className="tier-toggle">
        <button type="button" className={`chip ${tier === 'pro' ? 'active' : ''}`} onClick={() => setTier('pro')}>
          {t('tierPro')} <span className="muted">· {t('tierProHint')}</span>
        </button>
        <button type="button" className={`chip ${tier === 'flash' ? 'active' : ''}`} onClick={() => setTier('flash')}>
          {t('tierFlash')} <span className="muted">· {t('tierFlashHint')}</span>
        </button>
      </div>

      {/* ── What to wear: items OR outfit ─────────────────────────── */}
      <nav className="filter-chips filter-chips--text" role="tablist" style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          role="tab"
          aria-selected={whatTab === 'items'}
          className={`chip${whatTab === 'items' ? ' active' : ''}`}
          onClick={() => setWhatTab('items')}
        >
          {t('tryOnItems')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={whatTab === 'outfits'}
          className={`chip${whatTab === 'outfits' ? ' active' : ''}`}
          onClick={() => setWhatTab('outfits')}
        >
          {t('tryOnOutfits')}
        </button>
      </nav>

      {whatTab === 'items' && (
        items.length === 0 ? (
          <div className="empty-state empty-state-card" style={{ marginTop: '1rem' }}>
            <p>{t('tryOnEmptyCloset')}</p>
            <Link to="/closet/add" className="btn btn-primary">{t('addItem')}</Link>
          </div>
        ) : (
          <div className="closet-grid">
            {items.map(it => {
              const isSel = selected.has(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`item-card builder-pickable ${isSel ? 'selected' : ''}`}
                  onClick={() => toggleItem(it.id)}
                >
                  <div className="item-card-image">
                    {it.croppedUrl || it.originalUrl
                      ? <img src={it.croppedUrl || it.originalUrl} alt="" loading="lazy" />
                      : <div className="item-card-skeleton" />}
                    {isSel && (
                      <span className="item-card-check">
                        <Check size={14} strokeWidth={2.4} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}

      {whatTab === 'outfits' && (
        outfits.length === 0 ? (
          <div className="empty-state empty-state-card" style={{ marginTop: '1rem' }}>
            <p>{t('tryOnEmptyOutfits')}</p>
            <Link to="/outfits/new" className="btn btn-primary">{t('createOutfit')}</Link>
          </div>
        ) : (
          <div className="tryon-outfit-grid">
            {outfits.map(o => {
              const isSel = pickedOutfitId === o.id;
              const thumbs = (o.itemIds || [])
                .slice(0, 4)
                .map(id => itemsById[id])
                .filter(Boolean)
                .map(it => it.croppedUrl || it.originalUrl)
                .filter(Boolean);
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`tryon-outfit-card${isSel ? ' selected' : ''}`}
                  onClick={() => pickOutfit(o)}
                >
                  <div className="tryon-outfit-thumbs">
                    {thumbs.length === 0
                      ? <div className="muted" style={{ padding: '1rem' }}>{t('untitledOutfit')}</div>
                      : thumbs.map((url, i) => (
                          <img key={i} src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />
                        ))}
                    {isSel && (
                      <span className="item-card-check">
                        <Check size={14} strokeWidth={2.4} />
                      </span>
                    )}
                  </div>
                  <div className="tryon-outfit-meta">
                    <span className="card-meta-name">{o.name || t('untitledOutfit')}</span>
                    <span className="card-meta-date">{(o.itemIds || []).length} {t('itemsShort')}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}

      {error && <p style={{ color: 'var(--error)' }}>{error}</p>}

      <div className="builder-cta">
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={submitting || selected.size === 0}
        >
          <Sparkles size={16} strokeWidth={1.8} />
          {submitting ? t('generating') : `${t('startTryOn')}${selected.size > 0 ? ` · ${selected.size}` : ''}`}
        </button>
      </div>
    </div>
  );
}

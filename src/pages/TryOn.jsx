import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Sparkles, Upload, X, SlidersHorizontal } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { IdentityService } from '../services/identity-service.js';
import { GenerationService } from '../services/generation-service.js';
import { OutfitService } from '../services/outfit-service.js';
import { CameraService } from '../services/camera.js';
import { outfitCardPhoto } from '../utils/outfitPhoto.js';
import { AlertModal } from '../components/AlertModal.jsx';
import {
  LookFilterSheet, emptyLookFilters, countLookFilters, itemMatchesFilters,
} from '../components/LookFilterSheet.jsx';
import { useLocale } from '../hooks/useLocale.jsx';
import { useFits } from '../hooks/useFits.js';

// Server rejects > 6 garments; cap on the client so the user gets a clear
// message instead of a failed request after pressing Start.
const MAX_TRYON_ITEMS = 6;

// Try-on entry. Pick WHO (saved identity refs, or a one-shot custom photo)
// and WHAT (one or more closet items). On submit, navigates to
// /tryon/:generationId for the variant gallery.
export function TryOn({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const fits = useFits(user);
  const [outOfFits, setOutOfFits] = useState(false);
  const [search] = useSearchParams();
  const [refs, setRefs] = useState(null);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(() => {
    const ids = search.get('items');
    return new Set(ids ? ids.split(',') : []);
  });
  // Outfit-reference mode: re-create a whole look from someone's outfit photo.
  // `?outfitRef=<id>` — we load that outfit to show its photo as the garment;
  // the closet item grid is hidden and submit sends outfitRefId instead.
  const outfitRefId = search.get('outfitRef');
  const [outfitRef, setOutfitRef] = useState(null);
  // Optional scene description sent to the model — empty = default
  // catalog backdrop. Only meaningful in identity-refs mode (custom-
  // photo mode preserves the photo's background regardless).
  const [backgroundDesc, setBackgroundDesc] = useState('');
  const [customBlob, setCustomBlob] = useState(null);
  const [customPreview, setCustomPreview] = useState(null);
  const [removeCustomBg, setRemoveCustomBg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(emptyLookFilters());
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterCount = countLookFilters(filters);

  const toggleFilter = (dim, value) => {
    setFilters(prev => {
      const cur = prev[dim] || [];
      const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value];
      return { ...prev, [dim]: next };
    });
  };

  const visibleItems = useMemo(
    () => (filterCount === 0 ? items : items.filter(it => itemMatchesFilters(it, filters))),
    [items, filters, filterCount],
  );

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    IdentityService.getMyRefs().then(setRefs);
    const unsub = ItemService.subscribeMyCloset(user.uid, list => {
      setItems(list.filter(i => i.status === 'ready'));
    });
    return unsub;
  }, [user]);

  // Load the referenced outfit (its photo becomes the garment input).
  useEffect(() => {
    if (!outfitRefId) { setOutfitRef(null); return; }
    let cancelled = false;
    OutfitService.getOutfit(outfitRefId)
      .then(o => { if (!cancelled) setOutfitRef(o); })
      .catch(() => { if (!cancelled) setOutfitRef(null); });
    return () => { cancelled = true; };
  }, [outfitRefId]);

  // Object URL cleanup for the custom-photo preview.
  useEffect(() => {
    if (!customBlob) { setCustomPreview(null); return; }
    const url = URL.createObjectURL(customBlob);
    setCustomPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [customBlob]);

  if (!user || user.isAnonymous) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('navTryOn')}</h1>
        <div className="empty-state empty-state-card">
          <h2>{t('tryOnSignInTitle')}</h2>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
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
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                const f = await CameraService.pickFromLibrary();
                if (!f) return;
                const blob = await CameraService.compressImage(f);
                setCustomBlob(blob);
              }}
            >
              <Upload size={14} strokeWidth={1.8} /> {t('useCustomPhoto')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const toggleItem = (id) => {
    if (!selected.has(id) && selected.size >= MAX_TRYON_ITEMS) {
      setError(t('tryOnMaxItems', { max: MAX_TRYON_ITEMS }));
      return;
    }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onCustomFile = async (file) => {
    if (!file) return;
    const blob = await CameraService.compressImage(file);
    setCustomBlob(blob);
  };

  const submit = async () => {
    if (!outfitRefId && selected.size === 0) return;
    // Fits gate — pre-check for instant feedback; the server enforces the real
    // limit (this can be stale across devices, so the catch below also handles it).
    if (fits.loaded && fits.total <= 0) { setOutOfFits(true); return; }
    setSubmitting(true);
    setError(null);
    // Kick off in the background so the user can browse other tabs while
    // the model runs. The cloud function writes a 'pending' generation
    // doc early, then TryOnHistory's live subscription shows it as a
    // pending card and flips to ready when done. We only await long
    // enough to surface pre-flight errors (missing identity refs etc.)
    // — otherwise we navigate to the tryon tab immediately.
    try {
      const promise = GenerationService.startTryOn({
        itemIds: outfitRefId ? [] : Array.from(selected),
        outfitRefId: outfitRefId || null,
        backgroundDesc: backgroundDesc.trim(),
        customPhotoBlob: customBlob,
        removeCustomBg: customBlob ? removeCustomBg : false,
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
      if (/out_of_fits|resource-exhausted/i.test(err?.message || '')) setOutOfFits(true);
      else setError(err.message);
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
          <>
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
            <label className="tryon-custom-bg-toggle">
              <input
                type="checkbox"
                checked={removeCustomBg}
                onChange={e => setRemoveCustomBg(e.target.checked)}
              />
              <span>{t('tryOnRemoveCustomBg')}</span>
            </label>
          </>
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
            </Link>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                const f = await CameraService.pickFromLibrary();
                if (f) onCustomFile(f);
              }}
            >
              <Upload size={13} strokeWidth={1.8} /> {t('useCustomPhoto')}
            </button>
          </div>
        )}
      </section>

      {/* Optional scene — only relevant in identity-refs mode (custom
          photos already carry their own background, which we preserve). */}
      {!customBlob && (
        <div className="tryon-bg-row">
          <label htmlFor="bg-desc" className="tryon-bg-label">{t('tryOnBackgroundLabel')}</label>
          <input
            id="bg-desc"
            type="text"
            className="page-input tryon-bg-input"
            value={backgroundDesc}
            onChange={e => setBackgroundDesc(e.target.value.slice(0, 160))}
            placeholder={t('tryOnBackgroundPlaceholder')}
            maxLength={160}
          />
        </div>
      )}

      {/* ── The garment: a referenced outfit's whole look, OR closet items ── */}
      <div style={{ marginTop: '0.75rem' }} />
      {outfitRefId ? (
        <section className="tryon-outfitref">
          <h3 className="tryon-section-head">{t('tryOnOutfitRefHead')}</h3>
          <p className="tryon-source-hint">{t('tryOnOutfitRefHint')}</p>
          <div className="tryon-outfitref-card">
            {outfitRef && outfitCardPhoto(outfitRef)
              ? <img src={outfitCardPhoto(outfitRef)} alt="" referrerPolicy="no-referrer" />
              : <div className="item-card-skeleton" />}
          </div>
        </section>
      ) : (
        items.length === 0 ? (
          <div className="empty-state empty-state-card" style={{ marginTop: '1rem' }}>
            <p>{t('tryOnEmptyCloset')}</p>
            <Link to="/closet/add" className="btn btn-primary">{t('addItem')}</Link>
          </div>
        ) : (
          <>
            <div className="closet-header" style={{ marginBottom: '0.75rem' }}>
              <h3 className="tryon-section-head" style={{ margin: 0 }}>{t('tryOnPickItems')}</h3>
              <button
                type="button"
                className={`closet-search-btn${filterCount > 0 ? ' has-filters' : ''}`}
                aria-label={t('detailedFilter')}
                onClick={() => setSheetOpen(true)}
              >
                <SlidersHorizontal size={18} strokeWidth={1.7} />
                {filterCount > 0 && <span className="closet-filter-badge">{filterCount}</span>}
              </button>
            </div>
            <div className="closet-grid">
              {visibleItems.map(it => {
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
          </>
        )
      )}

      {sheetOpen && (
        <LookFilterSheet
          filters={filters}
          onToggle={toggleFilter}
          onClear={() => setFilters(emptyLookFilters())}
          onClose={() => setSheetOpen(false)}
          count={filterCount}
          resultCount={visibleItems.length}
        />
      )}

      <AlertModal open={!!error} message={error} onClose={() => setError(null)} />
      <AlertModal
        open={outOfFits}
        title={t('fitsOutTitle')}
        message={t('fitsOutBody')}
        actionLabel={t('inviteFriends')}
        onAction={() => { setOutOfFits(false); navigate('/settings'); }}
        onClose={() => setOutOfFits(false)}
      />

      <div className="builder-cta">
        {fits.loaded && (
          <span className="tryon-fits-left">
            {t('fitsLeft', { n: fits.total })}{fits.bonus > 0 ? ` ${t('fitsBonus', { n: fits.bonus })}` : ''}
          </span>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={submitting || (!outfitRefId && selected.size === 0)}
        >
          <Sparkles size={16} strokeWidth={1.8} />
          {submitting ? t('generating') : (outfitRefId ? t('startTryOn') : `${t('startTryOn')}${selected.size > 0 ? ` · ${selected.size}` : ''}`)}
        </button>
      </div>
    </div>
  );
}

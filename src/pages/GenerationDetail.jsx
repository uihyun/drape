import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { Heart, RefreshCw, Trash2 } from 'lucide-react';
import { db } from '../firebase.js';
import { GenerationService } from '../services/generation-service.js';
import { Comments } from '../components/Comments.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Pick readable ink for a palette swatch background.
function contrastInk(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return '#111';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111' : '#fff';
}

// Variant gallery + rating + regenerate. The Cloud Function writes
// `status: 'pending' → 'ready' | 'failed'` and `variantUrls[]` directly to
// the Generation doc, so this view auto-updates via onSnapshot.
export function GenerationDetail({ user }) {
  const { t } = useLocale();
  const { generationId } = useParams();
  const navigate = useNavigate();
  const [gen, setGen] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!generationId) return;
    return onSnapshot(doc(db, 'generations', generationId), snap => {
      setGen(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [generationId]);

  // Once a try-on is ready and the viewer owns it, run the palette /
  // composition analysis (once) — same editorial read OOTDs get. Guard
  // on !palette so it fires exactly once per generation.
  useEffect(() => {
    if (!gen || gen.status !== 'ready') return;
    if (!user || gen.userId !== user.uid) return;
    if (gen.palette || gen.analyzedAt) return;
    GenerationService.analyzeGeneration(gen.id)
      .catch(e => console.warn('analyzeGeneration skipped:', e?.message));
  }, [gen?.id, gen?.status, gen?.palette, gen?.analyzedAt, user?.uid]);

  // Hydrate the items that were used in this try-on so we can show
  // them on the result page (so the user remembers what they picked).
  useEffect(() => {
    const ids = gen?.itemIds || [];
    if (!ids.length) { setItems([]); return; }
    let cancelled = false;
    Promise.all(
      ids.map(id => getDoc(doc(db, 'items', id))
        .then(s => s.exists() ? { id: s.id, ...s.data() } : null)
        .catch(() => null))
    ).then(rows => {
      if (!cancelled) setItems(rows.filter(Boolean));
    });
    return () => { cancelled = true; };
  }, [gen?.id, gen?.itemIds?.join('|')]);

  if (!gen) return <div className="loading"><div className="spinner" /></div>;
  if (user && gen.userId !== user.uid) {
    return <div className="empty-state"><p>{t('notFound')}</p></div>;
  }

  const toggleLike = async () => {
    await GenerationService.toggleLike(gen.id, !gen.liked);
  };

  // Same async pattern as the initial try-on: kick off in the background,
  // race a 1.5s timeout — if the function returns fast, navigate to the
  // new detail page; otherwise drop the user onto /profile/tryon where
  // the pending card shows up via the live subscription.
  const regen = async () => {
    setRegenerating(true);
    try {
      const promise = GenerationService.startTryOn({
        itemIds: gen.itemIds,
        modelTier: gen.modelTier,
        title: gen.title || '',
        regenerateOf: gen.id,
      });
      const result = await Promise.race([
        promise.then(r => ({ kind: 'ok', r })),
        new Promise(resolve => setTimeout(() => resolve({ kind: 'timeout' }), 1500)),
      ]);
      if (result.kind === 'ok') {
        navigate(`/tryon/${result.r.generationId}`);
      } else {
        promise.catch(err => console.warn('background regen failed:', err?.message));
        navigate('/profile/tryon');
      }
    } catch (err) {
      console.warn('regen failed', err.message);
    } finally { setRegenerating(false); }
  };

  const remove = async () => {
    if (!confirm(t('confirmDeleteGeneration'))) return;
    try {
      await GenerationService.deleteGeneration(gen.id);
      navigate('/profile/tryon');
    } catch (err) {
      console.warn('delete generation failed', err.message);
      alert(err.message || 'delete_failed');
    }
  };

  return (
    <div className="page generation-detail">
      <h1 className="page-h1">{t('tryOnResult')}</h1>

      {gen.status === 'pending' && (
        <div className="loading"><div className="spinner" /></div>
      )}

      {gen.status === 'failed' && (
        <div className="empty-state empty-state-card">
          <p>{t('tryOnFailed')}</p>
          {gen.errors?.length > 0 && (
            <p className="muted">{gen.errors.join('; ')}</p>
          )}
          <button className="btn btn-primary" onClick={regen} disabled={regenerating}>
            <RefreshCw size={14} strokeWidth={1.7} />
            {regenerating ? t('regenerating') : t('regenerate')}
          </button>
        </div>
      )}

      {gen.status === 'ready' && (
        <>
          <div className={`variants-grid${(gen.variantUrls || []).length === 1 ? ' single' : ''}`}>
            {(gen.variantUrls || []).map((url, i) => (
              <div key={i} className="variant">
                <img src={url} alt={`variant ${i + 1}`} loading="lazy" />
              </div>
            ))}
          </div>

          {/* Analysis runs async after the image is ready. Show a calm
              "analyzing" placeholder so the empty space reads as
              in-progress, not broken, while title/palette/notes load. */}
          {!gen.analyzedAt && !gen.palette && (
            <div className="gen-analyzing">
              <span className="dot-pulse" /> {t('tryOnAnalyzing')}
            </div>
          )}


          {Array.isArray(gen.palette) && gen.palette.length > 0 && (
            <section className="outfit-palette">
              {gen.palette.map((c, i) => (
                <div
                  key={i}
                  className="palette-card"
                  style={{ background: c.hex, color: contrastInk(c.hex) }}
                >
                  <span className="palette-pct">{Math.round(c.percent || 0)}%</span>
                  <div className="palette-meta">
                    <div className="palette-name">{c.name || ''}</div>
                    <div className="palette-hex">{c.hex}</div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {Array.isArray(gen.composition) && gen.composition.length > 0 && (
            <section className="outfit-composition">
              <header>
                <h2>{t('aestheticComposition')}</h2>
                <span className="composition-sub">{t('aestheticCompositionSub')}</span>
              </header>
              <ul>
                {gen.composition.map((c, i) => {
                  const pct = Math.max(0, Math.min(100, ((c.level || 0) / 5) * 100));
                  return (
                    <li key={i} className="composition-row">
                      <span className="composition-label">{t(`taxonomy.styles.${c.label}`) || c.label}</span>
                      <div className="composition-bar" role="meter" aria-valuemin="0" aria-valuemax="5" aria-valuenow={c.level || 0} aria-label={c.label}>
                        <div className="composition-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {gen.notes && (
            <section className="outfit-notes">
              <header><h2>{t('notesOnComposition')}</h2></header>
              <p>{gen.notes}</p>
            </section>
          )}

          {items.length > 0 && (
            <section className="gen-items">
              <h3 className="gen-items-head">{t('itemsUsed')}</h3>
              <div className="gen-items-row">
                {items.map(it => {
                  const cover = it.croppedUrl || it.originalUrl;
                  return (
                    <Link key={it.id} to={`/i/${it.id}`} className="gen-item-card">
                      <div className="gen-item-thumb">
                        {cover
                          ? <img src={cover} alt={it.name || ''} loading="lazy" />
                          : <div className="item-card-skeleton" />}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <div className="gen-actions">
            <button
              type="button"
              className={`btn btn-secondary gen-like-btn${gen.liked ? ' is-liked' : ''}`}
              onClick={toggleLike}
              aria-pressed={!!gen.liked}
              aria-label={gen.liked ? t('selfUnlike') : t('selfLike')}
            >
              <Heart size={15} strokeWidth={1.7} fill={gen.liked ? 'currentColor' : 'none'} />
              {gen.liked ? t('selfUnlike') : t('selfLike')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={regen}
              disabled={regenerating}
            >
              <RefreshCw size={14} strokeWidth={1.7} />
              {regenerating ? t('regenerating') : t('regenerate')}
            </button>
            <button
              type="button"
              className="btn btn-secondary danger-btn"
              onClick={remove}
            >
              <Trash2 size={14} strokeWidth={1.7} /> {t('delete')}
            </button>
          </div>

          <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
          <Comments
            parentColl="generations"
            parentId={gen.id}
            ownerId={gen.userId}
            user={user}
            onSignInRequest={() => {}}
          />
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { ThumbsUp, ThumbsDown, RefreshCw, Trash2 } from 'lucide-react';
import { db } from '../firebase.js';
import { GenerationService } from '../services/generation-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

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

  const rate = async (v) => {
    await GenerationService.rateGeneration(gen.id, gen.rating === v ? 0 : v);
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
          <div className="variants-grid">
            {(gen.variantUrls || []).map((url, i) => (
              <div key={i} className="variant">
                <img src={url} alt={`variant ${i + 1}`} loading="lazy" />
              </div>
            ))}
          </div>

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
                      {it.name && <span className="gen-item-name">{it.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <div className="rate-block">
            <span className="rate-label">{t('rateThis')}</span>
            <div className="rate-thumbs">
              <button
                type="button"
                className={`rate-thumb${gen.rating === 1 ? ' active' : ''}`}
                onClick={() => rate(1)}
                aria-label={t('good')}
              >
                <ThumbsUp size={16} strokeWidth={1.7} />
                <span>{t('good')}</span>
              </button>
              <button
                type="button"
                className={`rate-thumb${gen.rating === -1 ? ' active' : ''}`}
                onClick={() => rate(-1)}
                aria-label={t('bad')}
              >
                <ThumbsDown size={16} strokeWidth={1.7} />
                <span>{t('bad')}</span>
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary rate-regen"
              onClick={regen}
              disabled={regenerating}
            >
              <RefreshCw size={14} strokeWidth={1.7} />
              {regenerating ? t('regenerating') : t('regenerate')}
            </button>
            <button
              type="button"
              className="btn btn-secondary danger-btn rate-delete"
              onClick={remove}
            >
              <Trash2 size={14} strokeWidth={1.7} /> {t('delete')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

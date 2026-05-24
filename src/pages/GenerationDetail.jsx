import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
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

  useEffect(() => {
    if (!generationId) return;
    return onSnapshot(doc(db, 'generations', generationId), snap => {
      setGen(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [generationId]);

  if (!gen) return <div className="loading"><div className="spinner" /></div>;
  if (user && gen.userId !== user.uid) {
    return <div className="empty-state"><p>{t('notFound')}</p></div>;
  }

  const rate = async (v) => {
    await GenerationService.rateGeneration(gen.id, gen.rating === v ? 0 : v);
  };

  const regen = async () => {
    setRegenerating(true);
    try {
      const { generationId: newId } = await GenerationService.startTryOn({
        itemIds: gen.itemIds,
        modelTier: gen.modelTier,
        regenerateOf: gen.id,
      });
      navigate(`/tryon/${newId}`);
    } catch (err) {
      console.warn('regen failed', err.message);
    } finally { setRegenerating(false); }
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
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { IdentityService } from '../services/identity-service.js';
import { GenerationService } from '../services/generation-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Try-on entry. Asks the user to:
//   1. confirm they have identity reference photos on file
//   2. pick item(s) from the closet (or read item ids from ?items=)
//   3. start — navigates to /tryon/:generationId for the variant gallery
export function TryOn({ user, onSignIn, onOpenCredits }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [refs, setRefs] = useState(null);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(() => {
    const ids = search.get('items');
    return new Set(ids ? ids.split(',') : []);
  });
  const [tier, setTier] = useState('pro');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    IdentityService.getMyRefs().then(setRefs);
    return ItemService.subscribeMyCloset(user.uid, list => {
      setItems(list.filter(i => i.status === 'ready'));
    });
  }, [user]);

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

  const needRefs = refs !== null && refs.length === 0;

  if (needRefs) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('navTryOn')}</h1>
        <div className="empty-state empty-state-card">
          <h2>{t('addIdentityRefsTitle')}</h2>
          <p>{t('addIdentityRefsBody')}</p>
          <Link to="/settings" className="btn btn-primary">{t('goToSettings')}</Link>
        </div>
      </div>
    );
  }

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const submit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const { generationId } = await GenerationService.startTryOn({
        itemIds: Array.from(selected),
        modelTier: tier,
      });
      navigate(`/tryon/${generationId}`);
    } catch (err) {
      setError(err.message);
      // Credits / quota errors → nudge the credit modal.
      if (/credit|quota/i.test(err.message || '')) onOpenCredits?.();
    } finally { setSubmitting(false); }
  };

  return (
    <div className="page tryon-entry">
      <h1 className="page-h1">{t('tryOnPick')}</h1>

      <div className="tier-toggle">
        <button type="button" className={`chip ${tier === 'pro' ? 'active' : ''}`} onClick={() => setTier('pro')}>
          {t('tierPro')} <span className="muted">· {t('tierProHint')}</span>
        </button>
        <button type="button" className={`chip ${tier === 'flash' ? 'active' : ''}`} onClick={() => setTier('flash')}>
          {t('tierFlash')} <span className="muted">· {t('tierFlashHint')}</span>
        </button>
      </div>

      {items.length === 0 ? (
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
                onClick={() => toggle(it.id)}
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

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { GenerationService } from '../services/generation-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// All of the user's try-on results in one grid. Each cell shows the
// first variant URL as a thumbnail and routes to /tryon/:id for the
// full result + ratings. Renders as a Profile tab when `embedded`,
// or standalone at /tryons.
export function TryOnHistory({ user, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const [gens, setGens] = useState(null);

  useEffect(() => {
    if (!user || user.isAnonymous) { setGens([]); return; }
    // Live subscription so a just-started 'pending' run appears here
    // immediately while the user browses other tabs, and flips to
    // 'ready' (cover thumb) when the Cloud Function finishes.
    return GenerationService.subscribeMyGenerations(user.uid, setGens, { pageSize: 60 });
  }, [user]);

  if (!user || user.isAnonymous) {
    return (
      <div className={embedded ? '' : 'page'}>
        {!embedded && <h1 className="page-h1">{t('tryOnHistory')}</h1>}
        <div className="empty-state empty-state-card">
          <p>{t('tryOnSignInTitle')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'page'}>
      {!embedded && (
        <div className="closet-header">
          <h1 className="page-h1" style={{ margin: 0 }}>{t('tryOnHistory')}</h1>
          <Link to="/tryon" className="btn btn-primary">
            <Sparkles size={14} strokeWidth={1.8} /> {t('newTryOn')}
          </Link>
        </div>
      )}

      {gens === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : gens.length === 0 ? (
        <div className="empty-state empty-state-card">
          <p>{t('tryOnHistoryEmpty')}</p>
          <Link to="/tryon" className="btn btn-primary">
            <Sparkles size={14} strokeWidth={1.8} /> {t('newTryOn')}
          </Link>
        </div>
      ) : (
        <div className="tryon-history-grid">
          {gens.map(g => {
            const cover = (g.variantUrls || [])[0];
            const status = g.status || 'unknown';
            return (
              <Link key={g.id} to={`/tryon/${g.id}`} className="tryon-history-card">
                <div className="tryon-history-cover">
                  {cover
                    ? <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    : <div className={`tryon-history-empty status-${status}`}>{t(`tryOnStatus.${status}`) || status}</div>}
                </div>
                <div className="tryon-history-meta">
                  <span className="tryon-history-tier">{(g.modelTier || 'pro').toUpperCase()}</span>
                  <span className="tryon-history-date">
                    {g.createdAt?.toDate?.()?.toLocaleDateString?.() || ''}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TryOnHistory;

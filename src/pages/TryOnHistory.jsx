import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { GenerationService } from '../services/generation-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// All of the user's try-on results in one grid. Each cell shows the
// first variant URL as a thumbnail and routes to /tryon/:id for the
// full result + ratings.
export function TryOnHistory({ user, onSignIn }) {
  const { t } = useLocale();
  const [gens, setGens] = useState(null);

  useEffect(() => {
    if (!user || user.isAnonymous) { setGens([]); return; }
    GenerationService.listMyGenerations({ uid: user.uid, pageSize: 60 })
      .then(({ generations }) => setGens(generations))
      .catch(() => setGens([]));
  }, [user]);

  if (!user || user.isAnonymous) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('tryOnHistory')}</h1>
        <div className="empty-state empty-state-card">
          <p>{t('tryOnSignInTitle')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="closet-header">
        <h1 className="page-h1" style={{ margin: 0 }}>{t('tryOnHistory')}</h1>
        <Link to="/tryon" className="btn btn-primary">
          <Sparkles size={14} strokeWidth={1.8} /> {t('newTryOn')}
        </Link>
      </div>

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

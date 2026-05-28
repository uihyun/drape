import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Search, X } from 'lucide-react';
import { GenerationService } from '../services/generation-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// All of the user's try-on results in one grid. Each cell shows the
// first variant URL as a thumbnail and routes to /tryon/:id for the
// full result + ratings. Renders as a Profile tab when `embedded`,
// or standalone at /tryons.
export function TryOnHistory({ user, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const [gens, setGens] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user || user.isAnonymous) { setGens([]); return; }
    // Live subscription so a just-started 'pending' run appears here
    // immediately while the user browses other tabs, and flips to
    // 'ready' (cover thumb) when the Cloud Function finishes.
    return GenerationService.subscribeMyGenerations(user.uid, setGens, { pageSize: 60 });
  }, [user]);

  // Filter by title or creation date — once there are hundreds of
  // try-ons, scrolling isn't enough. Title is user-set; date matches
  // the locale-formatted string ("5/28/2026" or "2026").
  const visible = useMemo(() => {
    if (!gens) return null;
    const q = search.trim().toLowerCase();
    if (!q) return gens;
    return gens.filter(g => {
      const title = (g.title || '').toLowerCase();
      const date = (g.createdAt?.toDate?.()?.toLocaleDateString?.() || '').toLowerCase();
      return title.includes(q) || date.includes(q);
    });
  }, [gens, search]);

  if (!user || user.isAnonymous) {
    return (
      <div className={embedded ? '' : 'page'}>
        {!embedded && <h1 className="page-h1">{t('tryOnHistory')}</h1>}
        <div className="empty-state empty-state-card">
          <p>{t('tryOnSignInTitle')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
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

      {gens && gens.length > 0 && (
        <div className="closet-search-bar tryon-search-bar">
          <Search size={16} strokeWidth={1.6} />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('tryOnSearchPlaceholder')}
            className="closet-search-input"
          />
          {search && (
            <button type="button" className="icon-btn" onClick={() => setSearch('')} aria-label={t('clear')}>
              <X size={16} strokeWidth={1.7} />
            </button>
          )}
        </div>
      )}

      {visible === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : gens.length === 0 ? (
        <div className="empty-state empty-state-card">
          <p>{t('tryOnHistoryEmpty')}</p>
          <Link to="/tryon" className="btn btn-primary">
            <Sparkles size={14} strokeWidth={1.8} /> {t('newTryOn')}
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state empty-state-card">
          <p>{t('tryOnSearchEmpty')}</p>
        </div>
      ) : (
        <div className="tryon-history-grid">
          {visible.map(g => {
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
                  {g.title
                    ? <span className="tryon-history-title">{g.title}</span>
                    : <span className="tryon-history-date">{g.createdAt?.toDate?.()?.toLocaleDateString?.() || ''}</span>}
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

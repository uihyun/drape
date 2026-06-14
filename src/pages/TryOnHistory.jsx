import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, SlidersHorizontal, X } from 'lucide-react';
import { GenerationService } from '../services/generation-service.js';
import { ItemService } from '../services/item-service.js';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';
import {
  LookFilterSheet, emptyLookFilters, countLookFilters, lookMatches,
} from '../components/LookFilterSheet.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

export function TryOnHistory({ user, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const [gens, setGens] = useState(null);
  const [closet, setCloset] = useState({});
  const [filters, setFilters] = useState(emptyLookFilters());
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterCount = countLookFilters(filters);

  // Live subscription window grows by 60 as the user scrolls (real-time kept).
  const [genLimit, setGenLimit] = useState(60);
  useEffect(() => {
    if (!user || user.isAnonymous) { setGens([]); return; }
    return GenerationService.subscribeMyGenerations(user.uid, setGens, { pageSize: genLimit });
  }, [user, genLimit]);

  const genHasMore = !!gens && gens.length >= genLimit;
  const genSentinelRef = useInfiniteScroll({
    hasMore: genHasMore, loading: false, onLoadMore: () => setGenLimit(n => n + 60),
  });

  // Closet (keyed by id) supplies item tags for the look filter — a try-on
  // is filtered by the tags of the items it used (+ its own style breakdown).
  useEffect(() => {
    if (!user || user.isAnonymous) { setCloset({}); return; }
    return ItemService.subscribeMyCloset(user.uid, list =>
      setCloset(Object.fromEntries(list.map(i => [i.id, i]))));
  }, [user?.uid]);

  const toggleFilter = (dim, value) => {
    setFilters(prev => {
      const cur = prev[dim] || [];
      const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value];
      return { ...prev, [dim]: next };
    });
  };

  // Quick-delete a try-on straight from the grid — important for failed
  // generations, which otherwise can't be cleared without opening detail.
  const removeGen = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(t('confirmDeleteGeneration'))) return;
    try {
      await GenerationService.deleteGeneration(id);
    } catch (err) {
      console.warn('delete generation failed', err?.message);
    }
  };

  const visible = useMemo(() => {
    if (!gens) return null;
    let list = gens;
    if (filterCount > 0) list = list.filter(g => lookMatches(g, filters, closet));
    return list;
  }, [gens, closet, filters, filterCount]);

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
        <div className="closet-header" style={{ marginBottom: '1.25rem', justifyContent: 'flex-end' }}>
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
                  {status === 'failed' && (
                    <button
                      type="button"
                      className="tryon-history-del"
                      onClick={(e) => removeGen(e, g.id)}
                      aria-label={t('delete')}
                      title={t('delete')}
                    >
                      <X size={14} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {genHasMore && <div ref={genSentinelRef} className="feed-sentinel" />}

      {sheetOpen && (
        <LookFilterSheet
          filters={filters}
          onToggle={toggleFilter}
          onClear={() => setFilters(emptyLookFilters())}
          onClose={() => setSheetOpen(false)}
          count={filterCount}
          resultCount={(visible || []).length}
        />
      )}
    </div>
  );
}

export default TryOnHistory;

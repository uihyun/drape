import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, SlidersHorizontal, Lock } from 'lucide-react';
import { BoardService } from '../services/board-service.js';
import { ItemService } from '../services/item-service.js';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import {
  LookFilterSheet, emptyLookFilters, countLookFilters, lookMatches,
} from '../components/LookFilterSheet.jsx';
import { usePinchColumns } from '../hooks/usePinchColumns.js';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { loadFilters, saveFilters } from '../services/filterStore.js';

// "My boards" with a Saved tab for boards the user has bookmarked
// from other profiles. Same Mine/Saved shape as OutfitList so the
// profile shell's Boards tab reads consistently.
export function BoardList({ user, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const { cols, ref: gridRef } = usePinchColumns('boards', { min: 1, max: 3, def: 2 });
  // Tab in the URL (?bt=) so back-navigation keeps mine/saved.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('bt') === 'saved' ? 'saved' : 'mine';
  const setTab = (next) => setSearchParams((prev) => {
    const p = new URLSearchParams(prev); p.set('bt', next); return p;
  }, { replace: true });
  const [mine, setMine] = useState(null);
  const [saved, setSaved] = useState(null);
  const fkey = `boards:${user?.uid || 'anon'}`;
  const [filters, setFilters] = useState(() => loadFilters(fkey, emptyLookFilters()));
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => { saveFilters(fkey, filters); }, [fkey, filters]);
  const [items, setItems] = useState([]);
  const itemsById = useMemo(
    () => Object.fromEntries(items.map(i => [i.id, i])),
    [items],
  );
  const filterCount = countLookFilters(filters);
  const toggleFilter = (dim, value) => {
    setFilters(prev => {
      const cur = prev[dim] || [];
      const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value];
      return { ...prev, [dim]: next };
    });
  };

  // Boards carry no tags of their own — match a board by the tags of the
  // closet items it pins (stickers[].itemId), reusing the look matcher
  // with a pseudo-look. Only meaningful on the user's own boards, whose
  // referenced items live in their closet (itemsById).
  const boardMatchesFilters = (b) => lookMatches(
    { itemIds: (b.stickers || []).map(s => s.itemId).filter(Boolean) },
    filters,
    itemsById,
  );

  // Mine: live subscription window grows by 30 as the user scrolls.
  const [mineLimit, setMineLimit] = useState(30);
  useEffect(() => {
    if (!user || user.isAnonymous) { setMine([]); return; }
    return BoardService.subscribeMyBoards(setMine, { pageSize: mineLimit });
  }, [user, mineLimit]);

  // Saved: cursor pagination over bookmarks.
  const [savedCursor, setSavedCursor] = useState(null);
  const [savedHasMore, setSavedHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    if (!user || user.isAnonymous) { setSaved([]); return; }
    if (tab !== 'saved') return; // lazy — only fetch when the tab opens
    let cancelled = false;
    setSavedCursor(null); setSavedHasMore(false);
    BoardService.listBookmarkedBoards({ uid: user.uid, pageSize: 30 })
      .then(r => { if (cancelled) return; setSaved(r.boards); setSavedCursor(r.lastVisible); setSavedHasMore(r.hasMore); })
      .catch(() => { if (!cancelled) setSaved([]); });
    return () => { cancelled = true; };
  }, [user, tab]);

  const mineHasMore = !!mine && mine.length >= mineLimit;
  const hasMore = tab === 'saved' ? savedHasMore : mineHasMore;
  const loadMore = () => {
    if (tab !== 'saved') { setMineLimit(n => n + 30); return; }
    if (loadingMore || !savedHasMore || !savedCursor) return;
    setLoadingMore(true);
    BoardService.listBookmarkedBoards({ uid: user.uid, pageSize: 30, cursor: savedCursor })
      .then(r => { setSaved(prev => [...(prev || []), ...r.boards]); setSavedCursor(r.lastVisible); setSavedHasMore(r.hasMore); })
      .catch(err => console.warn('boards loadMore failed:', err?.message))
      .finally(() => setLoadingMore(false));
  };
  const sentinelRef = useInfiniteScroll({ hasMore, loading: loadingMore, onLoadMore: loadMore });

  // Closet items power the mini-canvas thumbnails (each sticker references
  // an itemId, and the card preview needs the cropped image). Only used
  // for the user's own boards — saved boards from other users hydrate
  // their items individually via BoardThumbnail's self-hydration.
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    return ItemService.subscribeMyCloset(user.uid, setItems);
  }, [user]);

  if (!user || user.isAnonymous) {
    return (
      <div className={embedded ? '' : 'page'}>
        {!embedded && <h1 className="page-h1">{t('boards')}</h1>}
        <div className="empty-state empty-state-card">
          <p>{t('boardSignInBody')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
        </div>
      </div>
    );
  }

  const rawList = tab === 'saved' ? saved : mine;
  let list = rawList;
  if (list && tab === 'mine' && filterCount > 0) {
    list = list.filter(boardMatchesFilters);
  }

  return (
    <div className={embedded ? '' : 'page'}>
      {!embedded && (
        <div className="closet-header">
          <h1 className="page-h1" style={{ margin: 0 }}>{t('boards')}</h1>
          <Link to="/boards/new" className="btn btn-primary">
            <Plus size={14} strokeWidth={1.8} /> {t('boardNew')}
          </Link>
        </div>
      )}

      <div className="closet-header" style={{ marginBottom: '1.25rem' }}>
        <nav className="filter-chips filter-chips--text" role="tablist" style={{ margin: 0 }}>
          {['mine', 'saved'].map(key => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`chip${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              {t(`boardsTabs.${key}`)}
            </button>
          ))}
        </nav>
        {tab === 'mine' && (
          <button
            type="button"
            className={`closet-search-btn${filterCount > 0 ? ' has-filters' : ''}`}
            aria-label={t('detailedFilter')}
            onClick={() => setSheetOpen(true)}
          >
            <SlidersHorizontal size={18} strokeWidth={1.7} />
            {filterCount > 0 && <span className="closet-filter-badge">{filterCount}</span>}
          </button>
        )}
      </div>

      {list === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : list.length === 0 ? (
        <div className="empty-state empty-state-card">
          {tab === 'mine' ? (
            <>
              <p>{t('boardsEmpty')}</p>
              <Link to="/boards/new" className="btn btn-primary">
                <Plus size={14} strokeWidth={1.8} /> {t('boardNew')}
              </Link>
            </>
          ) : (
            <>
              <p>{t('savedBoardsEmpty')}</p>
              <Link to="/feed" className="btn btn-secondary">{t('browseFeed')}</Link>
            </>
          )}
        </div>
      ) : (
        <div
          ref={gridRef}
          className="board-list-grid pinch-grid"
          style={{ columns: cols }}
        >
          {list.map(b => (
            <Link key={b.id} to={`/boards/${b.id}`} className="board-card">
              <BoardThumbnail board={b} itemsById={tab === 'mine' ? itemsById : undefined} />
              {tab === 'mine' && !b.isPublic && (
                <span className="card-private-badge" title={t('privateBadge')} aria-label={t('privateBadge')}>
                  <Lock size={12} strokeWidth={2.2} />
                </span>
              )}
              {b.name && (
                <div className="ootd-card-overlay">
                  <h3 className="ootd-card-title">{b.name}</h3>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
      {hasMore && <div ref={sentinelRef} className="feed-sentinel">{loadingMore && <div className="spinner" />}</div>}

      {sheetOpen && (
        <LookFilterSheet
          filters={filters}
          onToggle={toggleFilter}
          onClear={() => setFilters(emptyLookFilters())}
          onClose={() => setSheetOpen(false)}
          count={filterCount}
          resultCount={list?.length ?? 0}
        />
      )}
    </div>
  );
}

function formatCardDate(ts) {
  const d = ts?.toDate?.() || (ts instanceof Date ? ts : null);
  return d ? d.toLocaleDateString() : '';
}

export default BoardList;

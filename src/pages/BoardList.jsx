import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, SlidersHorizontal, Lock, Loader2 } from 'lucide-react';
import { BoardService } from '../services/board-service.js';
import { OutfitService } from '../services/outfit-service.js';
import { ItemService } from '../services/item-service.js';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import { boardRatioWeight } from '../data/boardBackgrounds.js';
import {
  LookFilterSheet, emptyLookFilters, countLookFilters, lookMatches, TIME_SORT, byTime,
} from '../components/LookFilterSheet.jsx';
import { usePinchColumns } from '../hooks/usePinchColumns.js';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';
import { buildSwipeState } from '../services/swipeNav.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { loadFilters, saveFilters } from '../services/filterStore.js';

// "My boards" with a Saved tab for boards the user has bookmarked
// from other profiles. Same Mine/Saved shape as OutfitList so the
// profile shell's Boards tab reads consistently.
export function BoardList({ user, onSignIn, embedded = false }) {
  const { t, lang } = useLocale();
  const navigate = useNavigate();
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
  const [sort, setSort] = useState('newest');
  useEffect(() => { saveFilters(fkey, filters); }, [fkey, filters]);
  const [items, setItems] = useState([]);
  const itemsById = useMemo(
    () => Object.fromEntries(items.map(i => [i.id, i])),
    [items],
  );
  // "Everything I wore this week / this month" (2026-10-08): the closet
  // pieces from that period's OOTDs, gridded onto one board. One board per
  // period — pressing again adds only what's new and leaves the user's own
  // arrangement alone.
  const [rangeBusy, setRangeBusy] = useState(null);
  const [rangeMsg, setRangeMsg] = useState('');
  const makeRangeBoard = async (kind) => {
    if (!user || rangeBusy) return;
    setRangeBusy(kind);
    setRangeMsg('');
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const now = new Date();
    let from; let to; let key; let name;
    if (kind === 'week') {
      const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
      const fmt = (d) => d.toLocaleDateString(lang, { month: 'short', day: 'numeric' });
      from = ymd(mon); to = ymd(sun); key = `week:${from}`;
      name = t('boardWeekName', { range: `${fmt(mon)} – ${fmt(sun)}` });
    } else {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      from = ymd(first); to = ymd(last); key = `month:${from.slice(0, 7)}`;
      name = t('boardMonthName', { month: first.toLocaleDateString(lang, { year: 'numeric', month: 'long' }) });
    }
    try {
      const byDate = await OutfitService.listMonth({ uid: user.uid, monthStart: from, monthEnd: to });
      const worn = Object.values(byDate).flat();
      const ids = [...new Set(worn.flatMap((o) => [
        ...(o.itemIds || []),
        ...Object.values(o.pieceLinks || {}).flat(),
      ]))].filter((id) => itemsById[id] && itemsById[id].status === 'ready' && !itemsById[id].isArchived);
      if (!ids.length) { setRangeMsg(t('boardRangeEmpty')); return; }
      const existing = await BoardService.findRangeBoard(key);
      if (existing) {
        const have = new Set((existing.stickers || []).map((x) => x.itemId));
        const add = ids.filter((id) => !have.has(id));
        if (add.length) await BoardService.updateBoard(existing.id, { stickers: BoardService.addToGrid(existing.stickers || [], add) });
        navigate(`/boards/${existing.id}`);
      } else {
        const { id } = await BoardService.createBoard({ name, stickers: BoardService.gridStickers(ids), rangeKey: key });
        navigate(`/boards/${id}`);
      }
    } catch (e) {
      console.warn('range board failed', e?.message);
      setRangeMsg(t('boardRangeError'));
    } finally { setRangeBusy(null); }
  };

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

  // Everything below stays ABOVE the sign-in early return — hooks after a
  // conditional return crash with React #310 when auth state flips.
  const rawList = tab === 'saved' ? saved : mine;
  let list = rawList;
  if (list && tab === 'mine' && filterCount > 0) {
    list = list.filter(boardMatchesFilters);
  }
  if (list) list = list.slice().sort(byTime(sort, b => b.createdAt?.toMillis?.() ?? 0));

  // JS masonry: place each board into the currently-shortest column. CSS
  // `columns` balancing is engine-dependent (WebKit ≠ Blink), so it laid boards
  // out differently on iPhone vs desktop; explicit JS columns are deterministic
  // everywhere. Height weight = ratio (h/w) + a small constant for the card's
  // name/border chrome. `i` stays the index into `list` so swipe order is preserved.
  const boardColumns = useMemo(() => {
    const columns = Array.from({ length: cols }, () => ({ items: [], h: 0 }));
    (list || []).forEach((b, i) => {
      let c = 0;
      for (let k = 1; k < cols; k++) if (columns[k].h < columns[c].h) c = k;
      columns[c].items.push({ b, i });
      columns[c].h += boardRatioWeight(b?.ratio) + 0.18;
    });
    return columns;
  }, [list, cols]);
  const listIds = useMemo(() => (list || []).map((x) => x.id), [list]);

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

      <div className="closet-header" style={{ marginBottom: '1rem' }}>
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

      {tab === 'mine' && (
        <div className="board-range-row">
          {['week', 'month'].map((k) => (
            <button key={k} type="button" className="board-range-btn" onClick={() => makeRangeBoard(k)} disabled={!!rangeBusy}>
              {rangeBusy === k && <Loader2 size={13} className="spin" />}
              {t(k === 'week' ? 'boardThisWeek' : 'boardThisMonth')}
            </button>
          ))}
        </div>
      )}
      {rangeMsg && <p className="board-range-msg">{rangeMsg}</p>}

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
          className="board-masonry pinch-grid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {boardColumns.map((col, ci) => (
            <div className="board-masonry-col" key={ci}>
              {col.items.map(({ b, i }) => (
                <Link key={b.id} to={`/boards/${b.id}`} state={buildSwipeState(listIds, i, 'board')} className="board-card">
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
          ))}
        </div>
      )}
      {hasMore && <div ref={sentinelRef} className="feed-sentinel">{loadingMore && <div className="spinner" />}</div>}

      {sheetOpen && (
        <LookFilterSheet
          sortValue={sort}
          onSortChange={setSort}
          sortOptions={TIME_SORT}
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

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Masonry } from '../components/Masonry.jsx';
import { OutfitService } from '../services/outfit-service.js';
import { BoardService } from '../services/board-service.js';
import { FollowService, FOLLOWING_FEED_LIMIT } from '../services/follow-service.js';
import { MarketplaceService } from '../services/marketplace-service.js';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import { CardImage } from '../components/CardImage.jsx';
import { outfitCardPhoto } from '../utils/outfitPhoto.js';
import { ListingCard } from './Marketplace.jsx';
import { feedCache, feedKey as cacheKey } from '../services/uiCache.js';
import { buildSwipeState } from '../services/swipeNav.js';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';
import { getFeedTtlMs } from '../services/appConfig.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Returning to the feed within this window restores your scrolled-down list
// (items + cursor) so you don't lose your place; after it, the feed resets to a
// fresh first page. The window comes from `getFeedTtlMs()` (server-tunable,
// defaults to 1 min) so others' new/removed posts surface fairly quickly; pull
// to refresh forces it immediately.

// Feed pages are cached in services/uiCache (shared with the splash warm-up),
// keyed by kind|sort|scope. The Feed component unmounts when you open a detail
// and remounts on back — the cache seeds state instantly (no spinner flash);
// the effects still refetch in the background to pick up new posts.

// Discovery feed — tapping a card opens its detail page. kind / sort /
// scope all live in the URL so returning from a detail restores the exact
// view (Popular, Following, Boards…) instead of snapping to defaults.
export function Feed({ user, onSignIn }) {
  const { t } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const setParam = (key, val) => setSearchParams((prev) => {
    const p = new URLSearchParams(prev); p.set(key, val); return p;
  }, { replace: true });
  const VALID_KINDS = new Set(['ootds', 'boards', 'market']);
  const rawKind = searchParams.get('kind');
  const kind = VALID_KINDS.has(rawKind) ? rawKind : 'ootds';
  const setKind = (k) => setParam('kind', k);
  const sort = searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  const setSort = (s) => setParam('sort', s);
  const scope = searchParams.get('scope') === 'following' ? 'following' : 'forYou';
  const setScope = (s) => setParam('scope', s);
  // Seed from cache for the current view so back-navigation paints
  // immediately (no spinner) — the effect below still refreshes in place.
  // Cache holds { items, cursor, hasMore, ts } (or a bare array from warm-up).
  const seeded = feedCache.get(cacheKey(kind, sort, scope));
  const seededItems = seeded ? (Array.isArray(seeded) ? seeded : seeded.items) : null;
  const [ootds, setOotds] = useState(kind === 'ootds' ? seededItems : null);
  const [boards, setBoards] = useState(kind === 'boards' ? seededItems : null);
  const [listings, setListings] = useState(kind === 'market' ? seededItems : null);
  // null = not yet loaded, [] = signed in but follows nobody.
  const [followingIds, setFollowingIds] = useState(null);
  // Pagination for the active kind (only one kind is visible at a time).
  const [cursor, setCursor] = useState(() => (seeded && !Array.isArray(seeded) ? seeded.cursor : null));
  const [hasMore, setHasMore] = useState(() => (seeded && !Array.isArray(seeded) ? !!seeded.hasMore : false));
  const [loadingMore, setLoadingMore] = useState(false);
  const isFollowingScope = scope === 'following';
  const isLoggedIn = user && !user.isAnonymous;

  useEffect(() => {
    if (!isFollowingScope) return;
    if (!isLoggedIn) { setFollowingIds([]); return; }
    let cancelled = false;
    FollowService.getFollowingIds(user.uid, { max: FOLLOWING_FEED_LIMIT })
      .then(ids => { if (!cancelled) setFollowingIds(ids); })
      .catch(err => {
        console.warn('getFollowingIds failed:', err?.code, err?.message);
        if (!cancelled) setFollowingIds([]);
      });
    return () => { cancelled = true; };
  }, [user?.uid, isFollowingScope, isLoggedIn]);

  const setActive = kind === 'market' ? setListings : kind === 'boards' ? setBoards : setOotds;

  // One paginated fetcher for whatever (kind, scope, sort) is active. Returns
  // a normalized { items, cursor, hasMore } regardless of the underlying call.
  const fetchPage = (cur) => {
    if (kind === 'ootds') {
      return isFollowingScope
        ? OutfitService.listFollowingFeed({ followingIds, pageSize: 24, cursor: cur }).then(r => ({ items: r.ootds, cursor: r.lastVisible, hasMore: r.hasMore }))
        : OutfitService.listPublicFeed({ pageSize: 24, sortBy: sort, cursor: cur }).then(r => ({ items: r.ootds, cursor: r.lastVisible, hasMore: r.hasMore }));
    }
    if (kind === 'boards') {
      return isFollowingScope
        ? BoardService.listFollowingBoards({ followingIds, pageSize: 24, cursor: cur }).then(r => ({ items: r.boards, cursor: r.lastVisible, hasMore: r.hasMore }))
        : BoardService.listPublicBoards({ pageSize: 24, sortBy: sort, cursor: cur }).then(r => ({ items: r.boards, cursor: r.lastVisible, hasMore: r.hasMore }));
    }
    return isFollowingScope
      ? MarketplaceService.listBySellers({ sellerIds: followingIds, pageSize: 30 }).then(rows => ({ items: rows, cursor: null, hasMore: false }))
      : MarketplaceService.listRecent({ pageSize: 30, lastDoc: cur }).then(r => ({ items: r.listings, cursor: r.lastVisible, hasMore: r.hasMore }));
  };

  // Initial load (and refresh) for the active view.
  useEffect(() => {
    if (isFollowingScope && followingIds === null) return; // wait for follow ids
    const key = cacheKey(kind, sort, scope);
    const cached = feedCache.get(key);
    // Within the TTL, restore the whole scrolled-down list + cursor — don't
    // refetch, so the user keeps their place.
    if (cached && !Array.isArray(cached) && cached.ts && Date.now() - cached.ts < getFeedTtlMs()) {
      setActive(cached.items); setCursor(cached.cursor); setHasMore(!!cached.hasMore);
      return;
    }
    // Otherwise paint any stale cache, then refetch a fresh first page.
    const shownItems = cached ? (Array.isArray(cached) ? cached : cached.items) : null;
    setActive(shownItems);
    setCursor(null); setHasMore(false);
    let cancelled = false;
    fetchPage(null).then(res => {
      if (cancelled) return;
      // Don't replace the list when the fresh first page matches what's already
      // shown — a full swap re-renders the whole grid and reads as a re-sort.
      // Only swap in genuinely-changed content.
      const sameList = shownItems && shownItems.length === res.items.length
        && shownItems.every((it, i) => it.id === res.items[i].id);
      if (!sameList) setActive(res.items);
      setCursor(res.cursor); setHasMore(res.hasMore);
      feedCache.set(key, { items: res.items, cursor: res.cursor, hasMore: res.hasMore, ts: Date.now() });
    }).catch(err => {
      console.warn('feed load failed:', err?.code, err?.message);
      if (!cancelled && !cached) setActive([]);
    });
    return () => { cancelled = true; };
  }, [kind, sort, scope, isFollowingScope, followingIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    const key = cacheKey(kind, sort, scope);
    fetchPage(cursor).then(res => {
      setActive(prev => {
        const merged = [...(prev || []), ...res.items];
        feedCache.set(key, { items: merged, cursor: res.cursor, hasMore: res.hasMore, ts: Date.now() });
        return merged;
      });
      setCursor(res.cursor); setHasMore(res.hasMore);
    }).catch(err => console.warn('feed loadMore failed:', err?.message))
      .finally(() => setLoadingMore(false));
  };

  const sentinelRef = useInfiniteScroll({ hasMore, loading: loadingMore, onLoadMore: loadMore });

  // Pull-to-refresh: force a fresh first page for the active view (bypasses the
  // TTL cache), updated in place so there's no loading flash.
  const onRefresh = async () => {
    const key = cacheKey(kind, sort, scope);
    const res = await fetchPage(null);
    setActive(res.items); setCursor(res.cursor); setHasMore(res.hasMore);
    feedCache.set(key, { items: res.items, cursor: res.cursor, hasMore: res.hasMore, ts: Date.now() });
  };
  const { pull, refreshing } = usePullToRefresh(onRefresh);

  // (Feed cards no longer show an author chip, so there's no author
  // hydration here — it was dead work that re-rendered the whole list.)

  const showingBoards = kind === 'boards';
  const showingMarket = kind === 'market';
  const list = showingMarket ? listings : showingBoards ? boards : ootds;
  // Ordered ids of the visible list → handed to each card so the detail page
  // can swipe between siblings.
  const ootdIds = (ootds || []).map(o => o.id);
  const boardIds = (boards || []).map(b => b.id);
  const listingIds = (listings || []).map(it => it.id);

  const setKindAnd = (k) => setKind(k);

  return (
    <div className="community-feed">
      {(pull > 0 || refreshing) && (
        <div className="feed-ptr" style={{ height: refreshing ? 44 : pull }} aria-hidden="true">
          <span className={`spinner spinner-sm${refreshing ? '' : ' is-pulling'}`} />
        </div>
      )}
      <header className="feed-top">
        <div className="feed-top-controls">
          <nav className="feed-kind-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'ootds'}
              className={`feed-kind-tab${kind === 'ootds' ? ' active' : ''}`}
              onClick={() => setKindAnd('ootds')}
            >
              {t('feedKindOotds')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'boards'}
              className={`feed-kind-tab${kind === 'boards' ? ' active' : ''}`}
              onClick={() => setKindAnd('boards')}
            >
              {t('feedKindBoards')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'market'}
              className={`feed-kind-tab${kind === 'market' ? ' active' : ''}`}
              onClick={() => setKindAnd('market')}
            >
              {t('feedKindMarket')}
            </button>
          </nav>
          {/* Following is a compact filter toggle, not a top-level tab —
              it just narrows the current kind (incl. Market) to people you
              follow. */}
          <button
            type="button"
            className={`feed-following-toggle${isFollowingScope ? ' active' : ''}`}
            aria-pressed={isFollowingScope}
            onClick={() => setScope(isFollowingScope ? 'forYou' : 'following')}
          >
            <Users size={15} strokeWidth={1.8} />
            {t('feedScopeFollowing')}
          </button>
        </div>
        {/* Sort only applies to OOTDs/Boards in the For-You scope. Hidden
            for market (no like-sort) + following. */}
        {!showingMarket && !isFollowingScope && (
          <nav className="feed-sort-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={sort === 'latest'}
              className={`feed-sort-tab${sort === 'latest' ? ' active' : ''}`}
              onClick={() => setSort('latest')}
            >
              {t('feedSortLatest')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sort === 'popular'}
              className={`feed-sort-tab${sort === 'popular' ? ' active' : ''}`}
              onClick={() => setSort('popular')}
            >
              {t('feedSortPopular')}
            </button>
          </nav>
        )}
      </header>

      {list === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : list.length === 0 ? (
        <FeedEmpty
          t={t}
          kind={kind}
          followingMode={isFollowingScope}
          isLoggedIn={isLoggedIn}
          hasFollows={Array.isArray(followingIds) && followingIds.length > 0}
          onSignIn={onSignIn}
          onSwitchScope={() => setScope('forYou')}
        />
      ) : (
        <>
          {showingMarket ? (
            <div className="marketplace-grid feed-market-grid">
              {listings.map((it, i) => <ListingCard key={it.id} item={it} ids={listingIds} index={i} t={t} />)}
            </div>
          ) : showingBoards ? (
            <Masonry items={boards}>
              {(b, i) => <BoardCard board={b} ids={boardIds} index={i} />}
            </Masonry>
          ) : (
            <Masonry items={ootds}>
              {(o, i) => <OotdCard ootd={o} ids={ootdIds} index={i} />}
            </Masonry>
          )}
          {hasMore && (
            <div ref={sentinelRef} className="feed-sentinel">
              {loadingMore && <div className="spinner" />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BoardCard({ board, ids, index }) {
  return (
    <Link to={`/boards/${board.id}`} state={buildSwipeState(ids, index, 'board')} className="board-feed-card">
      <BoardThumbnail board={board} className="board-feed-thumb" />
    </Link>
  );
}

function OotdCard({ ootd, ids, index }) {
  return (
    <Link to={`/o/${ootd.id}`} state={buildSwipeState(ids, index, 'outfit')} className="ootd-card">
      {outfitCardPhoto(ootd)
        ? <CardImage src={outfitCardPhoto(ootd)} />
        : <div className="ootd-card-empty">◇</div>}
    </Link>
  );
}

function FeedEmpty({ t, kind, followingMode, isLoggedIn, hasFollows, onSignIn, onSwitchScope }) {
  const isBoards = kind === 'boards';
  // Following mode has its own messaging — "you don't follow anyone yet"
  // is very different from "the global feed is empty".
  if (followingMode) {
    if (!isLoggedIn) {
      return (
        <div className="feed-empty">
          <div className="feed-empty-mark">◇</div>
          <h2 className="feed-empty-title">{t('feedFollowingSignInTitle')}</h2>
          <p className="feed-empty-body">{t('feedFollowingSignInBody')}</p>
          <button type="button" className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
        </div>
      );
    }
    if (!hasFollows) {
      return (
        <div className="feed-empty">
          <div className="feed-empty-mark">◇</div>
          <h2 className="feed-empty-title">{t('feedFollowingEmptyTitle')}</h2>
          <p className="feed-empty-body">{t('feedFollowingEmptyBody')}</p>
          <button type="button" className="btn btn-secondary" onClick={onSwitchScope}>{t('feedScopeForYou')}</button>
        </div>
      );
    }
    // Signed in, follows people, but nothing matched — they just haven't posted yet.
    return (
      <div className="feed-empty">
        <div className="feed-empty-mark">◇</div>
        <h2 className="feed-empty-title">{t('feedFollowingQuietTitle')}</h2>
        <p className="feed-empty-body">{t('feedFollowingQuietBody')}</p>
      </div>
    );
  }
  if (kind === 'market') {
    return (
      <div className="feed-empty">
        <div className="feed-empty-mark">◇</div>
        <h2 className="feed-empty-title">{t('marketplaceTitle')}</h2>
        <p className="feed-empty-body">{t('marketplaceEmpty')}</p>
      </div>
    );
  }
  return (
    <div className="feed-empty">
      <div className="feed-empty-mark">◇</div>
      <h2 className="feed-empty-title">{isBoards ? t('feedBoardsEmptyTitle') : t('feedEmptyTitle')}</h2>
      <p className="feed-empty-body">{isBoards ? t('feedBoardsEmptyBody') : t('feedEmptyBody')}</p>
    </div>
  );
}

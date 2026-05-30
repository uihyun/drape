import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { OutfitService } from '../services/outfit-service.js';
import { BoardService } from '../services/board-service.js';
import { FollowService, FOLLOWING_FEED_LIMIT } from '../services/follow-service.js';
import { MarketplaceService } from '../services/marketplace-service.js';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import { outfitCardPhoto } from '../utils/outfitPhoto.js';
import { ListingCard } from './Marketplace.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

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
  const [ootds, setOotds] = useState(null);
  const [boards, setBoards] = useState(null);
  const [listings, setListings] = useState(null);
  // null = not yet loaded, [] = signed in but follows nobody.
  const [followingIds, setFollowingIds] = useState(null);
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

  useEffect(() => {
    if (kind !== 'ootds') return;
    setOotds(null);
    if (isFollowingScope) {
      // Wait for followingIds to resolve so we don't fire an empty query.
      if (followingIds === null) return;
      OutfitService.listFollowingFeed({ followingIds, pageSize: 24 })
        .then(rows => setOotds(rows))
        .catch(err => {
          console.warn('following ootd query failed:', err?.code, err?.message);
          setOotds([]);
        });
      return;
    }
    OutfitService.listPublicFeed({ pageSize: 24, sortBy: sort })
      .then(({ ootds }) => setOotds(ootds))
      .catch((err) => {
        console.warn('ootd feed query failed:', err?.code, err?.message);
        setOotds([]);
      });
  }, [sort, kind, isFollowingScope, followingIds]);

  useEffect(() => {
    if (kind !== 'boards') return;
    setBoards(null);
    if (isFollowingScope) {
      if (followingIds === null) return;
      BoardService.listFollowingBoards({ followingIds, pageSize: 24 })
        .then(rows => setBoards(rows))
        .catch(err => {
          console.warn('following boards query failed:', err?.code, err?.message);
          setBoards([]);
        });
      return;
    }
    BoardService.listPublicBoards({ pageSize: 24, sortBy: sort })
      .then(rows => setBoards(rows))
      .catch((err) => {
        console.warn('boards feed query failed:', err?.code, err?.message);
        setBoards([]);
      });
  }, [kind, sort, isFollowingScope, followingIds]);

  useEffect(() => {
    if (kind !== 'market') return;
    setListings(null);
    if (isFollowingScope) {
      if (followingIds === null) return; // wait for ids
      MarketplaceService.listBySellers({ sellerIds: followingIds, pageSize: 30 })
        .then(setListings)
        .catch(err => {
          console.warn('market following query failed:', err?.code, err?.message);
          setListings([]);
        });
      return;
    }
    MarketplaceService.listRecent({ pageSize: 30 })
      .then(res => setListings(res.listings))
      .catch(err => {
        console.warn('market feed query failed:', err?.code, err?.message);
        setListings([]);
      });
  }, [kind, isFollowingScope, followingIds]);

  // (Feed cards no longer show an author chip, so there's no author
  // hydration here — it was dead work that re-rendered the whole list.)

  const showingBoards = kind === 'boards';
  const showingMarket = kind === 'market';
  const list = showingMarket ? listings : showingBoards ? boards : ootds;

  const setKindAnd = (k) => setKind(k);

  return (
    <div className="community-feed">
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
      ) : showingMarket ? (
        <div className="marketplace-grid feed-market-grid">
          {listings.map(it => <ListingCard key={it.id} item={it} t={t} />)}
        </div>
      ) : showingBoards ? (
        <div className="board-feed">
          {boards.map(b => (
            <BoardCard key={b.id} board={b} />
          ))}
        </div>
      ) : (
        <div className="ootd-feed">
          {ootds.map(o => (
            <OotdCard key={o.id} ootd={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardCard({ board }) {
  return (
    <Link to={`/boards/${board.id}`} className="board-feed-card">
      <BoardThumbnail board={board} className="board-feed-thumb" />
    </Link>
  );
}

function OotdCard({ ootd }) {
  return (
    <Link to={`/o/${ootd.id}`} className="ootd-card">
      {outfitCardPhoto(ootd)
        ? <img src={outfitCardPhoto(ootd)} alt="" loading="lazy" referrerPolicy="no-referrer" />
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

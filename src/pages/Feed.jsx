import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Heart, Bookmark } from 'lucide-react';
import { db } from '../firebase.js';
import { Users } from 'lucide-react';
import { OotdService } from '../services/ootd-service.js';
import { BoardService } from '../services/board-service.js';
import { FollowService, FOLLOWING_FEED_LIMIT } from '../services/follow-service.js';
import { MarketplaceService } from '../services/marketplace-service.js';
import { ProfileService } from '../services/profile-service.js';
import { Avatar } from '../components/Avatar.jsx';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import { ListingCard } from './Marketplace.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Discovery — published OOTDs from every user, newest first. Each
// card is a full-bleed OOTD photo with the author chip + title
// overlay on the bottom (Lekondo capture 1 read). Tapping opens
// /ootd/:id for the editorial breakdown.
export function Feed({ user, onSignIn }) {
  const { t } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const [scope, setScope] = useState('forYou'); // 'forYou' | 'following'
  const VALID_KINDS = new Set(['ootds', 'boards', 'market']);
  const rawKind = searchParams.get('kind');
  const [kind, setKind] = useState(VALID_KINDS.has(rawKind) ? rawKind : 'ootds');
  const [ootds, setOotds] = useState(null);
  const [boards, setBoards] = useState(null);
  const [listings, setListings] = useState(null);
  const [authorMap, setAuthorMap] = useState(new Map());
  const [sort, setSort] = useState('latest');
  // null = not yet loaded, [] = signed in but follows nobody. Used by
  // both kinds, so we resolve once per user change.
  const [followingIds, setFollowingIds] = useState(null);
  // Market is a public catalogue — the Following filter doesn't apply to
  // it. Treat it as For-You-only.
  const isFollowingScope = scope === 'following' && kind !== 'market';
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
      OotdService.listFollowingFeed({ followingIds, pageSize: 24 })
        .then(rows => setOotds(rows))
        .catch(err => {
          console.warn('following ootd query failed:', err?.code, err?.message);
          setOotds([]);
        });
      return;
    }
    OotdService.listPublicFeed({ pageSize: 24, sortBy: sort })
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
    MarketplaceService.listRecent({ pageSize: 30 })
      .then(res => setListings(res.listings))
      .catch(err => {
        console.warn('market feed query failed:', err?.code, err?.message);
        setListings([]);
      });
  }, [kind]);

  // Hydrate author profiles for whichever feed is showing.
  useEffect(() => {
    const rows = kind === 'ootds' ? ootds : kind === 'boards' ? boards : null;
    if (!rows?.length) return;
    const missing = rows.map(r => r.userId).filter(uid => uid && !authorMap.has(uid));
    if (!missing.length) return;
    ProfileService.getProfilesByUids?.(missing).then(map => {
      if (!map || map.size === 0) return;
      setAuthorMap(prev => {
        const next = new Map(prev);
        map.forEach((p, uid) => next.set(uid, p));
        return next;
      });
    }).catch(() => {});
  }, [ootds, boards, kind, authorMap]);

  const showingBoards = kind === 'boards';
  const showingMarket = kind === 'market';
  const list = showingMarket ? listings : showingBoards ? boards : ootds;
  // Following toggle only applies to OOTDs/Boards; market is global.
  const canFollow = kind !== 'market';

  const setKindAnd = (k) => {
    setKind(k);
    setSearchParams(p => { p.set('kind', k); return p; }, { replace: true });
    if (k === 'market') setScope('forYou'); // market has no following view
  };

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
              it just narrows the current kind to people you follow. */}
          {canFollow && (
            <button
              type="button"
              className={`feed-following-toggle${isFollowingScope ? ' active' : ''}`}
              aria-pressed={isFollowingScope}
              onClick={() => setScope(isFollowingScope ? 'forYou' : 'following')}
            >
              <Users size={15} strokeWidth={1.8} />
              {t('feedScopeFollowing')}
            </button>
          )}
        </div>
        {/* Sort only for the chronological/popular content kinds in the
            For-You scope. Hidden for market + following. */}
        {canFollow && !isFollowingScope && (
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
            <BoardCard
              key={b.id}
              board={b}
              author={authorMap.get(b.userId)}
              user={user}
              onSignIn={onSignIn}
              onLikeChange={(patch) => setBoards(prev => prev.map(x => x.id === b.id ? { ...x, ...patch } : x))}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="ootd-feed">
          {ootds.map(o => (
            <OotdCard
              key={o.id}
              ootd={o}
              author={authorMap.get(o.userId)}
              user={user}
              onLikeChange={(patch) => setOotds(prev => prev.map(x => x.id === o.id ? { ...x, ...patch } : x))}
              onSignIn={onSignIn}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardCard({ board, author, user, onLikeChange, onSignIn, t }) {
  const liked = !!(user && Array.isArray(board.likedBy) && board.likedBy.includes(user.uid));
  const [bookmarked, setBookmarked] = useState(false);
  useEffect(() => {
    if (!user || user.isAnonymous) { setBookmarked(false); return; }
    return onSnapshot(
      doc(db, 'users', user.uid, 'bookmarks', board.id),
      (s) => setBookmarked(s.exists()),
      () => setBookmarked(false),
    );
  }, [user?.uid, board.id]);

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || user.isAnonymous) { onSignIn?.(); return; }
    const nextLiked = !liked;
    const nextLikedBy = nextLiked
      ? [...(board.likedBy || []), user.uid]
      : (board.likedBy || []).filter(u => u !== user.uid);
    const nextCount = Math.max(0, (board.likeCount || 0) + (nextLiked ? 1 : -1));
    onLikeChange?.({ likedBy: nextLikedBy, likeCount: nextCount });
    try {
      await BoardService.toggleLike(board.id, user.uid, liked);
    } catch (err) {
      console.warn('board like failed:', err.message);
      onLikeChange?.({ likedBy: board.likedBy || [], likeCount: board.likeCount || 0 });
    }
  };

  const handleBookmark = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || user.isAnonymous) { onSignIn?.(); return; }
    const prev = bookmarked;
    setBookmarked(!prev); // optimistic
    try { await BoardService.toggleBookmark(board.id, prev); }
    catch (err) { console.warn('board bookmark failed:', err.message); setBookmarked(prev); }
  };

  return (
    <Link to={`/boards/${board.id}`} className="board-feed-card">
      <BoardThumbnail board={board} className="board-feed-thumb" />
      <div className="board-feed-card-overlay">
        <div className="board-feed-card-author">
          <Avatar src={author?.photoURL} name={author?.handle} size={28} />
          <span className="board-feed-card-handle">@{author?.handle || '—'}</span>
        </div>
        {board.name && <h3 className="board-feed-card-title">{board.name}</h3>}
      </div>
    </Link>
  );
}

function OotdCard({ ootd, author, user, onLikeChange, onSignIn, t }) {
  const liked = !!(user && Array.isArray(ootd.likedBy) && ootd.likedBy.includes(user.uid));
  // Bookmark state — read from the viewer's own /users/<uid>/bookmarks
  // (the OOTD doc has no bookmark info per viewer). Light onSnapshot
  // so it stays correct when the user bookmarks elsewhere too.
  const [bookmarked, setBookmarked] = useState(false);
  useEffect(() => {
    if (!user || user.isAnonymous) { setBookmarked(false); return; }
    return onSnapshot(
      doc(db, 'users', user.uid, 'bookmarks', ootd.id),
      (s) => setBookmarked(s.exists()),
      () => setBookmarked(false),
    );
  }, [user?.uid, ootd.id]);

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || user.isAnonymous) { onSignIn?.(); return; }
    const nextLiked = !liked;
    const nextLikedBy = nextLiked
      ? [...(ootd.likedBy || []), user.uid]
      : (ootd.likedBy || []).filter(u => u !== user.uid);
    const nextCount = Math.max(0, (ootd.likeCount || 0) + (nextLiked ? 1 : -1));
    onLikeChange?.({ likedBy: nextLikedBy, likeCount: nextCount });
    try {
      await OotdService.toggleLike(ootd.id, user.uid, liked);
    } catch (err) {
      console.warn('like failed', err.message);
      onLikeChange?.({ likedBy: ootd.likedBy || [], likeCount: ootd.likeCount || 0 });
    }
  };

  const handleBookmark = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || user.isAnonymous) { onSignIn?.(); return; }
    const prev = bookmarked;
    setBookmarked(!prev); // optimistic
    try {
      await OotdService.toggleBookmark(ootd.id, prev);
    } catch (err) {
      console.warn('bookmark failed', err.message);
      setBookmarked(prev);
    }
  };

  return (
    <Link to={`/ootd/${ootd.id}`} className="ootd-card">
      {ootd.photoUrl
        ? <img src={ootd.photoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        : <div className="ootd-card-empty">◇</div>}
      <div className="ootd-card-overlay">
        <div className="ootd-card-author">
          <Avatar
            src={author?.photoURL}
            name={author?.handle}
            size={28}
            className="ootd-card-avatar"
          />
          <span className="ootd-card-handle">@{author?.handle || '—'}</span>
        </div>
        {ootd.title && <h3 className="ootd-card-title">{ootd.title}</h3>}
      </div>
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

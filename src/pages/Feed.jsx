import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Heart, Bookmark } from 'lucide-react';
import { db } from '../firebase.js';
import { Users } from 'lucide-react';
import { OutfitService } from '../services/outfit-service.js';
import { BoardService } from '../services/board-service.js';
import { FollowService, FOLLOWING_FEED_LIMIT } from '../services/follow-service.js';
import { MarketplaceService } from '../services/marketplace-service.js';
import { ProfileService } from '../services/profile-service.js';
import { Avatar } from '../components/Avatar.jsx';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import { CardQuickActions } from '../components/CardQuickActions.jsx';
import { useLongPressQuickActions } from '../hooks/useLongPressQuickActions.js';
import { outfitCardPhoto } from '../utils/outfitPhoto.js';
import { ListingCard } from './Marketplace.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// After an optimistic like patch, the popular feed must re-order so the
// just-liked card moves to its new rank (the list is a one-shot query, not
// live — without this the count changes but the position doesn't). Mirrors
// the server sort: likeCount desc, then date desc as a stable tiebreak.
// Latest feed keeps its fetched order untouched.
function resortByLikes(list, sort) {
  if (sort !== 'popular') return list;
  return [...list].sort((a, b) =>
    (b.likeCount || 0) - (a.likeCount || 0)
    || String(b.date || '').localeCompare(String(a.date || '')));
}

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
  // Following narrows every kind (OOTDs / Boards / Market) to people you
  // follow, for consistency across the feed tabs.
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

  const setKindAnd = (k) => {
    setKind(k);
    setSearchParams(p => { p.set('kind', k); return p; }, { replace: true });
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
            <BoardCard
              key={b.id}
              board={b}
              author={authorMap.get(b.userId)}
              user={user}
              onSignIn={onSignIn}
              onLikeChange={(patch) => setBoards(prev => resortByLikes(
                prev.map(x => x.id === b.id ? { ...x, ...patch } : x), sort,
              ))}
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
              onLikeChange={(patch) => setOotds(prev => resortByLikes(
                prev.map(x => x.id === o.id ? { ...x, ...patch } : x), sort,
              ))}
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
  const isOwner = !!(user && board.userId === user.uid);
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

  const handleLike = async () => {
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

  const handleBookmark = async () => {
    if (!user || user.isAnonymous) { onSignIn?.(); return; }
    const prev = bookmarked;
    setBookmarked(!prev); // optimistic
    try { await BoardService.toggleBookmark(board.id, prev); }
    catch (err) { console.warn('board bookmark failed:', err.message); setBookmarked(prev); }
  };

  // No self-like/save — owners get no quick actions on their own board.
  const quickActions = isOwner ? [] : [
    { key: 'like', icon: <Heart size={22} strokeWidth={2} fill={liked ? 'currentColor' : 'none'} /> },
    { key: 'save', icon: <Bookmark size={22} strokeWidth={2} fill={bookmarked ? 'currentColor' : 'none'} /> },
  ];
  const lp = useLongPressQuickActions({
    actions: quickActions,
    onFire: (key) => { if (key === 'like') handleLike(); else if (key === 'save') handleBookmark(); },
  });

  return (
    <Link
      to={`/boards/${board.id}`}
      className={`board-feed-card${lp.active ? ' is-pressed' : ''}`}
      {...lp.bind}
    >
      <BoardThumbnail board={board} className="board-feed-thumb" />
      {lp.active && (
        <CardQuickActions
          actions={quickActions}
          focusedKey={lp.focusedKey}
          registerButton={lp.registerButton}
        />
      )}
    </Link>
  );
}

function OotdCard({ ootd, author, user, onLikeChange, onSignIn, t }) {
  const isOwner = !!(user && ootd.userId === user.uid);
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

  const handleLike = async () => {
    if (!user || user.isAnonymous) { onSignIn?.(); return; }
    const nextLiked = !liked;
    const nextLikedBy = nextLiked
      ? [...(ootd.likedBy || []), user.uid]
      : (ootd.likedBy || []).filter(u => u !== user.uid);
    const nextCount = Math.max(0, (ootd.likeCount || 0) + (nextLiked ? 1 : -1));
    onLikeChange?.({ likedBy: nextLikedBy, likeCount: nextCount });
    try {
      await OutfitService.toggleLike(ootd.id, user.uid, liked);
    } catch (err) {
      console.warn('like failed', err.message);
      onLikeChange?.({ likedBy: ootd.likedBy || [], likeCount: ootd.likeCount || 0 });
    }
  };

  const handleBookmark = async () => {
    if (!user || user.isAnonymous) { onSignIn?.(); return; }
    const prev = bookmarked;
    setBookmarked(!prev); // optimistic
    try {
      await OutfitService.toggleBookmark(ootd.id, prev);
    } catch (err) {
      console.warn('bookmark failed', err.message);
      setBookmarked(prev);
    }
  };

  // No self-like/save — owners get no quick actions on their own post.
  const quickActions = isOwner ? [] : [
    { key: 'like', icon: <Heart size={22} strokeWidth={2} fill={liked ? 'currentColor' : 'none'} /> },
    { key: 'save', icon: <Bookmark size={22} strokeWidth={2} fill={bookmarked ? 'currentColor' : 'none'} /> },
  ];
  const lp = useLongPressQuickActions({
    actions: quickActions,
    onFire: (key) => { if (key === 'like') handleLike(); else if (key === 'save') handleBookmark(); },
  });

  return (
    <Link
      to={`/o/${ootd.id}`}
      className={`ootd-card${lp.active ? ' is-pressed' : ''}`}
      {...lp.bind}
    >
      {outfitCardPhoto(ootd)
        ? <img src={outfitCardPhoto(ootd)} alt="" loading="lazy" referrerPolicy="no-referrer" />
        : <div className="ootd-card-empty">◇</div>}
      {lp.active && (
        <CardQuickActions
          actions={quickActions}
          focusedKey={lp.focusedKey}
          registerButton={lp.registerButton}
        />
      )}
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

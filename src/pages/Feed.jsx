import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Heart, Bookmark } from 'lucide-react';
import { db } from '../firebase.js';
import { OotdService } from '../services/ootd-service.js';
import { BoardService } from '../services/board-service.js';
import { ProfileService } from '../services/profile-service.js';
import { Avatar } from '../components/Avatar.jsx';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Discovery — published OOTDs from every user, newest first. Each
// card is a full-bleed OOTD photo with the author chip + title
// overlay on the bottom (Lekondo capture 1 read). Tapping opens
// /ootd/:id for the editorial breakdown.
export function Feed({ user, onSignIn }) {
  const { t } = useLocale();
  const [kind, setKind] = useState('ootds'); // 'ootds' | 'boards'
  const [ootds, setOotds] = useState(null);
  const [boards, setBoards] = useState(null);
  const [authorMap, setAuthorMap] = useState(new Map());
  const [sort, setSort] = useState('latest');

  useEffect(() => {
    if (kind !== 'ootds') return;
    setOotds(null);
    OotdService.listPublicFeed({ pageSize: 24, sortBy: sort })
      .then(({ ootds }) => setOotds(ootds))
      .catch((err) => {
        console.warn('ootd feed query failed:', err?.code, err?.message);
        setOotds([]);
      });
  }, [sort, kind]);

  useEffect(() => {
    if (kind !== 'boards') return;
    setBoards(null);
    BoardService.listPublicBoards({ pageSize: 24 })
      .then(rows => setBoards(rows))
      .catch((err) => {
        console.warn('boards feed query failed:', err?.code, err?.message);
        setBoards([]);
      });
  }, [kind]);

  // Hydrate author profiles for whichever feed is showing.
  useEffect(() => {
    const rows = kind === 'ootds' ? ootds : boards;
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
  const list = showingBoards ? boards : ootds;

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
              onClick={() => setKind('ootds')}
            >
              {t('feedKindOotds')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'boards'}
              className={`feed-kind-tab${kind === 'boards' ? ' active' : ''}`}
              onClick={() => setKind('boards')}
            >
              {t('feedKindBoards')}
            </button>
          </nav>
          {!showingBoards && (
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
        </div>
      </header>

      {list === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : list.length === 0 ? (
        <FeedEmpty t={t} kind={kind} />
      ) : showingBoards ? (
        <div className="board-feed">
          {boards.map(b => (
            <BoardCard key={b.id} board={b} author={authorMap.get(b.userId)} t={t} />
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

function BoardCard({ board, author, t }) {
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
      <div className="ootd-card-actions">
        <button
          type="button"
          className={`ootd-card-action${liked ? ' active' : ''}`}
          onClick={handleLike}
          aria-label={liked ? t('unlike') : t('like')}
        >
          <Heart size={18} strokeWidth={1.6} fill={liked ? 'currentColor' : 'none'} />
          {(ootd.likeCount || 0) > 0 && <span>{ootd.likeCount}</span>}
        </button>
        <button
          type="button"
          className={`ootd-card-action${bookmarked ? ' active' : ''}`}
          onClick={handleBookmark}
          aria-label={bookmarked ? t('unbookmark') : t('bookmark')}
        >
          <Bookmark size={18} strokeWidth={1.6} fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>
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

function FeedEmpty({ t, kind }) {
  const isBoards = kind === 'boards';
  return (
    <div className="feed-empty">
      <div className="feed-empty-mark">◇</div>
      <h2 className="feed-empty-title">{isBoards ? t('feedBoardsEmptyTitle') : t('feedEmptyTitle')}</h2>
      <p className="feed-empty-body">{isBoards ? t('feedBoardsEmptyBody') : t('feedEmptyBody')}</p>
    </div>
  );
}

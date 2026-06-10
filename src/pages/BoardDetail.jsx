import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Edit3, Eye, EyeOff, Heart, Bookmark, Flag } from 'lucide-react';
import { db } from '../firebase.js';
import { BoardService } from '../services/board-service.js';
import { ProfileService } from '../services/profile-service.js';
import { Avatar } from '../components/Avatar.jsx';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import { ReportModal } from '../components/ReportModal.jsx';
import { ShareButton } from '../components/ShareButton.jsx';
import { Comments } from '../components/Comments.jsx';
import { SwipeHint } from '../components/SwipeHint.jsx';
import { useSwipeNavigate } from '../hooks/useSwipeNavigate.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Read-only board view at /b/:boardId. Anyone can hit this URL but
// the underlying read only succeeds if the board is public OR they're
// the owner. Composition rendered via the shared BoardThumbnail.
// Owner sees the OOTD-style "Publish to Feed" / "Unlist" eye button.
export function BoardDetail({ user, onSignIn }) {
  const { t } = useLocale();
  const { boardId } = useParams();
  const navigate = useNavigate();
  const swipe = useSwipeNavigate();
  const [board, setBoard] = useState(undefined); // undefined=loading, null=not-found
  const [author, setAuthor] = useState(null);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [reporting, setReporting] = useState(false);

  // Live subscription — needed so the Like button reflects realtime
  // count changes (someone else's like flips the heart immediately).
  // togglePublic also stops needing an explicit refresh because the
  // snapshot streams the updated isPublic back.
  useEffect(() => {
    if (!boardId) return;
    return onSnapshot(
      doc(db, 'boards', boardId),
      (snap) => setBoard(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setBoard(null),
    );
  }, [boardId]);

  useEffect(() => {
    if (!board?.userId) return;
    ProfileService.getByUid(board.userId).then(setAuthor).catch(() => setAuthor(null));
  }, [board?.userId]);

  // Hydrate items used on the board (so we can show the same
  // "items on this board" row that the editor shows owners).
  useEffect(() => {
    const ids = Array.from(new Set((board?.stickers || []).map(s => s.itemId).filter(Boolean)));
    if (!ids.length) { setItems([]); return; }
    let cancelled = false;
    Promise.all(
      ids.map(id => getDoc(doc(db, 'items', id))
        .then(s => s.exists() ? { id: s.id, ...s.data() } : null)
        .catch(() => null))
    ).then(rows => { if (!cancelled) setItems(rows.filter(Boolean)); });
    return () => { cancelled = true; };
  }, [board?.id, (board?.stickers || []).length]);

  // Bookmark state for non-owners
  useEffect(() => {
    if (!user || user.isAnonymous || !boardId) { setBookmarked(false); return; }
    return onSnapshot(
      doc(db, 'users', user.uid, 'bookmarks', boardId),
      s => setBookmarked(s.exists()),
      () => setBookmarked(false),
    );
  }, [user?.uid, boardId]);

  if (board === undefined) return <div className="loading"><div className="spinner" /></div>;
  if (board === null) {
    return (
      <div className="page">
        <div className="empty-state empty-state-card">
          <p>{t('boardNotFound')}</p>
          <Link to="/feed" className="btn btn-secondary">{t('feedTitle')}</Link>
        </div>
      </div>
    );
  }

  const itemsById = Object.fromEntries(items.map(i => [i.id, i]));
  const isOwner = user && board.userId === user.uid;

  const togglePublic = async () => {
    if (!isOwner || busy) return;
    setBusy(true);
    try {
      await BoardService.updateBoard(board.id, { isPublic: !board.isPublic });
    } finally { setBusy(false); }
  };

  return (
    <div className="page board-detail">
      <div className="board-detail-hero-wrap" {...swipe.bind} style={swipe.style}>
        <BoardThumbnail board={board} itemsById={itemsById} className="board-detail-hero" />
      </div>
      {swipe.swipeable && <SwipeHint />}
      {reporting && (
        <ReportModal target={{ type: 'board', id: board.id }} user={user} onClose={() => setReporting(false)} />
      )}

      <header className="outfit-byline">
        <Link
          to={author?.handle ? `/u/${author.handle}` : '#'}
          className="outfit-byline-author"
          onClick={(e) => { if (!author?.handle) e.preventDefault(); }}
        >
          <Avatar
            src={author?.photoURL}
            name={author?.displayName || author?.handle}
            size={32}
            className="outfit-byline-avatar"
          />
          <span className="outfit-byline-handle">{author?.handle ? `@${author.handle}` : ''}</span>
        </Link>
        {isOwner && (
          <Link to={`/boards/${board.id}/edit`} className="btn-edit">
            <Edit3 size={14} strokeWidth={1.6} /> {t('edit')}
          </Link>
        )}
      </header>

      {board.name && <h1 className="board-detail-title">{board.name}</h1>}

      {/* Same asymmetric action bar as outfit detail: wide primary +
          compact icon row. */}
      <div className="outfit-actions">
        {isOwner && (
          <button
            type="button"
            className={`outfit-action-primary${board.isPublic ? ' is-unlist' : ''}`}
            onClick={togglePublic}
            disabled={busy}
          >
            {board.isPublic ? <EyeOff size={17} strokeWidth={1.7} /> : <Eye size={17} strokeWidth={1.7} />}
            {board.isPublic ? t('unlist') : t('publishToFeed')}
          </button>
        )}
        <div className="outfit-action-row">
          {!isOwner && (
            <button
              type="button"
              className={`outfit-action-icon${(board.likedBy || []).includes(user?.uid) ? ' is-liked' : ''}`}
              aria-label={t('like')}
              onClick={async () => {
                if (!user || user.isAnonymous) { onSignIn?.(); return; }
                try { await BoardService.toggleLike(board.id, user.uid, (board.likedBy || []).includes(user.uid)); }
                catch (err) { console.warn('board like failed', err?.message); }
              }}
            >
              <Heart size={18} strokeWidth={1.7} fill={(board.likedBy || []).includes(user?.uid) ? 'currentColor' : 'none'} />
              {(board.likeCount || 0) > 0 && <span className="outfit-action-count">{board.likeCount}</span>}
            </button>
          )}
          {!isOwner && (
            <button
              type="button"
              className={`outfit-action-icon${bookmarked ? ' is-saved' : ''}`}
              aria-label={t('save')}
              onClick={async () => {
                if (!user || user.isAnonymous) { onSignIn?.(); return; }
                try { await BoardService.toggleBookmark(board.id, bookmarked); }
                catch (err) { console.warn('board bookmark failed', err?.message); }
              }}
            >
              <Bookmark size={18} strokeWidth={1.7} fill={bookmarked ? 'currentColor' : 'none'} />
            </button>
          )}
          <ShareButton
            className="outfit-action-icon"
            title={board.name || t('untitledBoard')}
            text=""
            url={`${typeof window !== 'undefined' ? window.location.origin : ''}/boards/${board.id}`}
            label=""
          />
          {!isOwner && (
            <button
              type="button"
              className="outfit-action-icon"
              aria-label={t('report')}
              onClick={() => { if (!user || user.isAnonymous) { onSignIn?.(); return; } setReporting(true); }}
            >
              <Flag size={17} strokeWidth={1.7} />
            </button>
          )}
        </div>
      </div>

      <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
      <Comments parentColl="boards" parentId={board.id} ownerId={board.userId} user={user} onSignInRequest={onSignIn} />

      {items.length > 0 && (
        <section className="board-items">
          <div className="board-items-head">
            <h3>{t('boardItemsHead')}</h3>
          </div>
          <div className="board-items-grid">
            {items.map(it => {
              const cover = it.croppedUrl || it.originalUrl;
              return (
                <Link key={it.id} to={`/i/${it.id}`} className="item-card">
                  <div className="item-card-image">
                    {cover
                      ? <img src={cover} alt={it.name || ''} loading="lazy" />
                      : <div className="item-card-skeleton" />}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default BoardDetail;

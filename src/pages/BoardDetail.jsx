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
import { useLocale } from '../hooks/useLocale.jsx';

// Read-only board view at /b/:boardId. Anyone can hit this URL but
// the underlying read only succeeds if the board is public OR they're
// the owner. Composition rendered via the shared BoardThumbnail.
// Owner sees the OOTD-style "Publish to Feed" / "Unlist" eye button.
export function BoardDetail({ user, onSignIn }) {
  const { t } = useLocale();
  const { boardId } = useParams();
  const navigate = useNavigate();
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
      <div className="board-detail-hero-wrap">
        <BoardThumbnail board={board} itemsById={itemsById} className="board-detail-hero" />
        {/* Overlay actions — inside image, z-index 1000 so they're above all board stickers */}
        <div className="board-detail-hero-actions">
          {isOwner ? (
            <button
              type="button"
              className={`board-hero-action${board.selfLiked ? ' active' : ''}`}
              onClick={async () => {
                try { await BoardService.toggleSelfLike(board.id, !board.selfLiked); }
                catch (e) { console.warn('toggleSelfLike failed', e?.message); }
              }}
            >
              <Heart size={16} strokeWidth={1.6} fill={board.selfLiked ? 'currentColor' : 'none'} />
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`board-hero-action${(board.likedBy || []).includes(user?.uid) ? ' active' : ''}`}
                onClick={async () => {
                  if (!user || user.isAnonymous) { onSignIn?.(); return; }
                  try { await BoardService.toggleLike(board.id, user.uid, (board.likedBy || []).includes(user.uid)); }
                  catch (err) { console.warn('board like failed', err?.message); }
                }}
              >
                <Heart size={16} strokeWidth={1.6} fill={(board.likedBy || []).includes(user?.uid) ? 'currentColor' : 'none'} />
                {(board.likeCount || 0) > 0 && <span className="board-hero-count">{board.likeCount}</span>}
              </button>
              <button
                type="button"
                className={`board-hero-action${bookmarked ? ' active' : ''}`}
                onClick={async () => {
                  if (!user || user.isAnonymous) { onSignIn?.(); return; }
                  try { await BoardService.toggleBookmark(board.id, bookmarked); }
                  catch (err) { console.warn('board bookmark failed', err?.message); }
                }}
              >
                <Bookmark size={16} strokeWidth={1.6} fill={bookmarked ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                className="board-hero-action"
                onClick={() => { if (!user || user.isAnonymous) { onSignIn?.(); return; } setReporting(true); }}
              >
                <Flag size={15} strokeWidth={1.6} />
              </button>
            </>
          )}
        </div>
      </div>
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
          <button type="button" className="btn-edit" onClick={togglePublic} disabled={busy}>
            {board.isPublic ? <EyeOff size={14} strokeWidth={1.6} /> : <Eye size={14} strokeWidth={1.6} />}
            {board.isPublic ? t('unlist') : t('publishToFeed')}
          </button>
        )}
      </header>

      {board.name && <h1 className="board-detail-title">{board.name}</h1>}

      <div className="controls" style={{ padding: '0 1rem' }}>
        {!isOwner && (
          <BoardLikeButton board={board} user={user} onSignIn={onSignIn} t={t} />
        )}
        <ShareButton
          className="btn btn-secondary"
          title={board.name || t('untitledBoard')}
          text=""
          url={`${typeof window !== 'undefined' ? window.location.origin : ''}/boards/${board.id}`}
        />
        {isOwner && (
          <Link to={`/boards/${board.id}/edit`} className="btn btn-secondary">
            <Edit3 size={14} strokeWidth={1.7} /> {t('edit')}
          </Link>
        )}
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

function BoardLikeButton({ board, user, onSignIn, t }) {
  const liked = !!(user && Array.isArray(board.likedBy) && board.likedBy.includes(user.uid));
  const count = board.likeCount || 0;
  const onClick = async () => {
    if (!user || user.isAnonymous) { onSignIn?.(); return; }
    try {
      await BoardService.toggleLike(board.id, user.uid, liked);
    } catch (err) {
      console.warn('board like failed:', err.message);
    }
  };
  return (
    <button
      type="button"
      className={`btn btn-secondary${liked ? ' is-liked' : ''}`}
      onClick={onClick}
      aria-pressed={liked}
    >
      <Heart size={14} strokeWidth={1.6} fill={liked ? 'currentColor' : 'none'} />
      {count > 0 ? count : t('like')}
    </button>
  );
}

export default BoardDetail;

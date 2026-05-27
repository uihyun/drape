import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Edit3, Eye, EyeOff } from 'lucide-react';
import { db } from '../firebase.js';
import { BoardService } from '../services/board-service.js';
import { ProfileService } from '../services/profile-service.js';
import { Avatar } from '../components/Avatar.jsx';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Read-only board view at /b/:boardId. Anyone can hit this URL but
// the underlying read only succeeds if the board is public OR they're
// the owner. Composition rendered via the shared BoardThumbnail.
// Owner sees the OOTD-style "Publish to Feed" / "Unlist" eye button.
export function BoardDetail({ user }) {
  const { t } = useLocale();
  const { boardId } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState(undefined); // undefined=loading, null=not-found
  const [author, setAuthor] = useState(null);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    if (!boardId) return;
    BoardService.getBoard(boardId)
      .then(b => setBoard(b || null))
      .catch(() => setBoard(null));
  };

  useEffect(refresh, [boardId]);

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
      refresh();
    } finally { setBusy(false); }
  };

  return (
    <div className="page board-detail">
      <BoardThumbnail board={board} itemsById={itemsById} className="board-detail-hero" />

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

      {isOwner && (
        <Link to={`/boards/${board.id}/edit`} className="btn btn-secondary board-detail-edit">
          <Edit3 size={14} strokeWidth={1.7} /> {t('edit')}
        </Link>
      )}

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
                  {it.name && <span className="item-card-name">{it.name}</span>}
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

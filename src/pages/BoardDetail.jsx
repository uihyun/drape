import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Edit3 } from 'lucide-react';
import { db } from '../firebase.js';
import { BoardService } from '../services/board-service.js';
import { ProfileService } from '../services/profile-service.js';
import { Avatar } from '../components/Avatar.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

const CANVAS_RATIO = 3 / 4;

// Read-only board view at /b/:boardId. Anyone can hit this URL but
// the underlying read only succeeds if the board is public OR they're
// the owner. Stickers rendered without drag handles or selection state.
export function BoardDetail({ user }) {
  const { t } = useLocale();
  const { boardId } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState(undefined); // undefined=loading, null=not-found
  const [author, setAuthor] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!boardId) return;
    BoardService.getBoard(boardId)
      .then(b => setBoard(b || null))
      .catch(() => setBoard(null));
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

  return (
    <div className="page board-detail">
      <header className="board-detail-head">
        <Link to={author?.handle ? `/u/${author.handle}` : '#'} className="board-detail-author">
          <Avatar src={author?.photoURL} name={author?.handle} size={32} />
          <span className="board-detail-handle">@{author?.handle || '—'}</span>
        </Link>
        {isOwner && (
          <Link to={`/boards/${board.id}`} className="btn btn-secondary board-detail-edit">
            <Edit3 size={14} strokeWidth={1.7} /> {t('edit')}
          </Link>
        )}
      </header>

      {board.name && <h1 className="board-detail-title">{board.name}</h1>}

      <div className="board-canvas board-canvas-readonly" style={{ aspectRatio: `${CANVAS_RATIO}` }}>
        {(board.stickers || []).map((s, idx) => {
          const item = itemsById[s.itemId];
          if (!item) return null;
          const cover = item.croppedUrl || item.originalUrl;
          return (
            <div
              key={`${s.itemId}-${idx}`}
              className="board-sticker board-sticker-readonly"
              style={{
                left: `${s.x * 100}%`,
                top: `${s.y * 100}%`,
                transform: `translate(-50%, -50%) scale(${s.scale}) rotate(${s.rotation || 0}deg)`,
                zIndex: s.z || 1,
              }}
            >
              {cover && <img src={cover} alt={item.name || ''} draggable={false} referrerPolicy="no-referrer" />}
            </div>
          );
        })}
      </div>

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

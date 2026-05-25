import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { BoardService } from '../services/board-service.js';
import { ItemService } from '../services/item-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// "My boards" — grid of sticker-board cover thumbnails. Embedded in the
// Profile shell's Boards tab, or standalone at /boards.
export function BoardList({ user, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const [boards, setBoards] = useState(null);
  const [items, setItems] = useState([]);
  const itemsById = useMemo(
    () => Object.fromEntries(items.map(i => [i.id, i])),
    [items],
  );

  useEffect(() => {
    if (!user || user.isAnonymous) { setBoards([]); return; }
    return BoardService.subscribeMyBoards(setBoards);
  }, [user]);

  // Closet items power the mini-canvas thumbnails (each sticker references
  // an itemId, and the card preview needs the cropped image).
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    return ItemService.subscribeMyCloset(user.uid, setItems);
  }, [user]);

  if (!user || user.isAnonymous) {
    return (
      <div className={embedded ? '' : 'page'}>
        {!embedded && <h1 className="page-h1">{t('boards')}</h1>}
        <div className="empty-state empty-state-card">
          <p>{t('boardSignInBody')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
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

      {boards === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : boards.length === 0 ? (
        <div className="empty-state empty-state-card">
          <p>{t('boardsEmpty')}</p>
          <Link to="/boards/new" className="btn btn-primary">
            <Plus size={14} strokeWidth={1.8} /> {t('boardNew')}
          </Link>
        </div>
      ) : (
        <div className="board-list-grid">
          {boards.map(b => (
            <Link key={b.id} to={`/boards/${b.id}`} className="board-card">
              <BoardThumb board={b} itemsById={itemsById} />
              <div className="board-card-meta">
                <span>{b.name || t('untitledBoard')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Mini-canvas thumbnail: replays the stickers at their stored 0..1
// coordinates so the card matches what the editor shows, just shrunk.
// The container's aspect-ratio mirrors the editor canvas (3/4 portrait).
function BoardThumb({ board, itemsById }) {
  const stickers = Array.isArray(board.stickers) ? board.stickers : [];
  // Render in z-order so the topmost sticker actually sits on top.
  const sorted = [...stickers].sort((a, b) => (a.z || 0) - (b.z || 0));
  if (sorted.length === 0) {
    return <div className="board-card-cover"><div className="board-card-cover-empty">◇</div></div>;
  }
  return (
    <div className="board-card-cover board-card-canvas">
      {sorted.map((s, i) => {
        const item = itemsById[s.itemId];
        const cover = item?.croppedUrl || item?.originalUrl;
        if (!cover) return null;
        return (
          <div
            key={`${s.itemId}-${i}`}
            className="board-card-sticker"
            style={{
              left: `${(s.x || 0.5) * 100}%`,
              top: `${(s.y || 0.5) * 100}%`,
              transform: `translate(-50%, -50%) scale(${s.scale || 0.35}) rotate(${s.rotation || 0}deg)`,
              zIndex: s.z || 1,
            }}
          >
            <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false} />
          </div>
        );
      })}
    </div>
  );
}

export default BoardList;

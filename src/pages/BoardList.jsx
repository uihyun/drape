import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { BoardService } from '../services/board-service.js';
import { ItemService } from '../services/item-service.js';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
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
              <BoardThumbnail board={b} itemsById={itemsById} />
              <div className="board-card-meta">
                <span className="card-meta-name">{b.name || t('untitledBoard')}</span>
                <span className="card-meta-date">{formatCardDate(b.createdAt || b.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCardDate(ts) {
  const d = ts?.toDate?.() || (ts instanceof Date ? ts : null);
  return d ? d.toLocaleDateString() : '';
}

export default BoardList;

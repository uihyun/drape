import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { BoardService } from '../services/board-service.js';
import { ItemService } from '../services/item-service.js';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import { usePinchColumns } from '../hooks/usePinchColumns.js';
import { useLocale } from '../hooks/useLocale.jsx';

// "My boards" with a Saved tab for boards the user has bookmarked
// from other profiles. Same Mine/Saved shape as OutfitList so the
// profile shell's Boards tab reads consistently.
export function BoardList({ user, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const { cols, ref: gridRef } = usePinchColumns('boards', { min: 1, max: 3, def: 2 });
  const [tab, setTab] = useState('mine'); // 'mine' | 'saved'
  const [mine, setMine] = useState(null);
  const [saved, setSaved] = useState(null);
  const [items, setItems] = useState([]);
  const itemsById = useMemo(
    () => Object.fromEntries(items.map(i => [i.id, i])),
    [items],
  );

  useEffect(() => {
    if (!user || user.isAnonymous) { setMine([]); return; }
    return BoardService.subscribeMyBoards(setMine);
  }, [user]);

  useEffect(() => {
    if (!user || user.isAnonymous) { setSaved([]); return; }
    if (tab !== 'saved') return; // lazy — only fetch when the tab opens
    BoardService.listBookmarkedBoards({ uid: user.uid })
      .then(setSaved)
      .catch(() => setSaved([]));
  }, [user, tab]);

  // Closet items power the mini-canvas thumbnails (each sticker references
  // an itemId, and the card preview needs the cropped image). Only used
  // for the user's own boards — saved boards from other users hydrate
  // their items individually via BoardThumbnail's self-hydration.
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
          <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
        </div>
      </div>
    );
  }

  const list = tab === 'saved' ? saved : mine;

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

      <nav className="filter-chips filter-chips--text" role="tablist" style={{ marginBottom: '0.75rem' }}>
        {['mine', 'saved'].map(key => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`chip${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >
            {t(`boardsTabs.${key}`)}
          </button>
        ))}
      </nav>

      {list === null ? (
        <div className="loading"><div className="spinner" /></div>
      ) : list.length === 0 ? (
        <div className="empty-state empty-state-card">
          {tab === 'mine' ? (
            <>
              <p>{t('boardsEmpty')}</p>
              <Link to="/boards/new" className="btn btn-primary">
                <Plus size={14} strokeWidth={1.8} /> {t('boardNew')}
              </Link>
            </>
          ) : (
            <>
              <p>{t('savedBoardsEmpty')}</p>
              <Link to="/feed" className="btn btn-secondary">{t('browseFeed')}</Link>
            </>
          )}
        </div>
      ) : (
        <div
          ref={gridRef}
          className="board-list-grid pinch-grid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {list.map(b => (
            <Link key={b.id} to={`/boards/${b.id}`} className="board-card">
              <BoardThumbnail board={b} itemsById={tab === 'mine' ? itemsById : undefined} />
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

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { BoardService } from '../services/board-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// "My boards" — grid of sticker-board cover thumbnails.
export function BoardList({ user, onSignIn }) {
  const { t } = useLocale();
  const [boards, setBoards] = useState(null);

  useEffect(() => {
    if (!user || user.isAnonymous) { setBoards([]); return; }
    return BoardService.subscribeMyBoards(setBoards);
  }, [user]);

  if (!user || user.isAnonymous) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('boards')}</h1>
        <div className="empty-state empty-state-card">
          <p>{t('boardSignInBody')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="closet-header">
        <h1 className="page-h1" style={{ margin: 0 }}>{t('boards')}</h1>
        <Link to="/boards/new" className="btn btn-primary">
          <Plus size={14} strokeWidth={1.8} /> {t('boardNew')}
        </Link>
      </div>

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
              <div className="board-card-cover">
                {b.coverUrl
                  ? <img src={b.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  : <div className="board-card-cover-empty">◇</div>}
              </div>
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

export default BoardList;

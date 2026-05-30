import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { SlidersHorizontal } from 'lucide-react';
import { db } from '../firebase.js';
import { BoardService } from '../services/board-service.js';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import { LookFilterSheet } from '../components/LookFilterSheet.jsx';
import { emptyLookFilters, countLookFilters, boardMatches } from '../data/lookFilters.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Profile "Boards" tab — grid of the user's mood boards. Tapping a
// board opens it; the + tile starts a new board. Same tag-filter as the
// outfit list, matching boards by the tags of the closet items they pin.
export function BoardList({ user, onSignIn, embedded }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [boards, setBoards] = useState(null);
  const [itemsById, setItemsById] = useState({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState(emptyLookFilters());

  useEffect(() => {
    if (!user || user.isAnonymous) { setBoards([]); return; }
    return BoardService.subscribeMyBoards(setBoards);
  }, [user]);

  // Hydrate the closet items pinned across all boards so the filter can
  // match a board by what's on it. Only fetches ids we don't already have.
  useEffect(() => {
    const ids = Array.from(new Set(
      (boards || []).flatMap(b => (b.stickers || []).map(s => s.itemId)).filter(Boolean)
    ));
    const missing = ids.filter(id => !itemsById[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map(id => getDoc(doc(db, 'items', id))
      .then(s => (s.exists() ? { id: s.id, ...s.data() } : null))
      .catch(() => null)))
      .then(rows => {
        if (cancelled) return;
        setItemsById(prev => {
          const next = { ...prev };
          rows.forEach(r => { if (r) next[r.id] = r; });
          return next;
        });
      });
    return () => { cancelled = true; };
  }, [boards]);

  const filterCount = countLookFilters(filters);
  const filtered = useMemo(() => {
    if (!boards) return null;
    if (filterCount === 0) return boards;
    return boards.filter(b => boardMatches(b, itemsById, filters));
  }, [boards, itemsById, filters, filterCount]);

  if (boards === null) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  return (
    <div className={`board-list${embedded ? ' board-list-embedded' : ''}`}>
      <div className="outfit-list-toolbar" style={{ justifyContent: 'flex-end' }}>
        <button
          type="button"
          className={`icon-pill${filterCount > 0 ? ' active' : ''}`}
          onClick={() => setFilterOpen(true)}
          aria-label={t('filterTitle')}
        >
          <SlidersHorizontal size={18} strokeWidth={1.7} />
          {filterCount > 0 && <span className="icon-pill-badge">{filterCount}</span>}
        </button>
      </div>

      <div className="board-list-grid">
        {filterCount === 0 && (
          <button
            type="button"
            className="board-new-tile"
            onClick={() => navigate('/boards/new')}
            aria-label={t('newBoard')}
          >
            <span className="board-new-plus">+</span>
            <span>{t('newBoard')}</span>
          </button>
        )}
        {(filtered || []).map(b => (
          <BoardThumbnail
            key={b.id}
            board={b}
            onClick={() => navigate(`/boards/${b.id}`)}
          />
        ))}
      </div>

      {filterCount > 0 && filtered.length === 0 && (
        <div className="empty-state empty-state-card">
          <p>{t('noBoardMatch')}</p>
        </div>
      )}

      <LookFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        counts={null}
      />
    </div>
  );
}

export default BoardList;

import { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, Check, SlidersHorizontal } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { BoardService } from '../services/board-service.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { scoreMatch } from '../utils/itemMatch.js';
import { CATEGORIES } from '../services/taxonomy.js';
import { LookFilterSheet, emptyLookFilters, countLookFilters, itemMatchesFilters } from './LookFilterSheet.jsx';
import { SORT_OPTIONS, sortItems } from '../utils/itemSort.js';

// Link ONE item you already own to one detected piece of an outfit
// (owner, 2026-10-09) — from the closet, or from a board's items. Opened by a
// piece row's "Link" button on the outfit page itself, so nobody has to find
// the separate link page. Sort & filter is the SAME sheet and the same sort
// options as the profile closet (one icon, up front), showing only the values
// that exist in what's being browsed, plus "Best match" for this piece. Opens
// filtered to the piece's category.
export function PieceLinkSheet({ user, piece, currentId = null, onSave, onClose }) {
  const { t } = useLocale();
  const [tab, setTab] = useState('closet');
  const [closet, setCloset] = useState(null);
  const [boards, setBoards] = useState(null);
  const [board, setBoard] = useState(null);       // a board opened in the Boards tab
  const [picked, setPicked] = useState(currentId);
  const [saving, setSaving] = useState(false);
  const startFilters = () => ({
    ...emptyLookFilters(),
    category: piece.category && CATEGORIES.includes(piece.category) ? [piece.category] : [],
  });
  const [filters, setFilters] = useState(startFilters);
  const [sort, setSort] = useState('match');
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterCount = countLookFilters(filters);
  const toggleDim = (key, value) => setFilters((prev) => {
    const cur = prev[key] || [];
    return { ...prev, [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] };
  });

  useEffect(() => ItemService.subscribeMyCloset(user.uid, (list) => (
    setCloset(list.filter((i) => i.status === 'ready' && !i.isArchived))
  ), { pageSize: 500 }), [user.uid]);

  useEffect(() => {
    if (tab !== 'boards' || boards) return;
    BoardService.listMyBoards({ pageSize: 40 }).then((b) => setBoards(b || [])).catch(() => setBoards([]));
  }, [tab, boards]);

  const byId = useMemo(() => Object.fromEntries((closet || []).map((i) => [i.id, i])), [closet]);
  const shape = (list) => {
    const out = filterCount > 0 ? list.filter((i) => itemMatchesFilters(i, filters)) : [...list];
    if (sort === 'match') {
      const sc = new Map(out.map((i) => [i.id, scoreMatch(piece, i)]));
      return out.sort((a, b) => sc.get(b.id) - sc.get(a.id));
    }
    return sortItems(out, sort);
  };
  const closetShown = useMemo(() => shape(closet || []), [closet, filters, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const boardPool = board
    ? [...new Set((board.stickers || []).map((s) => s.itemId))].map((id) => byId[id]).filter(Boolean)
    : [];
  const boardItems = shape(boardPool);
  // The sheet only offers values that exist in what's being browsed.
  const pool = tab === 'boards' && board ? boardPool : (closet || []);
  const available = useMemo(() => {
    const a = { styles: new Set(), category: new Set(), subcategory: new Set(), colors: new Set(), seasons: new Set(), fits: new Set() };
    for (const i of pool) {
      const tg = i.tags || {};
      (tg.styles || []).forEach((v) => a.styles.add(v));
      if (tg.category) a.category.add(tg.category);
      if (tg.subcategory) a.subcategory.add(tg.subcategory);
      (tg.colors || []).forEach((v) => a.colors.add(v));
      (tg.seasons || []).forEach((v) => a.seasons.add(v));
      if (tg.fit) a.fits.add(tg.fit);
    }
    return a;
  }, [pool]);
  const resultCount = (tab === 'boards' && board ? boardItems : closetShown).length;

  const save = async () => {
    if (!picked || saving) return;
    setSaving(true);
    try { await onSave(picked); onClose(); }
    catch (e) { console.warn('piece link failed', e?.message); setSaving(false); }
  };

  const grid = (list) => (
    list.length === 0
      ? <p className="plink-empty">{t('pieceLinkEmpty')}</p>
      : (
        <div className="plink-grid">
          {list.map((i) => (
            <button
              key={i.id}
              type="button"
              className={`plink-item${picked === i.id ? ' on' : ''}`}
              onClick={() => setPicked(picked === i.id ? null : i.id)}
              aria-pressed={picked === i.id}
            >
              <img src={i.croppedUrl || i.originalUrl} alt={i.name || ''} loading="lazy" />
              {picked === i.id && <span className="plink-check"><Check size={14} strokeWidth={2.6} /></span>}
            </button>
          ))}
        </div>
      )
  );

  return (
    <div className="create-sheet-overlay" onClick={onClose}>
      <div className="create-sheet plink-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="create-sheet-close" onClick={onClose} aria-label={t('close')}>
          <X size={18} />
        </button>
        <h3 className="create-sheet-title">{t('pieceLinkTitle', { piece: piece.name || t(`taxonomy.categories.${piece.category}`) })}</h3>
        <div className="plink-top">
        <nav className="plink-tabs" role="tablist">
          {['closet', 'boards'].map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k}
              className={`plink-tab${tab === k ? ' on' : ''}`}
              onClick={() => { setTab(k); setBoard(null); setFilters(startFilters()); }}>
              {t(k === 'closet' ? 'linkFromCloset' : 'linkFromBoard')}
            </button>
          ))}
        </nav>
          {(tab === 'closet' || board) && (
            <button
              type="button"
              className={`closet-search-btn${filterCount > 0 ? ' has-filters' : ''}`}
              aria-label={t('sortAndFilter')}
              onClick={() => setSheetOpen(true)}
            >
              <SlidersHorizontal size={18} strokeWidth={1.7} />
              {filterCount > 0 && <span className="closet-filter-badge">{filterCount}</span>}
            </button>
          )}
        </div>
        <div className="plink-body">
          {tab === 'closet' && (closet === null ? <div className="spinner" /> : grid(closetShown))}
          {tab === 'boards' && !board && (boards === null ? <div className="spinner" /> : (
            boards.length === 0 ? <p className="plink-empty">{t('pieceLinkNoBoards')}</p> : (
              <ul className="plink-boards">
                {boards.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => { setBoard(b); setFilters(emptyLookFilters()); }}>
                      <span>{b.name || t('untitledBoard')}</span>
                      <span className="plink-boardcount">{(b.stickers || []).length}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ))}
          {tab === 'boards' && board && (
            <>
              <button type="button" className="plink-back" onClick={() => setBoard(null)}>
                <ChevronLeft size={15} /> {board.name || t('untitledBoard')}
              </button>
              {grid(boardItems)}
            </>
          )}
        </div>
        {sheetOpen && (
          <LookFilterSheet
            filters={filters}
            onToggle={toggleDim}
            onClear={() => { setFilters(emptyLookFilters()); setSort('match'); }}
            onClose={() => setSheetOpen(false)}
            count={filterCount}
            resultCount={resultCount}
            sortValue={sort}
            onSortChange={setSort}
            sortOptions={[{ value: 'match', labelKey: 'plinkSortMatch' }, ...SORT_OPTIONS]}
            available={available}
          />
        )}
        <button type="button" className="btn btn-primary plink-save" onClick={save} disabled={!picked || saving}>
          {t('save')}
        </button>
      </div>
    </div>
  );
}

export default PieceLinkSheet;

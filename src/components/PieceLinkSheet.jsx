import { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, Check } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { BoardService } from '../services/board-service.js';
import { useLocale } from '../hooks/useLocale.jsx';
import { scoreMatch } from '../utils/itemMatch.js';
import { CATEGORIES, COLORS, COLOR_HEX } from '../services/taxonomy.js';

// Link ONE item you already own to one detected piece of an outfit
// (owner, 2026-10-09) — from the closet, or from a board's items. Opened by a
// piece row's "Link" button on the outfit page itself, so nobody has to find
// the separate link page. Opens filtered to the piece's category and sorted
// by best match; category, colour and sort are all changeable (a 60-item
// closet unfiltered is a wall).
export function PieceLinkSheet({ user, piece, currentId = null, onSave, onClose }) {
  const { t } = useLocale();
  const [tab, setTab] = useState('closet');
  const [closet, setCloset] = useState(null);
  const [boards, setBoards] = useState(null);
  const [board, setBoard] = useState(null);       // a board opened in the Boards tab
  const [picked, setPicked] = useState(currentId);
  const [saving, setSaving] = useState(false);
  const [cat, setCat] = useState(piece.category && CATEGORIES.includes(piece.category) ? piece.category : 'all');
  const [color, setColor] = useState('all');
  const [sort, setSort] = useState('match');   // 'match' | 'newest'

  useEffect(() => ItemService.subscribeMyCloset(user.uid, (list) => (
    setCloset(list.filter((i) => i.status === 'ready' && !i.isArchived))
  ), { pageSize: 500 }), [user.uid]);

  useEffect(() => {
    if (tab !== 'boards' || boards) return;
    BoardService.listMyBoards({ pageSize: 40 }).then((b) => setBoards(b || [])).catch(() => setBoards([]));
  }, [tab, boards]);

  const byId = useMemo(() => Object.fromEntries((closet || []).map((i) => [i.id, i])), [closet]);
  const shape = (list) => {
    const out = list.filter((i) => {
      const tg = i.tags || {};
      if (cat !== 'all' && tg.category !== cat) return false;
      if (color !== 'all' && !(tg.colors || []).includes(color)) return false;
      return true;
    });
    if (sort === 'match') {
      const sc = new Map(out.map((i) => [i.id, scoreMatch(piece, i)]));
      out.sort((a, b) => sc.get(b.id) - sc.get(a.id));
    } else {
      const ms = (i) => i.createdAt?.toMillis?.() || 0;
      out.sort((a, b) => ms(b) - ms(a));
    }
    return out;
  };
  const closetShown = useMemo(() => shape(closet || []), [closet, cat, color, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const boardItems = board
    ? shape([...new Set((board.stickers || []).map((s) => s.itemId))].map((id) => byId[id]).filter(Boolean))
    : [];
  // Only offer the categories / colours that exist in what's being browsed.
  const pool = tab === 'boards' && board
    ? [...new Set((board.stickers || []).map((s) => s.itemId))].map((id) => byId[id]).filter(Boolean)
    : (closet || []);
  const cats = CATEGORIES.filter((c) => pool.some((i) => i.tags?.category === c));
  const colors = COLORS.filter((c) => pool.some((i) => (i.tags?.colors || []).includes(c)));

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
        <nav className="plink-tabs" role="tablist">
          {['closet', 'boards'].map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k}
              className={`plink-tab${tab === k ? ' on' : ''}`}
              onClick={() => { setTab(k); setBoard(null); setCat('all'); setColor('all'); }}>
              {t(k === 'closet' ? 'linkFromCloset' : 'linkFromBoard')}
            </button>
          ))}
        </nav>
        {(tab === 'closet' || board) && (
          <div className="plink-filters">
            <div className="plink-chips">
              {['all', ...cats].map((c) => (
                <button key={c} type="button" className={`plink-chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>
                  {c === 'all' ? t('filterAll') : t(`taxonomy.categories.${c}`)}
                </button>
              ))}
            </div>
            <div className="plink-chips">
              {['all', ...colors].map((c) => (
                <button key={c} type="button" className={`plink-chip${color === c ? ' on' : ''}`} onClick={() => setColor(c)}
                  aria-label={c === 'all' ? t('filterAll') : t(`taxonomy.colors.${c}`)}>
                  {c === 'all' ? t('filterAll') : <><i className="plink-dot" style={{ background: COLOR_HEX[c] || '#ccc' }} />{t(`taxonomy.colors.${c}`)}</>}
                </button>
              ))}
            </div>
            <div className="plink-sort" role="radiogroup">
              {['match', 'newest'].map((k) => (
                <button key={k} type="button" role="radio" aria-checked={sort === k}
                  className={`plink-sortbtn${sort === k ? ' on' : ''}`} onClick={() => setSort(k)}>
                  {t(k === 'match' ? 'plinkSortMatch' : 'sortNewest')}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="plink-body">
          {tab === 'closet' && (closet === null ? <div className="spinner" /> : grid(closetShown))}
          {tab === 'boards' && !board && (boards === null ? <div className="spinner" /> : (
            boards.length === 0 ? <p className="plink-empty">{t('pieceLinkNoBoards')}</p> : (
              <ul className="plink-boards">
                {boards.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => { setBoard(b); setCat('all'); setColor('all'); }}>
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
        <button type="button" className="btn btn-primary plink-save" onClick={save} disabled={!picked || saving}>
          {t('save')}
        </button>
      </div>
    </div>
  );
}

export default PieceLinkSheet;

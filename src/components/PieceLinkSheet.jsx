import { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, Check } from 'lucide-react';
import { ItemService } from '../services/item-service.js';
import { BoardService } from '../services/board-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Link ONE item you already own to one detected piece of an outfit
// (owner, 2026-10-09) — from the closet, or from a board's items. Opened by a
// piece row's "Link" button on the outfit page itself, so nobody has to find
// the separate link page. Same-category pieces come first.
export function PieceLinkSheet({ user, piece, currentId = null, onSave, onClose }) {
  const { t } = useLocale();
  const [tab, setTab] = useState('closet');
  const [closet, setCloset] = useState(null);
  const [boards, setBoards] = useState(null);
  const [board, setBoard] = useState(null);       // a board opened in the Boards tab
  const [picked, setPicked] = useState(currentId);
  const [saving, setSaving] = useState(false);

  useEffect(() => ItemService.subscribeMyCloset(user.uid, (list) => (
    setCloset(list.filter((i) => i.status === 'ready' && !i.isArchived))
  ), { pageSize: 500 }), [user.uid]);

  useEffect(() => {
    if (tab !== 'boards' || boards) return;
    BoardService.listMyBoards({ pageSize: 40 }).then((b) => setBoards(b || [])).catch(() => setBoards([]));
  }, [tab, boards]);

  const byId = useMemo(() => Object.fromEntries((closet || []).map((i) => [i.id, i])), [closet]);
  const rank = (i) => {
    const tg = i.tags || {};
    if (piece.subcategory && tg.subcategory === piece.subcategory) return 0;
    if (piece.category && tg.category === piece.category) return 1;
    return 2;
  };
  const closetSorted = useMemo(() => [...(closet || [])].sort((a, b) => rank(a) - rank(b)), [closet]); // eslint-disable-line react-hooks/exhaustive-deps
  const boardItems = board
    ? [...new Set((board.stickers || []).map((s) => s.itemId))].map((id) => byId[id]).filter(Boolean).sort((a, b) => rank(a) - rank(b))
    : [];

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
              className={`plink-item${picked === i.id ? ' on' : ''}${rank(i) < 2 ? ' same' : ''}`}
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
              onClick={() => { setTab(k); setBoard(null); }}>
              {t(k === 'closet' ? 'linkFromCloset' : 'linkFromBoard')}
            </button>
          ))}
        </nav>
        <div className="plink-body">
          {tab === 'closet' && (closet === null ? <div className="spinner" /> : grid(closetSorted))}
          {tab === 'boards' && !board && (boards === null ? <div className="spinner" /> : (
            boards.length === 0 ? <p className="plink-empty">{t('pieceLinkNoBoards')}</p> : (
              <ul className="plink-boards">
                {boards.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => setBoard(b)}>
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

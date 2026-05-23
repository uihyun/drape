import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, Sparkles, Eye, Calendar as CalIcon, Check, X } from 'lucide-react';
import { BoardService } from '../services/board-service.js';
import { ItemService } from '../services/item-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Diary-style sticker board. Pick items from the closet, drop them on
// the canvas, drag/scale/rotate, save. Long-press a sticker for the
// context menu (item detail / try-on / wear history).
//
// Coordinates are stored in 0..1 board-relative space so the board
// renders identically at any canvas size; the cover thumbnail uses the
// stored stickers + a stable canvas ratio.
const CANVAS_RATIO = 3 / 4; // portrait
const PRESS_HOLD_MS = 450;

export function BoardEditor({ user, onSignIn }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { boardId } = useParams();
  const isNew = !boardId;

  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [stickers, setStickers] = useState([]); // { itemId, x, y, scale, rotation, z }
  const [selectedSticker, setSelectedSticker] = useState(null); // index
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // index for long-press menu
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(isNew);

  // Closet items keyed by id for fast lookup while rendering stickers.
  const itemsById = useMemo(
    () => Object.fromEntries(items.map(i => [i.id, i])),
    [items],
  );

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    return ItemService.subscribeMyCloset(user.uid, list => {
      setItems(list.filter(i => i.status === 'ready' && !i.isArchived));
    });
  }, [user]);

  // Load existing board if editing.
  useEffect(() => {
    if (isNew) return;
    BoardService.getBoard(boardId).then(b => {
      if (b) {
        setName(b.name || '');
        setStickers(Array.isArray(b.stickers) ? b.stickers : []);
      }
      setLoaded(true);
    });
  }, [boardId, isNew]);

  if (!user || user.isAnonymous) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('boardEditorTitle')}</h1>
        <div className="empty-state empty-state-card">
          <p>{t('boardSignInBody')}</p>
          <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const addStickers = (itemIds) => {
    const next = [...stickers];
    let z = next.reduce((m, s) => Math.max(m, s.z || 0), 0);
    for (const id of itemIds) {
      z += 1;
      // Center-ish, with a tiny offset per addition so they don't pile.
      const offset = 0.04 * next.filter(s => s.itemId === id).length;
      next.push({
        itemId: id,
        x: 0.5 + offset,
        y: 0.5 + offset,
        scale: 0.35,
        rotation: 0,
        z,
      });
    }
    setStickers(next);
    setPickerOpen(false);
  };

  const removeSticker = (idx) => {
    setStickers(prev => prev.filter((_, i) => i !== idx));
    setSelectedSticker(null);
    setMenuFor(null);
  };

  const onStickerChange = (idx, patch) => {
    setStickers(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const bringToFront = (idx) => {
    setStickers(prev => {
      const maxZ = prev.reduce((m, s) => Math.max(m, s.z || 0), 0);
      return prev.map((s, i) => i === idx ? { ...s, z: maxZ + 1 } : s);
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Cover: the topmost sticker's image makes a decent thumbnail.
      const top = [...stickers].sort((a, b) => (b.z || 0) - (a.z || 0))[0];
      const coverItem = top ? itemsById[top.itemId] : null;
      const coverUrl = coverItem?.croppedUrl || coverItem?.originalUrl || null;
      if (isNew) {
        const { id } = await BoardService.createBoard({ name: name.trim(), stickers, coverUrl });
        navigate(`/boards/${id}`, { replace: true });
      } else {
        await BoardService.updateBoard(boardId, { name: name.trim(), stickers, coverUrl });
        navigate(`/boards`);
      }
    } catch (e) {
      console.warn('save board failed', e?.message);
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (isNew) { navigate('/boards'); return; }
    if (!confirm(t('confirmDeleteBoard'))) return;
    await BoardService.deleteBoard(boardId);
    navigate('/boards');
  };

  return (
    <div className="page board-editor">
      <h1 className="page-h1">{isNew ? t('boardEditorNew') : t('boardEditorEdit')}</h1>

      <input
        className="page-input"
        placeholder={t('boardNamePlaceholder')}
        value={name}
        onChange={e => setName(e.target.value)}
        maxLength={80}
      />

      <BoardCanvas
        stickers={stickers}
        itemsById={itemsById}
        selectedSticker={selectedSticker}
        setSelectedSticker={setSelectedSticker}
        onStickerChange={onStickerChange}
        onLongPress={(idx) => setMenuFor(idx)}
        onBringToFront={bringToFront}
        t={t}
      />

      <div className="board-toolbar">
        <button type="button" className="btn btn-secondary" onClick={() => setPickerOpen(true)}>
          <Plus size={16} strokeWidth={1.8} /> {t('boardAddItems')}
        </button>
        {selectedSticker !== null && (
          <button
            type="button"
            className="btn btn-secondary danger-btn"
            onClick={() => removeSticker(selectedSticker)}
          >
            <Trash2 size={16} strokeWidth={1.6} /> {t('remove')}
          </button>
        )}
        {!isNew && (
          <button type="button" className="btn btn-secondary danger-btn" onClick={remove}>
            <Trash2 size={16} strokeWidth={1.6} /> {t('delete')}
          </button>
        )}
      </div>

      <div className="builder-cta">
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? t('saving') : t('boardSave')}
        </button>
      </div>

      {pickerOpen && (
        <ItemPickerSheet
          items={items}
          onPick={addStickers}
          onClose={() => setPickerOpen(false)}
          t={t}
        />
      )}

      {menuFor !== null && stickers[menuFor] && (
        <StickerMenu
          sticker={stickers[menuFor]}
          item={itemsById[stickers[menuFor].itemId]}
          onClose={() => setMenuFor(null)}
          onRemove={() => removeSticker(menuFor)}
          t={t}
        />
      )}
    </div>
  );
}

function BoardCanvas({
  stickers,
  itemsById,
  selectedSticker,
  setSelectedSticker,
  onStickerChange,
  onLongPress,
  onBringToFront,
  t,
}) {
  const canvasRef = useRef(null);
  const dragState = useRef(null);

  const onPointerDown = (e, idx) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedSticker(idx);
    onBringToFront(idx);
    const sticker = stickers[idx];
    dragState.current = {
      idx,
      startX: e.clientX,
      startY: e.clientY,
      origX: sticker.x,
      origY: sticker.y,
      rect,
      moved: false,
      pressTimer: setTimeout(() => {
        if (!dragState.current?.moved) onLongPress?.(idx);
      }, PRESS_HOLD_MS),
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const onPointerMove = (e) => {
    const ds = dragState.current;
    if (!ds) return;
    const dx = (e.clientX - ds.startX) / ds.rect.width;
    const dy = (e.clientY - ds.startY) / ds.rect.height;
    if (Math.abs(dx) + Math.abs(dy) > 0.005) {
      ds.moved = true;
      clearTimeout(ds.pressTimer);
    }
    onStickerChange(ds.idx, {
      x: Math.max(0.05, Math.min(0.95, ds.origX + dx)),
      y: Math.max(0.05, Math.min(0.95, ds.origY + dy)),
    });
  };

  const onPointerUp = (e) => {
    const ds = dragState.current;
    if (!ds) return;
    clearTimeout(ds.pressTimer);
    dragState.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  return (
    <div
      ref={canvasRef}
      className="board-canvas"
      style={{ aspectRatio: `${CANVAS_RATIO}` }}
      onClick={() => setSelectedSticker(null)}
    >
      {stickers.length === 0 && (
        <div className="board-canvas-empty">{t('boardCanvasEmpty')}</div>
      )}
      {stickers.map((s, idx) => {
        const item = itemsById[s.itemId];
        if (!item) return null;
        const cover = item.croppedUrl || item.originalUrl;
        const isSelected = selectedSticker === idx;
        return (
          <div
            key={`${s.itemId}-${idx}`}
            className={`board-sticker${isSelected ? ' selected' : ''}`}
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              transform: `translate(-50%, -50%) scale(${s.scale}) rotate(${s.rotation || 0}deg)`,
              zIndex: s.z || 1,
            }}
            onPointerDown={(e) => onPointerDown(e, idx)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {cover && (
              <img
                src={cover}
                alt={item.name || ''}
                draggable={false}
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        );
      })}

      {selectedSticker !== null && stickers[selectedSticker] && (
        <StickerControls
          sticker={stickers[selectedSticker]}
          onChange={(patch) => onStickerChange(selectedSticker, patch)}
        />
      )}
    </div>
  );
}

function StickerControls({ sticker, onChange }) {
  return (
    <div className="board-sticker-ctl" onClick={e => e.stopPropagation()}>
      <label>
        <span>S</span>
        <input
          type="range"
          min={0.15} max={1.2} step={0.01}
          value={sticker.scale}
          onChange={e => onChange({ scale: parseFloat(e.target.value) })}
        />
      </label>
      <label>
        <span>R</span>
        <input
          type="range"
          min={-180} max={180} step={1}
          value={sticker.rotation || 0}
          onChange={e => onChange({ rotation: parseInt(e.target.value, 10) })}
        />
      </label>
    </div>
  );
}

function ItemPickerSheet({ items, onPick, onClose, t }) {
  const [picked, setPicked] = useState(new Set());
  const toggle = (id) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  return (
    <div className="create-sheet-overlay" onClick={onClose}>
      <div className="create-sheet board-picker" onClick={e => e.stopPropagation()}>
        <div className="create-sheet-handle" />
        <button type="button" className="create-sheet-close" onClick={onClose} aria-label={t('close')}>
          <X size={18} />
        </button>
        <h3 className="create-sheet-title">{t('boardAddItems')}</h3>

        {items.length === 0 ? (
          <p className="muted" style={{ padding: '0.5rem 0' }}>{t('outfitBuilderEmpty')}</p>
        ) : (
          <div className="board-picker-grid">
            {items.map(it => {
              const sel = picked.has(it.id);
              const cover = it.croppedUrl || it.originalUrl;
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`item-card builder-pickable ${sel ? 'selected' : ''}`}
                  onClick={() => toggle(it.id)}
                >
                  <div className="item-card-image">
                    {cover
                      ? <img src={cover} alt="" loading="lazy" />
                      : <div className="item-card-skeleton" />}
                    {sel && (
                      <span className="item-card-check">
                        <Check size={14} strokeWidth={2.4} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: '0.75rem', width: '100%' }}
          disabled={picked.size === 0}
          onClick={() => onPick(Array.from(picked))}
        >
          {t('add')} {picked.size > 0 ? `· ${picked.size}` : ''}
        </button>
      </div>
    </div>
  );
}

function StickerMenu({ sticker, item, onClose, onRemove, t }) {
  if (!item) return null;
  return (
    <div className="create-sheet-overlay" onClick={onClose}>
      <div className="create-sheet sticker-menu" onClick={e => e.stopPropagation()}>
        <div className="create-sheet-handle" />
        <h3 className="create-sheet-title">{item.name || t('untitledItem')}</h3>
        <Link to={`/i/${item.id}`} className="create-sheet-row" onClick={onClose}>
          <span className="create-sheet-icon"><Eye size={18} strokeWidth={1.6} /></span>
          <span className="create-sheet-label">{t('viewItem')}</span>
        </Link>
        <Link to={`/tryon?items=${item.id}`} className="create-sheet-row" onClick={onClose}>
          <span className="create-sheet-icon"><Sparkles size={18} strokeWidth={1.6} /></span>
          <span className="create-sheet-label">{t('tryThisOn')}</span>
        </Link>
        {Array.isArray(item.wearLog) && item.wearLog.length > 0 && (
          <div className="create-sheet-row" style={{ cursor: 'default' }}>
            <span className="create-sheet-icon"><CalIcon size={18} strokeWidth={1.6} /></span>
            <span className="create-sheet-label">
              {t('lastWorn')}: {item.wearLog[0].date}
            </span>
          </div>
        )}
        <button type="button" className="create-sheet-row" onClick={() => { onRemove(); onClose(); }}>
          <span className="create-sheet-icon"><Trash2 size={18} strokeWidth={1.6} /></span>
          <span className="create-sheet-label">{t('removeFromBoard')}</span>
        </button>
      </div>
    </div>
  );
}

export default BoardEditor;

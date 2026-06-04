import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, Sparkles, Eye, Calendar as CalIcon, Check, X, AlertTriangle } from 'lucide-react';
import { BoardService } from '../services/board-service.js';
import { ItemService } from '../services/item-service.js';
import { BOARD_BACKGROUNDS, boardBgStyle, DEFAULT_BOARD_BG, BOARD_RATIOS, boardRatioCss, DEFAULT_BOARD_RATIO } from '../data/boardBackgrounds.js';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
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
  const [background, setBackground] = useState(DEFAULT_BOARD_BG);
  const [ratio, setRatio] = useState(DEFAULT_BOARD_RATIO);
  const [isPublic, setIsPublic] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState(null); // index
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // index for long-press menu
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(isNew);
  // Per-item selection (separate from "selected sticker on canvas" which
  // is only for drag/edit). Drives the Try-on action below.
  const [tryonSelected, setTryonSelected] = useState(new Set());

  // Closet items keyed by id for fast lookup while rendering stickers.
  const itemsById = useMemo(
    () => Object.fromEntries(items.map(i => [i.id, i])),
    [items],
  );

  // De-duplicated list of items used on this board (in sticker z-order
  // so the visual on the canvas matches the list order).
  const boardItems = useMemo(() => {
    const seen = new Set();
    const out = [];
    const sorted = [...stickers].sort((a, b) => (a.z || 0) - (b.z || 0));
    for (const s of sorted) {
      const it = itemsById[s.itemId];
      if (!it || seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
    return out;
  }, [stickers, itemsById]);

  // Categories with >1 item selected — these are the conflicting picks
  // we warn about (e.g. user selected two tops; try-on would layer them
  // weird). User can still proceed; warning is informational.
  const overlapCats = useMemo(() => {
    const counts = {};
    for (const id of tryonSelected) {
      const cat = itemsById[id]?.tags?.category || '_';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts).filter(([, n]) => n > 1).map(([c]) => c);
  }, [tryonSelected, itemsById]);

  const toggleTryon = (id) => {
    setTryonSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllForTryon = () => setTryonSelected(new Set(boardItems.map(i => i.id)));
  const clearTryonSelection = () => setTryonSelected(new Set());

  const goTryOn = () => {
    if (tryonSelected.size === 0) return;
    navigate(`/tryon?items=${Array.from(tryonSelected).join(',')}`);
  };

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
        setBackground(b.background || DEFAULT_BOARD_BG);
        setRatio(b.ratio || DEFAULT_BOARD_RATIO);
        setIsPublic(b.isPublic === true);
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
          <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
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
        const { id } = await BoardService.createBoard({ name: name.trim(), stickers, coverUrl, isPublic, background, ratio });
        navigate(`/boards/${id}`, { replace: true });
      } else {
        await BoardService.updateBoard(boardId, { name: name.trim(), stickers, coverUrl, isPublic, background, ratio });
        // Pop back to the detail we were pushed from (it's a live snapshot, so
        // it already shows the edit) instead of pushing another /boards/:id —
        // that left two detail entries so back showed the board twice.
        if (window.history.length > 1) navigate(-1);
        else navigate(`/boards/${boardId}`, { replace: true });
      }
    } catch (e) {
      console.warn('save board failed', e?.message);
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (isNew) { navigate('/profile/boards'); return; }
    if (!confirm(t('confirmDeleteBoard'))) return;
    await BoardService.deleteBoard(boardId);
    navigate('/profile/boards');
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
        background={background}
        ratio={ratio}
        t={t}
      />

      {/* Shape picker — board canvas aspect ratio */}
      <div className="board-ratio-row" role="radiogroup" aria-label={t('boardShape')}>
        {BOARD_RATIOS.map(r => (
          <button
            key={r.key}
            type="button"
            role="radio"
            aria-checked={ratio === r.key}
            className={`board-ratio-chip${ratio === r.key ? ' active' : ''}`}
            onClick={() => setRatio(r.key)}
          >
            <span className="board-ratio-icon" style={{ aspectRatio: r.css }} />
            {t(`boardShape_${r.key}`)}
          </button>
        ))}
      </div>

      {/* Backdrop picker — swatches of color / texture for the board canvas */}
      <div className="board-bg-row" role="radiogroup" aria-label={t('boardBackground')}>
        {BOARD_BACKGROUNDS.map(bg => (
          <button
            key={bg.key}
            type="button"
            role="radio"
            aria-checked={background === bg.key}
            className={`board-bg-swatch${background === bg.key ? ' active' : ''}`}
            style={boardBgStyle(bg.key)}
            onClick={() => setBackground(bg.key)}
            aria-label={bg.key}
          />
        ))}
      </div>

      {boardItems.length > 0 && (
        <section className="board-items">
          <header className="board-items-head">
            <h3>{t('boardItemsHead')}</h3>
            <button
              type="button"
              className="board-items-select-all"
              onClick={tryonSelected.size === boardItems.length ? clearTryonSelection : selectAllForTryon}
            >
              {tryonSelected.size === boardItems.length ? t('clear') : t('selectAll')}
            </button>
          </header>
          <div className="board-items-grid">
            {boardItems.map(it => {
              const sel = tryonSelected.has(it.id);
              const cover = it.croppedUrl || it.originalUrl;
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`item-card builder-pickable${sel ? ' selected' : ''}`}
                  onClick={() => toggleTryon(it.id)}
                >
                  <div className="item-card-image">
                    {cover
                      ? <img src={cover} alt="" loading="lazy" />
                      : <div className="item-card-skeleton" />}
                    {sel && (
                      <span className="item-card-check"><Check size={14} strokeWidth={2.4} /></span>
                    )}
                  </div>
                  <div className="item-card-meta">
                    {it.tags?.category && (
                      <span className="item-card-cat">{t(`taxonomy.categories.${it.tags.category}`)}</span>
                    )}
                    {it.name && <span className="item-card-name">{it.name}</span>}
                  </div>
                </button>
              );
            })}
          </div>
          {overlapCats.length > 0 && (
            <p className="board-items-warn">
              <AlertTriangle size={14} strokeWidth={1.8} />
              {t('boardOverlapWarn', { cats: overlapCats.map(c => t(`taxonomy.categories.${c}`) || c).join(', ') })}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary board-tryon-btn"
            onClick={goTryOn}
            disabled={tryonSelected.size === 0}
          >
            <Sparkles size={14} strokeWidth={1.8} />
            {t('boardTryOnSelected')}{tryonSelected.size > 0 ? ` · ${tryonSelected.size}` : ''}
          </button>
        </section>
      )}

      <div className="board-actions">
        <button
          type="button"
          className="btn btn-secondary board-action-btn"
          onClick={() => setPickerOpen(true)}
        >
          <Plus size={16} strokeWidth={1.8} /> {t('boardAddItems')}
        </button>
        {selectedSticker !== null && (
          <button
            type="button"
            className="btn btn-secondary danger-btn board-action-btn"
            onClick={() => removeSticker(selectedSticker)}
          >
            <Trash2 size={16} strokeWidth={1.6} /> {t('removeFromBoard')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary board-action-btn"
          onClick={save}
          disabled={saving}
        >
          {saving ? t('saving') : t('boardSave')}
        </button>
        {!isNew && (
          <button
            type="button"
            className="btn btn-secondary danger-btn board-action-btn"
            onClick={remove}
          >
            <Trash2 size={16} strokeWidth={1.6} /> {t('delete')}
          </button>
        )}
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
  background,
  ratio,
  t,
}) {
  const canvasRef = useRef(null);
  // dragState handles MOVE (whole sticker body drag).
  // handleState handles RESIZE / ROTATE (corner + top handles).
  const dragState = useRef(null);
  const handleState = useRef(null);

  // Safety net: if a pointerup/cancel ever fails to reach the sticker's own
  // handler (the element re-rendered or got detached mid-gesture, an iOS
  // WebView quirk), the drag would stay "armed" and swallow the next touch —
  // the board feels frozen. A window-level listener guarantees the gesture
  // state always clears on any pointer release.
  useEffect(() => {
    const clear = () => {
      if (dragState.current) {
        clearTimeout(dragState.current.pressTimer);
        dragState.current = null;
      }
      handleState.current = null;
    };
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, []);

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

  // ── Corner-drag resize / top-handle rotate ─────────────────────────
  // Both work in canvas-pixel space so the math is independent of the
  // sticker's current scale / rotation transforms.
  const onHandleDown = (e, idx, mode) => {
    e.stopPropagation();
    e.preventDefault();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    const s = stickers[idx];
    const centerPx = {
      x: canvasRect.left + s.x * canvasRect.width,
      y: canvasRect.top + s.y * canvasRect.height,
    };
    const initDx = e.clientX - centerPx.x;
    const initDy = e.clientY - centerPx.y;
    handleState.current = {
      idx,
      mode, // 'resize' | 'rotate'
      centerPx,
      initDist: Math.hypot(initDx, initDy),
      initAngleDeg: (Math.atan2(initDy, initDx) * 180) / Math.PI,
      initScale: s.scale,
      initRotation: s.rotation || 0,
    };
    setSelectedSticker(idx);
    onBringToFront(idx);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const onHandleMove = (e) => {
    const hs = handleState.current;
    if (!hs) return;
    e.stopPropagation();
    const dx = e.clientX - hs.centerPx.x;
    const dy = e.clientY - hs.centerPx.y;
    if (hs.mode === 'resize') {
      const dist = Math.hypot(dx, dy);
      const ratio = hs.initDist > 0 ? dist / hs.initDist : 1;
      const next = Math.max(0.15, Math.min(1.4, hs.initScale * ratio));
      onStickerChange(hs.idx, { scale: next });
    } else if (hs.mode === 'rotate') {
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      let delta = angleDeg - hs.initAngleDeg;
      // Keep [-180, 180]
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      let next = hs.initRotation + delta;
      while (next > 180) next -= 360;
      while (next < -180) next += 360;
      onStickerChange(hs.idx, { rotation: Math.round(next) });
    }
  };

  const onHandleUp = (e) => {
    if (!handleState.current) return;
    handleState.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  return (
    <div
      ref={canvasRef}
      className="board-canvas"
      style={{ aspectRatio: boardRatioCss(ratio), ...boardBgStyle(background) }}
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
        // Inverse scale for handles so they stay a constant visual size
        // regardless of how big the sticker has been resized.
        const inv = s.scale > 0 ? 1 / s.scale : 1;
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
            {isSelected && (
              <>
                {['tl', 'tr', 'bl', 'br'].map(corner => (
                  <span
                    key={corner}
                    className={`sticker-handle sticker-handle-${corner}`}
                    style={{ transform: `scale(${inv})` }}
                    onPointerDown={(e) => onHandleDown(e, idx, 'resize')}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onPointerCancel={onHandleUp}
                  />
                ))}
                <span
                  className="sticker-handle sticker-handle-rot"
                  style={{ transform: `translateX(-50%) scale(${inv})` }}
                  onPointerDown={(e) => onHandleDown(e, idx, 'rotate')}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onPointerCancel={onHandleUp}
                />
              </>
            )}
          </div>
        );
      })}
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
  const { sheetStyle, handleProps } = useSheetDrag(onClose);
  return (
    <div className="create-sheet-overlay" onClick={onClose}>
      <div className="create-sheet board-picker" style={sheetStyle} onClick={e => e.stopPropagation()}>
        <div className="create-sheet-handle" {...handleProps} style={{ cursor: 'grab' }} />
        <button type="button" className="create-sheet-close" onClick={onClose} aria-label={t('close')}>
          <X size={18} />
        </button>
        <h3 className="board-picker-title">{t('boardAddItems')}</h3>

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
          className="btn btn-primary board-picker-add"
          disabled={picked.size === 0}
          onClick={() => onPick(Array.from(picked))}
        >
          {t('add')}{picked.size > 0 ? ` · ${picked.size}` : ''}
        </button>
      </div>
    </div>
  );
}

function StickerMenu({ sticker, item, onClose, onRemove, t }) {
  const { sheetStyle, handleProps } = useSheetDrag(onClose);
  if (!item) return null;
  return (
    <div className="create-sheet-overlay" onClick={onClose}>
      <div className="create-sheet sticker-menu" style={sheetStyle} onClick={e => e.stopPropagation()}>
        <div className="create-sheet-handle" {...handleProps} style={{ cursor: 'grab' }} />
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

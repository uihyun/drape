import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Check, SlidersHorizontal, Plus } from 'lucide-react';
import { db } from '../firebase.js';
import { OutfitService } from '../services/outfit-service.js';
import { BoardService } from '../services/board-service.js';
import { ItemService } from '../services/item-service.js';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
import { AlertModal } from '../components/AlertModal.jsx';
import { matchCloset } from '../utils/itemMatch.js';
import {
  LookFilterSheet, emptyLookFilters, countLookFilters,
} from '../components/LookFilterSheet.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

// Closet-sized page for attaching the actual worn pieces to an outfit/OOTD.
// Three ways in:
//   1) Per analyzed piece — tap a tag-matched closet suggestion.
//   2) Browse the whole closet (search + tag filter) and multi-select.
//   3) Pick a board (a saved group of items) to pull all its items in.
// Selection writes outfit.itemIds; on a dated outfit we also stamp wear.
export function OutfitLink({ user, onSignIn }) {
  const { t } = useLocale();
  const { outfitId } = useParams();
  const navigate = useNavigate();
  const [outfit, setOutfit] = useState(null);
  const [closet, setCloset] = useState([]);
  const [boards, setBoards] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [filters, setFilters] = useState(emptyLookFilters());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const filterCount = countLookFilters(filters);

  useEffect(() => {
    if (!outfitId) return;
    return onSnapshot(doc(db, 'outfits', outfitId), snap => {
      setOutfit(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [outfitId]);

  // Seed selection from the outfit's existing itemIds (once). Also pre-set
  // the closet filter to the categories detected in the look, so "From your
  // closet" starts narrowed to the relevant pieces (dress, footwear, …)
  // instead of the whole wardrobe.
  useEffect(() => {
    if (outfit && !seeded) {
      setSelected(new Set(outfit.itemIds || []));
      setPieceLinks(outfit.pieceLinks && typeof outfit.pieceLinks === 'object' ? { ...outfit.pieceLinks } : {});
      const pieceCats = Array.from(new Set(
        (Array.isArray(outfit.pieces) ? outfit.pieces : [])
          .map(p => p?.category).filter(Boolean)
      ));
      if (pieceCats.length) setFilters(prev => ({ ...prev, category: pieceCats }));
      setSeeded(true);
    }
  }, [outfit, seeded]);

  useEffect(() => {
    if (!user || user.isAnonymous) { setCloset([]); return; }
    return ItemService.subscribeMyCloset(user.uid, list =>
      setCloset(list.filter(i => i.status === 'ready' && !i.isArchived)));
  }, [user?.uid]);

  useEffect(() => {
    if (!user || user.isAnonymous) { setBoards([]); return; }
    BoardService.listMyBoards({ pageSize: 30 }).then(b => setBoards(b || [])).catch(() => setBoards([]));
  }, [user?.uid]);

  const closetById = useMemo(
    () => Object.fromEntries(closet.map(i => [i.id, i])),
    [closet],
  );

  const pieces = useMemo(
    () => (Array.isArray(outfit?.pieces) ? outfit.pieces : []),
    [outfit],
  );

  // #3 — slot each linked item under the detected piece it matches.
  // pieceLinks: { [pieceIndex]: [itemId, …] }. An item belongs to at most one
  // piece; items whose category matches no piece stay "unsorted" (flat).
  const [pieceLinks, setPieceLinks] = useState({});
  const [picker, setPicker] = useState(null); // { itemId, candidates: [{p, idx}] }

  const piecesByCategory = (cat) => pieces
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => p.category && cat && p.category === cat);

  const assignToPiece = (idx, itemId) => {
    setPieceLinks(prev => {
      const next = {};
      // An item lives under one piece — drop it from any other first.
      for (const [k, ids] of Object.entries(prev)) {
        const kept = ids.filter(id => id !== itemId);
        if (kept.length) next[k] = kept;
      }
      next[idx] = [...(next[idx] || []), itemId];
      return next;
    });
  };

  const unassignItem = (itemId) => {
    setPieceLinks(prev => {
      const next = {};
      for (const [k, ids] of Object.entries(prev)) {
        const kept = ids.filter(id => id !== itemId);
        if (kept.length) next[k] = kept;
      }
      return next;
    });
  };

  // Whole-closet grid / generic select. On add, auto-slot by category:
  // 1 matching piece → assign; 2+ → ask (modal); 0 → leave unsorted.
  const toggle = (item) => {
    const id = typeof item === 'string' ? item : item.id;
    const obj = typeof item === 'string' ? closetById[id] : item;
    const wasSelected = selected.has(id);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (wasSelected) {
      unassignItem(id);
    } else {
      const cands = piecesByCategory(obj?.tags?.category);
      if (cands.length === 1) assignToPiece(cands[0].idx, id);
      else if (cands.length >= 2) setPicker({ itemId: id, candidates: cands });
    }
  };

  // Tapping a closet suggestion shown UNDER a specific piece is an explicit
  // choice — assign straight to that piece, no category guessing.
  const togglePieceMatch = (idx, item) => {
    const id = item.id;
    if (selected.has(id)) {
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
      unassignItem(id);
    } else {
      setSelected(prev => new Set(prev).add(id));
      assignToPiece(idx, id);
    }
  };

  // "+ Add to closet" for a detected piece that isn't in the closet yet:
  // crop it out of THIS look's photo into a new owned item (same engine as
  // the analyze flow's add), then auto-link it. So a piece can be either
  // linked to an existing item or freshly added — without leaving here.
  // "+" now just MARKS a piece to be added on Save (was: add immediately).
  // pieceIndex -> piece. The actual createFromExistingPhoto happens in save()
  // so nothing lands in the closet until the user commits.
  const [pendingAdds, setPendingAdds] = useState(new Map());
  const [addErr, setAddErr] = useState(null);
  const togglePendingAdd = (piece, i) => {
    setPendingAdds(prev => {
      const next = new Map(prev);
      if (next.has(i)) next.delete(i); else next.set(i, piece);
      return next;
    });
  };

  // Tapping a board pulls every closet item pinned on it into the
  // selection (or clears them all if they're already selected).
  const toggleBoard = (ids) => {
    const valid = ids.filter(id => closetById[id]);
    if (valid.length === 0) return;
    const allSel = valid.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      valid.forEach(id => (allSel ? next.delete(id) : next.add(id)));
      return next;
    });
    // Bulk pull: auto-slot the unambiguous ones (exactly 1 piece in that
    // category). Skip the picker modal here — a board can add many items and
    // a modal per ambiguous item would be a wall of prompts; those stay
    // unsorted and can be slotted individually from the per-piece strip.
    valid.forEach(id => {
      if (allSel) { unassignItem(id); return; }
      if (selected.has(id)) return; // already in — keep its existing mapping
      const cands = piecesByCategory(closetById[id]?.tags?.category);
      if (cands.length === 1) assignToPiece(cands[0].idx, id);
    });
  };

  const toggleFilter = (dim, value) => {
    setFilters(prev => {
      const cur = prev[dim] || [];
      const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value];
      return { ...prev, [dim]: next };
    });
  };

  // Closet grid filtered by tag chips only (no text search — same as the
  // closet itself; the closed tag vocab sidesteps cross-language search).
  const visibleCloset = useMemo(() => {
    if (filterCount === 0) return closet;
    return closet.filter(it => {
      const tg = it.tags || {};
      for (const [dim, sel] of Object.entries(filters)) {
        if (!sel.length) continue;
        const field = dim === 'fits' ? 'fit' : dim === 'category' ? 'category' : dim;
        const v = tg[field];
        const ok = Array.isArray(v) ? v.some(x => sel.includes(x)) : sel.includes(v);
        if (!ok) return false;
      }
      return true;
    });
  }, [closet, filters, filterCount]);

  // We were PUSHED here from the outfit detail (its live subscription already
  // reflects the new links), so pop back to it instead of pushing another
  // /o/:id entry — that left two detail entries in history, so back showed
  // the detail twice before reaching the list. Fall back to a replace if this
  // page was opened directly (no history to pop).
  const backToDetail = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(`/o/${outfit.id}`, { replace: true });
  };

  const save = async () => {
    if (saving || !outfit) return;
    setSaving(true);
    try {
      // Commit the "+ add to closet" picks now — crop each marked piece out
      // of this look's photo into a new owned item, then link it too.
      const newIds = [];
      // Clone the piece→items map so we can graft freshly-added pieces in.
      const links = {};
      for (const [k, arr] of Object.entries(pieceLinks)) links[k] = [...arr];
      const photoUrl = outfit.photoUrl || outfit.sourcePhotoUrl || outfit.coverUrl;
      const photoPath = outfit.photoPath || outfit.sourcePhotoPath || outfit.coverPath;
      if (pendingAdds.size && photoUrl && photoPath) {
        for (const [idx, piece] of pendingAdds.entries()) {
          try {
            const { id } = await ItemService.createFromExistingPhoto({ photoUrl, photoPath, detected: piece, owned: true });
            newIds.push(id);
            // A "+ add" piece IS that detected piece → slot it there.
            links[idx] = [...(links[idx] || []), id];
          } catch (e) { console.warn('add piece on save failed:', e?.message); }
        }
      }
      const ids = [...Array.from(selected), ...newIds];
      // Drop any stale links pointing at items no longer selected.
      const idSet = new Set(ids);
      const cleanLinks = {};
      for (const [k, arr] of Object.entries(links)) {
        const kept = arr.filter(id => idSet.has(id));
        if (kept.length) cleanLinks[k] = kept;
      }
      const cover = outfit.coverUrl || outfit.photoCutUrl || outfit.photoUrl
        || ids.map(id => closetById[id]).find(Boolean)?.croppedUrl || null;
      await OutfitService.updateOutfit(outfit.id, { itemIds: ids, coverUrl: cover, pieceLinks: cleanLinks });
      // Dated look → stamp wear on the linked items for that day.
      if (outfit.date && ids.length) {
        await ItemService.recordWear({ itemIds: ids, date: outfit.date, ootdId: outfit.id, outfitId: outfit.id });
      }
      backToDetail();
    } catch (e) {
      console.warn('link items failed', e?.message);
    } finally { setSaving(false); }
  };

  if (!user || user.isAnonymous) {
    return (
      <div className="page">
        <h1 className="page-h1">{t('linkItemsTitle')}</h1>
        <div className="empty-state empty-state-card">
          <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
        </div>
      </div>
    );
  }
  if (!outfit) return <div className="loading"><div className="spinner" /></div>;

  // A freshly-saved photo OOTD: analyzeOotd runs server-side and fills
  // `pieces` + `analyzedAt` a moment later. Until then, show a "reading
  // your look" note so the empty pieces area reads as in-progress.
  const analyzing = !!(outfit.photoUrl || outfit.photoCutUrl || outfit.sourcePhotoUrl)
    && !outfit.analyzedAt && pieces.length === 0;

  return (
    <div className="page outfit-link">
      <h1 className="page-h1">{t('linkItemsTitle')}</h1>
      <p className="page-sub">{t('linkItemsSub')}</p>

      {analyzing && (
        <section className="outfit-link-pieces">
          <h2 className="outfit-link-h2">{t('piecesInLook')}</h2>
          <div className="piece-analyzing">
            <span className="piece-analyzing-dot" />
            <span>{t('tryOnAnalyzing')}</span>
          </div>
        </section>
      )}

      {/* Per-piece suggestions from analysis */}
      {pieces.length > 0 && (
        <section className="outfit-link-pieces">
          <h2 className="outfit-link-h2">{t('piecesInLook')}</h2>
          {pieces.map((piece, i) => {
            const matches = matchCloset(piece, closet);
            const label = piece.name
              || [(piece.colors || [])[0], piece.category].filter(Boolean).join(' ')
              || t('untitledItem');
            return (
              <div key={i} className="piece-match-row">
                <div className="piece-match-head">
                  <span className="piece-match-name">{label}</span>
                  {piece.category && (
                    <span className="piece-match-cat">{t(`taxonomy.categories.${piece.category}`)}</span>
                  )}
                  <button
                    type="button"
                    className={`piece-add-closet${pendingAdds.has(i) ? ' done' : ''}`}
                    onClick={() => togglePendingAdd(piece, i)}
                    aria-label={t('addToCloset')}
                    title={t('addToCloset')}
                  >
                    {pendingAdds.has(i)
                      ? <Check size={14} strokeWidth={2.6} />
                      : <Plus size={15} strokeWidth={2.4} />}
                  </button>
                </div>
                {matches.length > 0 ? (
                  <div className="analyze-match-strip">
                    <span className="analyze-match-label">{t('fromYourCloset')}</span>
                    <div className="analyze-match-row">
                      {matches.map(({ item }) => {
                        const on = selected.has(item.id);
                        const cover = item.croppedUrl || item.originalUrl;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`analyze-match-card${on ? ' selected' : ''}`}
                            onClick={() => togglePieceMatch(i, item)}
                          >
                            {cover ? <img src={cover} alt="" loading="lazy" /> : <div className="item-card-skeleton" />}
                            {on && <span className="item-card-check"><Check size={12} strokeWidth={2.6} /></span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <span className="piece-match-empty">{t('noClosetMatch')}</span>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Boards (item groups) */}
      {boards.length > 0 && (
        <section className="outfit-link-boards">
          <h2 className="outfit-link-h2">{t('linkFromBoard')}</h2>
          <div className="link-board-row">
            {boards.map(b => {
              const ids = (b.stickers || []).map(s => s.itemId).filter(id => id && closetById[id]);
              if (ids.length === 0) return null;
              const allSel = ids.every(id => selected.has(id));
              return (
                <button
                  key={b.id}
                  type="button"
                  className={`link-board-card${allSel ? ' selected' : ''}`}
                  title={b.name || ''}
                  onClick={() => toggleBoard(ids)}
                >
                  <BoardThumbnail board={b} itemsById={closetById} />
                  {b.name && <span className="link-board-name">{b.name}</span>}
                  {allSel && <span className="item-card-check"><Check size={14} strokeWidth={2.4} /></span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Whole closet: search + tag filter + multi-select grid */}
      <section className="outfit-link-closet">
        <div className="closet-header" style={{ marginBottom: '0.75rem' }}>
          <h2 className="outfit-link-h2" style={{ margin: 0 }}>{t('linkFromCloset')}</h2>
          <button
            type="button"
            className={`closet-search-btn${filterCount > 0 ? ' has-filters' : ''}`}
            aria-label={t('detailedFilter')}
            onClick={() => setSheetOpen(true)}
          >
            <SlidersHorizontal size={18} strokeWidth={1.7} />
            {filterCount > 0 && <span className="closet-filter-badge">{filterCount}</span>}
          </button>
        </div>
        <div className="closet-grid">
          {visibleCloset.map(it => {
            const on = selected.has(it.id);
            return (
              <button
                key={it.id}
                type="button"
                className={`item-card builder-pickable ${on ? 'selected' : ''}`}
                onClick={() => toggle(it)}
              >
                <div className="item-card-image">
                  {it.croppedUrl || it.originalUrl
                    ? <img src={it.croppedUrl || it.originalUrl} alt="" loading="lazy" />
                    : <div className="item-card-skeleton" />}
                  {on && <span className="item-card-check"><Check size={14} strokeWidth={2.4} /></span>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="builder-cta">
        <button type="button" className="btn btn-secondary" onClick={backToDetail} disabled={saving}>
          {t('skip')}
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? t('saving') : `${t('save')}${(selected.size + pendingAdds.size) > 0 ? ` · ${selected.size + pendingAdds.size}` : ''}`}
        </button>
      </div>

      {sheetOpen && (
        <LookFilterSheet
          filters={filters}
          onToggle={toggleFilter}
          onClear={() => setFilters(emptyLookFilters())}
          onClose={() => setSheetOpen(false)}
          count={filterCount}
          resultCount={visibleCloset.length}
        />
      )}

      {/* 2+ pieces share the picked item's category → ask which one. */}
      {picker && (
        <div className="modal-backdrop" onClick={() => setPicker(null)}>
          <div className="modal piece-picker-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('pickPieceTitle')}</h3>
            <p className="piece-picker-sub">{t('pickPieceSub')}</p>
            <div className="piece-picker-list">
              {picker.candidates.map(({ p, idx }) => {
                const label = p.name
                  || [(p.colors || [])[0], p.category].filter(Boolean).join(' ')
                  || t('untitledItem');
                return (
                  <button
                    key={idx}
                    type="button"
                    className="piece-picker-opt"
                    onClick={() => { assignToPiece(idx, picker.itemId); setPicker(null); }}
                  >
                    <span className="piece-picker-opt-name">{label}</span>
                    {p.category && <span className="piece-match-cat">{t(`taxonomy.categories.${p.category}`)}</span>}
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPicker(null)}>
              {t('leaveUnsorted')}
            </button>
          </div>
        </div>
      )}

      <AlertModal open={!!addErr} message={addErr} onClose={() => setAddErr(null)} />
    </div>
  );
}

export default OutfitLink;

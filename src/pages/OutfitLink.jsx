import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Check, SlidersHorizontal, Plus, Loader2 } from 'lucide-react';
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

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // "+ Add to closet" for a detected piece that isn't in the closet yet:
  // crop it out of THIS look's photo into a new owned item (same engine as
  // the analyze flow's add), then auto-link it. So a piece can be either
  // linked to an existing item or freshly added — without leaving here.
  const [addingPiece, setAddingPiece] = useState(-1);
  const [addedPieces, setAddedPieces] = useState(new Set());
  const [addErr, setAddErr] = useState(null);
  const addPieceToCloset = async (piece, i) => {
    if (addingPiece !== -1 || addedPieces.has(i)) return;
    const photoUrl = outfit.photoUrl || outfit.sourcePhotoUrl || outfit.coverUrl;
    if (!photoUrl) return;
    setAddingPiece(i);
    try {
      const res = await fetch(photoUrl, { mode: 'cors' });
      if (!res.ok) throw new Error(`photo ${res.status}`);
      const blob = await res.blob();
      const { id } = await ItemService.createFromDetected({ blob, detected: piece, owned: true });
      setSelected(prev => new Set(prev).add(id));        // link the new item
      setAddedPieces(prev => new Set(prev).add(i));
    } catch (e) {
      console.warn('add piece to closet failed:', e?.message);
      setAddErr(t('addToClosetFailed'));
    } finally { setAddingPiece(-1); }
  };

  // Tapping a board pulls every closet item pinned on it into the
  // selection (or clears them all if they're already selected).
  const toggleBoard = (ids) => {
    const valid = ids.filter(id => closetById[id]);
    if (valid.length === 0) return;
    setSelected(prev => {
      const next = new Set(prev);
      const allSel = valid.every(id => next.has(id));
      valid.forEach(id => (allSel ? next.delete(id) : next.add(id)));
      return next;
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

  const save = async () => {
    if (saving || !outfit) return;
    setSaving(true);
    try {
      const ids = Array.from(selected);
      const cover = outfit.coverUrl || outfit.photoCutUrl || outfit.photoUrl
        || ids.map(id => closetById[id]).find(Boolean)?.croppedUrl || null;
      await OutfitService.updateOutfit(outfit.id, { itemIds: ids, coverUrl: cover });
      // Dated look → stamp wear on the linked items for that day.
      if (outfit.date && ids.length) {
        await ItemService.recordWear({ itemIds: ids, date: outfit.date, ootdId: outfit.id, outfitId: outfit.id });
      }
      navigate(`/o/${outfit.id}`, { replace: true });
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

  const pieces = Array.isArray(outfit.pieces) ? outfit.pieces : [];
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
                    className={`piece-add-closet${addedPieces.has(i) ? ' done' : ''}`}
                    onClick={() => addPieceToCloset(piece, i)}
                    disabled={addingPiece === i || addedPieces.has(i)}
                    aria-label={t('addToCloset')}
                    title={t('addToCloset')}
                  >
                    {addedPieces.has(i)
                      ? <Check size={14} strokeWidth={2.6} />
                      : addingPiece === i
                        ? <Loader2 size={14} strokeWidth={2} className="spin" />
                        : <Plus size={15} strokeWidth={2.4} />}
                  </button>
                </div>
                {matches.length > 0 ? (
                  <div className="analyze-match-row">
                    {matches.map(({ item }) => {
                      const on = selected.has(item.id);
                      const cover = item.croppedUrl || item.originalUrl;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`analyze-match-card${on ? ' selected' : ''}`}
                          onClick={() => toggle(item.id)}
                        >
                          {cover ? <img src={cover} alt="" loading="lazy" /> : <div className="item-card-skeleton" />}
                          {on && <span className="item-card-check"><Check size={12} strokeWidth={2.6} /></span>}
                        </button>
                      );
                    })}
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
                onClick={() => toggle(it.id)}
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
        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/o/${outfit.id}`, { replace: true })} disabled={saving}>
          {t('skip')}
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? t('saving') : `${t('save')}${selected.size > 0 ? ` · ${selected.size}` : ''}`}
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

      <AlertModal open={!!addErr} message={addErr} onClose={() => setAddErr(null)} />
    </div>
  );
}

export default OutfitLink;

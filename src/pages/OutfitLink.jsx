import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Check, SlidersHorizontal } from 'lucide-react';
import { db } from '../firebase.js';
import { OutfitService } from '../services/outfit-service.js';
import { BoardService } from '../services/board-service.js';
import { ItemService } from '../services/item-service.js';
import { BoardThumbnail } from '../components/BoardThumbnail.jsx';
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

  // Seed selection from the outfit's existing itemIds (once).
  useEffect(() => {
    if (outfit && !seeded) {
      setSelected(new Set(outfit.itemIds || []));
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

  return (
    <div className="page outfit-link">
      <h1 className="page-h1">{t('linkItemsTitle')}</h1>
      <p className="page-sub">{t('linkItemsSub')}</p>

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
          <div className="analyze-match-row">
            {boards.map(b => {
              const ids = Array.from(new Set((b.stickers || []).map(s => s.itemId).filter(Boolean)));
              return (
                <button
                  key={b.id}
                  type="button"
                  className="analyze-match-card board"
                  title={b.name || ''}
                  onClick={() => setSelected(prev => new Set([...prev, ...ids]))}
                >
                  {b.coverUrl ? <img src={b.coverUrl} alt="" loading="lazy" /> : <div className="item-card-skeleton" />}
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
    </div>
  );
}

export default OutfitLink;

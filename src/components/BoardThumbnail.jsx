import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { boardBgStyle, boardRatioCss } from '../data/boardBackgrounds.js';

// Shared across all thumbnail instances + their re-mounts. Back-navigation
// re-mounts every card, and without this each one re-fetched its sticker
// items from zero — blanking then repopulating, which reads as the board
// "reorganizing" on every return. Keyed by itemId; items rarely change.
const itemCache = new Map();

// Replays a board's stickers at their stored 0..1 coordinates so the
// thumbnail matches what the editor shows, just shrunk to whatever
// aspect-ratio the parent container uses.
//
// Pass `itemsById` if you already have items in memory (closet page,
// editor preview). Omit it on Feed cards / public detail and the
// component hydrates each referenced item via a one-shot getDoc — the
// queries are cheap (single-doc reads, run in parallel) and cover-image
// reads via Cloud Storage are public for ready items.
export function BoardThumbnail({ board, itemsById, className = '' }) {
  const stickers = Array.isArray(board?.stickers) ? board.stickers : [];

  // Key the self-hydration on the actual sticker item ids (stable string),
  // not the board object identity — so a parent re-render with a new board
  // reference doesn't retrigger a fetch that briefly blanks the thumbnail.
  const idKey = Array.from(new Set(stickers.map(s => s.itemId).filter(Boolean))).sort().join(',');

  // ids the parent already supplies — we only self-fetch the rest.
  const suppliedKey = itemsById
    ? Array.from(new Set(stickers.map(s => s.itemId).filter(id => id && itemsById[id]))).sort().join(',')
    : '';

  // Seed initial state from the shared cache so a warm re-mount paints the
  // stickers on the first frame — no blank → re-fetch flash.
  const [fetched, setFetched] = useState(() => {
    if (!idKey) return null;
    const hit = {};
    for (const id of idKey.split(',')) if (itemCache.has(id)) hit[id] = itemCache.get(id);
    return Object.keys(hit).length ? hit : null;
  });

  useEffect(() => {
    if (!idKey) { setFetched({}); return; }
    const supplied = itemsById || {};
    // Self-fetch ANY referenced item the parent didn't supply (e.g. a board
    // pins a closet item that's since been removed, or the closet map is mid
    // load) so the card renders the full board, exactly like the detail.
    const ids = idKey.split(',').filter(id => !supplied[id]);
    const cached = {};
    for (const id of ids) if (itemCache.has(id)) cached[id] = itemCache.get(id);
    if (Object.keys(cached).length) setFetched(prev => ({ ...(prev || {}), ...cached }));
    const missing = ids.filter(id => !itemCache.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map(id => getDoc(doc(db, 'items', id))
        .then(s => s.exists() ? [id, { id, ...s.data() }] : null)
        .catch(() => null))
    ).then(rows => {
      if (cancelled) return;
      const map = Object.fromEntries(rows.filter(Boolean));
      for (const [id, it] of Object.entries(map)) itemCache.set(id, it);
      // Merge onto any previously-fetched items so a transient miss never
      // empties an already-rendered thumbnail.
      setFetched(prev => ({ ...(prev || {}), ...map }));
    });
    return () => { cancelled = true; };
  }, [idKey, suppliedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Parent-supplied items win (fresh), self-fetched fill every gap — so a
  // partial itemsById never drops stickers.
  const lookup = { ...(fetched || {}), ...(itemsById || {}) };
  // Background + the board's own aspect ratio (portrait/square/landscape).
  const style = { ...boardBgStyle(board?.background), aspectRatio: boardRatioCss(board?.ratio) };

  if (stickers.length === 0) {
    return (
      <div className={`board-card-cover ${className}`} style={style}>
        <div className="board-card-cover-empty">◇</div>
      </div>
    );
  }

  const sorted = [...stickers].sort((a, b) => (a.z || 0) - (b.z || 0));
  return (
    <div className={`board-card-cover board-card-canvas ${className}`} style={style}>
      {sorted.map((s, i) => {
        const item = lookup[s.itemId];
        const cover = item?.croppedUrl || item?.originalUrl;
        if (!cover) return null;
        return (
          <div
            key={`${s.itemId}-${i}`}
            className="board-card-sticker"
            style={{
              left: `${(s.x || 0.5) * 100}%`,
              top: `${(s.y || 0.5) * 100}%`,
              transform: `translate(-50%, -50%) scale(${s.scale || 0.35}) rotate(${s.rotation || 0}deg)`,
              // Stack by sorted array index (bounded 0..N) instead of the
              // stored s.z (unbounded — grows every bring-to-front), so a
              // fixed card overlay z reliably sits above every sticker.
              zIndex: i + 1,
            }}
          >
            <img src={cover} alt="" referrerPolicy="no-referrer" draggable={false} />
          </div>
        );
      })}
    </div>
  );
}

export default BoardThumbnail;

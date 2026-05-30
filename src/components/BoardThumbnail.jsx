import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { boardBgStyle, boardRatioCss } from '../data/boardBackgrounds.js';

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
  const [fetched, setFetched] = useState(null);

  useEffect(() => {
    if (itemsById) { setFetched(null); return; }
    const ids = Array.from(new Set(stickers.map(s => s.itemId).filter(Boolean)));
    if (!ids.length) { setFetched({}); return; }
    let cancelled = false;
    Promise.all(
      ids.map(id => getDoc(doc(db, 'items', id))
        .then(s => s.exists() ? [id, { id, ...s.data() }] : null)
        .catch(() => null))
    ).then(rows => {
      if (cancelled) return;
      setFetched(Object.fromEntries(rows.filter(Boolean)));
    });
    return () => { cancelled = true; };
  }, [board?.id, itemsById]);

  const lookup = itemsById ?? fetched ?? {};
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
            <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false} />
          </div>
        );
      })}
    </div>
  );
}

export default BoardThumbnail;

import { useState } from 'react';

// Intrinsic aspect ratios keyed by image URL, kept at module scope so a card
// returning to a masonry grid can reserve the right height *before* its lazy
// image loads. Without this, CSS `columns` re-balances every time an image
// resolves its height — and since back-navigation re-mounts the list (all
// new <img> nodes loading from zero), the whole grid visibly reorganizes on
// every return. First-ever view settles once; every later mount in the
// session is reflow-free.
const ratioCache = new Map();

// Drop-in replacement for the plain card <img>. Same attributes the masonry
// cards already used (lazy, no-referrer, non-draggable); adds an
// aspect-ratio reservation so the column layout is stable across re-mounts.
export function CardImage({ src, alt = '', className }) {
  const [ratio, setRatio] = useState(() => (src ? ratioCache.get(src) : undefined));
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      style={ratio ? { aspectRatio: String(ratio) } : undefined}
      onLoad={(e) => {
        const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
        if (!w || !h) return;
        const r = w / h;
        ratioCache.set(src, r);
        if (!ratio) setRatio(r);
      }}
    />
  );
}

export default CardImage;

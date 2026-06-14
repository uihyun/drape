import { useState, useEffect, useRef } from 'react';

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
// aspect-ratio reservation so the column layout is stable across re-mounts,
// and retries a failed load (with backoff + cache-bust) so a transient miss
// doesn't leave the cell permanently blank.
export function CardImage({ src, alt = '', className }) {
  const [ratio, setRatio] = useState(() => (src ? ratioCache.get(src) : undefined));
  // Bumped on each retry; appended as a cache-buster so a cached failure
  // (e.g. the brief public-read propagation window right after an OOTD goes
  // public, which used to leave the feed cell blank forever) isn't reused.
  const [attempt, setAttempt] = useState(0);
  const retries = useRef(0);
  const timer = useRef(null);

  useEffect(() => {
    retries.current = 0;
    setAttempt(0);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [src]);

  const url = !src
    ? src
    : (attempt > 0 ? `${src}${src.includes('?') ? '&' : '?'}_r=${attempt}` : src);

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      style={ratio ? { aspectRatio: String(ratio) } : undefined}
      onError={() => {
        if (retries.current >= 3) return; // genuinely broken → give up
        retries.current += 1;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setAttempt(a => a + 1), 600 * retries.current);
      }}
      onLoad={(e) => {
        const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
        if (!w || !h) return;
        const r = w / h;
        ratioCache.set(src, r); // key by the original src, not the cache-bust url
        if (!ratio) setRatio(r);
      }}
    />
  );
}

export default CardImage;

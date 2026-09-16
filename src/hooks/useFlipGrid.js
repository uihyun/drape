import { useLayoutEffect, useRef } from 'react';

// FLIP animation for a grid whose track count changes (the pinch-to-resize
// closet). A CSS grid re-flows instantly: cards blink out of one slot and into
// another, which reads as the list being rebuilt rather than resized.
//
// First / Last / Invert / Play: measure every child before the change, measure
// again after, then transform each child back to where it WAS and let it
// transition to its real position. Scale is part of the invert, so a card
// growing from a 4-col to a 2-col slot visibly swells instead of popping.
//
// Pass the same `dep` that drives the layout change (the column count).
export function useFlipGrid(ref, dep, { duration = 260 } = {}) {
  const prev = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const kids = Array.from(el.children);
    const now = new Map();
    for (const k of kids) {
      const id = k.dataset.flipId || k.getAttribute('key') || null;
      if (id) now.set(id, k.getBoundingClientRect());
    }

    const before = prev.current;
    prev.current = now;
    if (!before) return;

    // Honour the OS setting: this is decoration, and the layout is already
    // correct without it.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    for (const k of kids) {
      const id = k.dataset.flipId;
      const from = id && before.get(id);
      const to = id && now.get(id);
      if (!from || !to || !to.width || !to.height) continue;

      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const sx = from.width / to.width;
      const sy = from.height / to.height;
      // Sub-pixel drift isn't worth a paint.
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01) continue;

      k.style.transition = 'none';
      k.style.transformOrigin = 'top left';
      k.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    }

    // Two frames: one for the browser to commit the inverted position, one to
    // start the transition from it. A single rAF gets coalesced and the cards
    // jump straight to the end.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        for (const k of kids) {
          if (!k.style.transform) continue;
          k.style.transition = `transform ${duration}ms cubic-bezier(.22,.61,.36,1)`;
          k.style.transform = '';
        }
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [ref, dep, duration]);
}

export default useFlipGrid;

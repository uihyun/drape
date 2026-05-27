import { useEffect, useRef, useState } from 'react';

// Two-finger pinch on a grid container changes the column count between
// `min` and `max`, around the grid's `def` default. We track the live
// finger distance, map a log ratio to discrete column deltas, and snap
// on each pixel move so the grid feels live (Photos.app-like).
//
// Persistence: localStorage keyed by `name` so each grid (closet /
// outfit / board) remembers the user's last zoom.
//
// Returns `{ cols, ref }`. Spread `ref` on the grid container; the hook
// attaches non-passive touchmove listeners (needed for preventDefault to
// suppress browser-level pinch-zoom).
export function usePinchColumns(name, { min = 1, max = 4, def = 2 } = {}) {
  const key = `drape:cols:${name}`;
  const [cols, setCols] = useState(() => {
    if (typeof window === 'undefined') return def;
    const stored = window.localStorage?.getItem(key);
    const n = stored ? Number(stored) : NaN;
    return Number.isFinite(n) && n >= min && n <= max ? n : def;
  });

  const ref = useRef(null);
  const stateRef = useRef(null);
  // Mirror cols into a ref so the touch handlers read the latest value
  // without re-attaching on every change.
  const colsRef = useRef(cols);
  useEffect(() => { colsRef.current = cols; }, [cols]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const dist = (a, b) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

    const onStart = (e) => {
      if (e.touches.length !== 2) return;
      stateRef.current = {
        startDist: dist(e.touches[0], e.touches[1]),
        startCols: colsRef.current,
      };
    };

    const onMove = (e) => {
      if (e.touches.length !== 2 || !stateRef.current) return;
      // preventDefault is the whole reason we attach manually with
      // { passive: false } — without it iOS Safari does its own zoom.
      e.preventDefault();
      const d = dist(e.touches[0], e.touches[1]);
      const ratio = d / stateRef.current.startDist;
      // Spread (ratio > 1) → bigger cards → fewer cols → negative delta.
      // log2 keeps the gesture symmetric: a 2x spread and a 0.5x pinch
      // move the same number of column steps.
      const delta = Math.round(-Math.log2(ratio) * 1.6);
      const next = Math.min(max, Math.max(min, stateRef.current.startCols + delta));
      if (next !== colsRef.current) {
        colsRef.current = next;
        setCols(next);
        try { window.localStorage?.setItem(key, String(next)); } catch {}
      }
    };

    const onEnd = () => { stateRef.current = null; };

    // iOS Safari fires its own gesture* events for two-finger touches
    // and uses them to drive the viewport pinch-zoom. touch-action and
    // touchmove preventDefault on their own DON'T block it — gesture
    // events must be preventDefaulted explicitly. They no-op on Android.
    const onGesture = (e) => e.preventDefault();

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    el.addEventListener('gesturestart', onGesture, { passive: false });
    el.addEventListener('gesturechange', onGesture, { passive: false });
    el.addEventListener('gestureend', onGesture, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('gesturestart', onGesture);
      el.removeEventListener('gesturechange', onGesture);
      el.removeEventListener('gestureend', onGesture);
    };
  }, [key, min, max]);

  return { cols, ref };
}

export default usePinchColumns;

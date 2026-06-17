import { useEffect, useRef, useState } from 'react';

// Pull-to-refresh with a real "pull" feel: the whole feed content slides down
// as you drag, then springs back on release. Smoothness comes from HOW it's
// driven — the content is moved via `transform: translateY` written DIRECTLY to
// the node through a ref (GPU-composited, no layout/reflow) and NO React state
// changes during the drag, so the feed never re-renders mid-gesture. The
// earlier jank was from animating height (reflow) + setState every frame, not
// from the movement itself. On release a CSS-eased transition springs it back.
// Engages only when the view is scrolled to the very top. Touch-only.
export function usePullToRefresh(onRefresh, { threshold = 64 } = {}) {
  const contentRef = useRef(null);     // the sliding feed content
  const indicatorRef = useRef(null);   // the spinner revealed above it
  const [refreshing, setRefreshing] = useState(false);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;
  const refreshingRef = useRef(false);
  refreshingRef.current = refreshing;
  const st = useRef({ startY: null, dist: 0 });

  useEffect(() => {
    const atTop = () => {
      const m = document.querySelector('.main');
      return (window.scrollY || 0) <= 0 && (!m || m.scrollTop <= 0);
    };
    const SPRING = 'transform 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.32s ease';
    // `dist` = damped pull distance; the content follows it (capped), and the
    // spinner fades in over the same range.
    const paint = (dist, animate) => {
      const offset = Math.max(0, Math.min(dist, threshold * 1.5));
      const c = contentRef.current, ind = indicatorRef.current;
      if (c) { c.style.transition = animate ? SPRING : 'none'; c.style.transform = `translateY(${offset}px)`; }
      if (ind) { ind.style.transition = animate ? SPRING : 'none'; ind.style.opacity = String(Math.min(1, offset / threshold)); }
    };
    const reset = () => paint(0, true);

    const onStart = (e) => {
      st.current.startY = (!refreshingRef.current && atTop()) ? e.touches[0].clientY : null;
      st.current.dist = 0;
    };
    const onMove = (e) => {
      if (st.current.startY == null) return;
      const dy = e.touches[0].clientY - st.current.startY;
      if (dy > 0 && atTop()) {
        st.current.dist = dy * 0.5; // rubber-band damping
        paint(st.current.dist, false);
      } else {
        st.current.startY = null; st.current.dist = 0; reset();
      }
    };
    const onEnd = async () => {
      if (st.current.startY == null) return;
      const reached = st.current.dist >= threshold;
      st.current.startY = null; st.current.dist = 0;
      if (!reached) { reset(); return; }
      paint(threshold, true); // settle to the threshold while loading
      setRefreshing(true);
      try { await cb.current?.(); }
      catch (err) { console.warn('pull-to-refresh failed:', err?.message); }
      finally { setRefreshing(false); reset(); }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [threshold]);

  return { contentRef, indicatorRef, refreshing };
}

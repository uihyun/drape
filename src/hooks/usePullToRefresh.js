import { useEffect, useRef, useState } from 'react';

// Pull-to-refresh for a top-anchored scroll surface (the feed). Smoothness
// notes: the indicator is driven DIRECTLY through a ref (transform + opacity,
// both GPU-composited) during the drag — NO React state per frame, so the feed
// never re-renders mid-gesture. We touch transform/opacity only (never height/
// layout), so there's no reflow. On release a CSS transition springs it back.
// Listens at the document level and only engages when the view is scrolled to
// the very top. Touch-only; a no-op on desktop.
export function usePullToRefresh(onRefresh, { threshold = 64 } = {}) {
  const indicatorRef = useRef(null);
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
    // Map pull distance → a small slide + fade. Capped so it never wanders far.
    const paint = (dist, animate) => {
      const el = indicatorRef.current;
      if (!el) return;
      const d = Math.max(0, Math.min(dist, threshold * 1.3));
      el.style.transition = animate ? 'transform 0.28s ease, opacity 0.28s ease' : 'none';
      el.style.transform = `translateY(${Math.min(d, threshold) * 0.6}px)`;
      el.style.opacity = String(Math.min(1, d / threshold));
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
      // Hold visible while the refresh runs (spinner spins via .is-refreshing).
      const el = indicatorRef.current;
      if (el) {
        el.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        el.style.transform = `translateY(${threshold * 0.6}px)`;
        el.style.opacity = '1';
      }
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

  return { indicatorRef, refreshing };
}

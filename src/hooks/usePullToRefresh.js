import { useEffect, useRef, useState } from 'react';

// Pull-to-refresh for a top-anchored scroll surface (the feed). Listens at the
// document level; a downward drag that STARTS while the view is scrolled to the
// top grows an indicator, and releasing past the threshold runs `onRefresh`.
// Bound once (onRefresh is read through a ref) so re-renders don't re-bind or
// drop an in-progress gesture. Touch-only — a no-op on desktop, which is fine.
export function usePullToRefresh(onRefresh, { threshold = 70 } = {}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;
  const refreshingRef = useRef(false);
  refreshingRef.current = refreshing;
  const st = useRef({ startY: null, pull: 0 });

  useEffect(() => {
    const main = () => document.querySelector('.main');
    const atTop = () => {
      const m = main();
      return (window.scrollY || 0) <= 0 && (!m || m.scrollTop <= 0);
    };
    const onStart = (e) => {
      st.current.startY = (!refreshingRef.current && atTop()) ? e.touches[0].clientY : null;
      st.current.pull = 0;
    };
    const onMove = (e) => {
      if (st.current.startY == null) return;
      const dy = e.touches[0].clientY - st.current.startY;
      if (dy > 0 && atTop()) {
        st.current.pull = Math.min(dy * 0.5, threshold * 1.6); // rubber-band
        setPull(st.current.pull);
      } else {
        st.current.startY = null; st.current.pull = 0; setPull(0);
      }
    };
    const onEnd = async () => {
      if (st.current.startY == null) return;
      const reached = st.current.pull >= threshold;
      st.current.startY = null; st.current.pull = 0;
      if (!reached) { setPull(0); return; }
      setRefreshing(true); setPull(threshold);
      try { await cb.current?.(); }
      catch (e) { console.warn('pull-to-refresh failed:', e?.message); }
      finally { setRefreshing(false); setPull(0); }
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

  return { pull, refreshing };
}

import { useEffect, useRef } from 'react';

// Auto-hiding sticky bar: scroll DOWN hides it (slides up out of view), scroll
// UP brings it back, and near the very top it's always shown. Returns a ref to
// put on the bar; it toggles an `is-hidden` class DIRECTLY on the element (no
// React state), so the list never re-renders on scroll — the slide is a pure
// CSS transition. Capture phase + multi-candidate read so it works whatever the
// actual scroller is.
function scrollY() {
  return Math.max(
    window.scrollY || 0,
    document.scrollingElement?.scrollTop || 0,
    document.querySelector('.main')?.scrollTop || 0,
  );
}

// `downDelta` = how much down-scroll hides it (responsive). `upThreshold` = how
// far you must scroll UP (cumulative) before it slides back — kept larger so a
// tiny upward nudge doesn't immediately pop it down.
export function useHideOnScroll({ topThreshold = 72, downDelta = 6, upThreshold = 130 } = {}) {
  const ref = useRef(null);
  useEffect(() => {
    let lastY = scrollY();
    let hidden = false;
    let upAccum = 0; // accumulated upward movement since the last down-scroll
    const setHidden = (h) => {
      if (h === hidden) return;
      hidden = h;
      ref.current?.classList.toggle('is-hidden', h);
    };
    const onScroll = () => {
      const y = scrollY();
      const dy = y - lastY; // + down, - up
      lastY = y;
      if (y <= topThreshold) { setHidden(false); upAccum = 0; return; } // near top
      if (dy > 0) {                                  // scrolling down
        upAccum = 0;
        // Only hide once the bar has actually reached its sticky (notch)
        // position. On profile the tabs flow UNDER a tall identity header, so
        // before they stick they must scroll away naturally — never fly off
        // early. The bar is stuck when its top edge has caught the sticky line
        // (computed `top`, i.e. the safe-area inset). Bars that start at the
        // very top (the feed) stick immediately, so this is a no-op for them.
        if (dy > downDelta && !hidden) {
          const el = ref.current;
          const stickyTop = el ? (parseFloat(getComputedStyle(el).top) || 0) : 0;
          if (!el || el.getBoundingClientRect().top <= stickyTop + 1) setHidden(true);
        }
      } else if (dy < 0) {                            // scrolling up
        upAccum += -dy;
        if (upAccum > upThreshold) setHidden(false);
      }
    };
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [topThreshold, downDelta, upThreshold]);
  return ref;
}

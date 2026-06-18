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

export function useHideOnScroll({ topThreshold = 72, delta = 6 } = {}) {
  const ref = useRef(null);
  useEffect(() => {
    let lastY = scrollY();
    let hidden = false;
    const setHidden = (h) => {
      if (h === hidden) return;
      hidden = h;
      ref.current?.classList.toggle('is-hidden', h);
    };
    const onScroll = () => {
      const y = scrollY();
      if (y <= topThreshold) setHidden(false);      // always show near the top
      else if (y - lastY > delta) setHidden(true);  // scrolling down → hide
      else if (lastY - y > delta) setHidden(false); // scrolling up → show
      lastY = y;
    };
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [topThreshold, delta]);
  return ref;
}

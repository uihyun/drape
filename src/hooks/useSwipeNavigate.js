import { useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SWIPE_ROUTES } from '../services/swipeNav.js';

// Horizontal swipe on a detail hero → previous/next sibling in the list you
// came from. The originating list passes { swipe: { ids, i, type } } via router
// state (see services/swipeNav.js). No state (deep-link / refresh) → disabled,
// and the detail just behaves as a normal standalone page.
//
// Drag RIGHT (finger →) = previous; drag LEFT = next — standard carousel feel.
// Mirrors useSheetDrag's touch model, on the X axis, with an axis-lock so a
// vertical page scroll never gets hijacked into a navigation. Swipe nav uses
// replace:true so the back button still returns to the list, not each card
// you flicked through.

const COMMIT_PX = 64; // drag distance that commits a navigation

export function useSwipeNavigate() {
  const location = useLocation();
  const navigate = useNavigate();
  const ctx = location.state?.swipe || null;
  const ids = Array.isArray(ctx?.ids) ? ctx.ids : null;
  const index = typeof ctx?.i === 'number' ? ctx.i : -1;
  const type = ctx?.type;
  const route = type ? SWIPE_ROUTES[type] : null;
  const swipeable = !!(ids && ids.length > 1 && route && index >= 0);

  const atStart = swipeable && index <= 0;
  const atEnd = swipeable && index >= ids.length - 1;

  const startX = useRef(null);
  const startY = useRef(null);
  const axis = useRef(null); // 'x' | 'y' | null — locked on the first real move
  const [dx, setDx] = useState(0);

  const go = useCallback((dir) => {
    const next = index + dir;
    if (!ids || next < 0 || next >= ids.length) return;
    const id = ids[next];
    if (!id) return;
    navigate(route(id), { replace: true, state: { swipe: { ids, i: next, type } } });
  }, [ids, index, route, type, navigate]);

  const onTouchStart = (e) => {
    if (!swipeable) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    axis.current = null;
  };
  const onTouchMove = (e) => {
    if (!swipeable || startX.current === null) return;
    const mx = e.touches[0].clientX - startX.current;
    const my = e.touches[0].clientY - startY.current;
    if (axis.current === null) {
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      axis.current = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
    }
    if (axis.current !== 'x') return; // vertical scroll — leave it to the page
    // Rubber-band when there's nothing past this end.
    let v = mx;
    if ((mx > 0 && atStart) || (mx < 0 && atEnd)) v = mx * 0.32;
    setDx(v);
  };
  const onTouchEnd = () => {
    if (!swipeable) return;
    const moved = dx;
    const wasX = axis.current === 'x';
    setDx(0);
    startX.current = null;
    startY.current = null;
    axis.current = null;
    if (!wasX) return;
    if (moved > COMMIT_PX) go(-1);       // dragged right → previous
    else if (moved < -COMMIT_PX) go(1);  // dragged left → next
  };

  const bind = swipeable ? { onTouchStart, onTouchMove, onTouchEnd } : {};
  const style = {
    transform: dx ? `translateX(${dx}px)` : 'translateX(0)',
    transition: dx ? 'none' : 'transform 0.25s ease-out',
    touchAction: swipeable ? 'pan-y' : undefined,
  };

  return { swipeable, bind, style, atStart, atEnd, index, total: ids?.length ?? 0 };
}

import { useRef, useState, useCallback, useEffect } from 'react';

// Pinterest-style press-and-hold quick actions (mobile). Press a card, it
// lifts; a row of action buttons fades in; slide the still-pressed finger
// onto one and release to fire it, or release elsewhere / drag away to
// cancel. Plain pointer events — no dependency.
//
// Usage:
//   const lp = useLongPressQuickActions({ actions, onFire });
//   <div {...lp.bind} className={lp.active ? 'is-pressed' : ''}>
//     {children}
//     {lp.active && lp.renderOverlay()}
//   </div>
//
// `actions`: [{ key, icon, label }]. `onFire(key)` runs the chosen action.
// The hook only arms on touch/pen (mouse is ignored — desktop keeps the
// normal click/navigation).
const HOLD_MS = 320;
const MOVE_CANCEL_PX = 12; // finger drift before the hold counts as a scroll

export function useLongPressQuickActions({ actions = [], onFire, enabled = true }) {
  const [active, setActive] = useState(false);
  const [focusedKey, setFocusedKey] = useState(null);
  const timer = useRef(null);
  const startPt = useRef({ x: 0, y: 0 });
  const armed = useRef(false); // true once the hold fired (suppresses click)
  const btnRects = useRef([]); // [{ key, rect }]

  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const end = useCallback(() => {
    clearTimer();
    if (active && focusedKey) onFire?.(focusedKey);
    setActive(false);
    setFocusedKey(null);
    // Keep armed for one tick so the synthetic click after pointerup is
    // swallowed (we don't want to also navigate into the card).
    setTimeout(() => { armed.current = false; }, 0);
    btnRects.current = [];
  }, [active, focusedKey, onFire]);

  const onPointerDown = useCallback((e) => {
    if (!enabled || actions.length === 0) return;
    if (e.pointerType === 'mouse') return; // desktop: ignore
    startPt.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timer.current = setTimeout(() => {
      armed.current = true;
      setActive(true);
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch { /* noop */ } }
    }, HOLD_MS);
  }, [enabled, actions.length]);

  const onPointerMove = useCallback((e) => {
    if (!active) {
      // Before the hold fires: a real drag means the user is scrolling —
      // cancel the pending long-press.
      const dx = Math.abs(e.clientX - startPt.current.x);
      const dy = Math.abs(e.clientY - startPt.current.y);
      if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearTimer();
      return;
    }
    // While active: highlight whichever action the finger is over.
    e.preventDefault();
    let hit = null;
    for (const { key, rect } of btnRects.current) {
      if (e.clientX >= rect.left && e.clientX <= rect.right
        && e.clientY >= rect.top && e.clientY <= rect.bottom) { hit = key; break; }
    }
    setFocusedKey(hit);
  }, [active]);

  const onPointerUp = useCallback(() => { end(); }, [end]);
  const onPointerCancel = useCallback(() => {
    clearTimer();
    setActive(false);
    setFocusedKey(null);
    btnRects.current = [];
  }, []);

  // Swallow the click that fires right after a hold, so the card doesn't
  // also navigate.
  const onClickCapture = useCallback((e) => {
    if (armed.current) { e.preventDefault(); e.stopPropagation(); }
  }, []);

  useEffect(() => () => clearTimer(), []);

  // Called by each action button (via ref callback) to register its rect
  // for hit-testing.
  const registerButton = useCallback((key, el) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const existing = btnRects.current.find(b => b.key === key);
    if (existing) existing.rect = rect;
    else btnRects.current.push({ key, rect });
  }, []);

  return {
    active,
    focusedKey,
    registerButton,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture,
      style: { touchAction: active ? 'none' : 'pan-y' },
    },
  };
}

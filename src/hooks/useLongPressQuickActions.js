import { useRef, useState, useCallback, useEffect } from 'react';

// Press-and-hold quick actions (mobile). Hold a card → it lifts and floats
// action buttons; slide the still-pressed finger onto one and release to
// fire, or release elsewhere to cancel. A quick tap navigates normally.
//
// Reliability notes (why it's built this way):
//  • setPointerCapture on the card so we keep receiving move/up even when
//    the finger slides off the original element (onto a button) — without
//    this the gesture "drops" and feels broken.
//  • All gesture bookkeeping is in refs; React state (active/focused) is
//    only updated at meaningful transitions, so the card doesn't re-render
//    every pointermove (that caused the flicker).
//  • A pointermove threshold cancels the pending hold so a scroll never
//    accidentally arms it, and an armed hold suppresses the click so the
//    card doesn't also navigate.
//
// `actions`: [{ key, icon }]. `onFire(key)` runs the chosen action.
const HOLD_MS = 300;
const MOVE_CANCEL_PX = 14; // pre-hold finger drift = scroll → cancel

export function useLongPressQuickActions({ actions = [], onFire, enabled = true }) {
  const [active, setActive] = useState(false);
  const [focusedKey, setFocusedKey] = useState(null);

  const timer = useRef(null);
  const startPt = useRef({ x: 0, y: 0 });
  const armedRef = useRef(false);   // hold fired → suppress the click
  const activeRef = useRef(false);  // mirror of `active` for handlers
  const focusRef = useRef(null);    // mirror of focusedKey
  const elRef = useRef(null);       // the card element (for pointer capture)
  const captureId = useRef(null);
  const btnRects = useRef([]);      // [{ key, rect }]

  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const setActiveBoth = (v) => { activeRef.current = v; setActive(v); };
  const setFocusBoth = (v) => {
    if (focusRef.current === v) return; // avoid redundant re-renders (no flicker)
    focusRef.current = v;
    setFocusedKey(v);
  };

  const releaseCapture = () => {
    if (elRef.current && captureId.current != null) {
      try { elRef.current.releasePointerCapture(captureId.current); } catch { /* noop */ }
    }
    captureId.current = null;
  };

  const reset = useCallback(() => {
    clearTimer();
    releaseCapture();
    setActiveBoth(false);
    setFocusBoth(null);
    btnRects.current = [];
  }, []);

  const onPointerDown = useCallback((e) => {
    if (!enabled || actions.length === 0) return;
    if (e.pointerType === 'mouse') return; // desktop keeps normal click/nav
    elRef.current = e.currentTarget;
    startPt.current = { x: e.clientX, y: e.clientY };
    armedRef.current = false;
    clearTimer();
    timer.current = setTimeout(() => {
      armedRef.current = true;
      // Capture so finger moves onto the floating buttons still reach us.
      try { e.currentTarget.setPointerCapture(e.pointerId); captureId.current = e.pointerId; } catch { /* noop */ }
      setActiveBoth(true);
      if (navigator.vibrate && navigator.userActivation?.isActive) {
        try { navigator.vibrate(8); } catch { /* noop */ }
      }
    }, HOLD_MS);
  }, [enabled, actions.length]);

  const onPointerMove = useCallback((e) => {
    if (!activeRef.current) {
      const dx = Math.abs(e.clientX - startPt.current.x);
      const dy = Math.abs(e.clientY - startPt.current.y);
      if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearTimer(); // it's a scroll
      return;
    }
    e.preventDefault();
    let hit = null;
    for (const { key, rect } of btnRects.current) {
      if (e.clientX >= rect.left && e.clientX <= rect.right
        && e.clientY >= rect.top && e.clientY <= rect.bottom) { hit = key; break; }
    }
    setFocusBoth(hit);
  }, []);

  const onPointerUp = useCallback(() => {
    const wasActive = activeRef.current;
    const chosen = focusRef.current;
    reset();
    if (wasActive && chosen) onFire?.(chosen);
    // Keep `armed` true through the synthetic click that follows, then drop.
    if (wasActive) setTimeout(() => { armedRef.current = false; }, 0);
  }, [reset, onFire]);

  const onPointerCancel = useCallback(() => { reset(); }, [reset]);
  const onContextMenu = useCallback((e) => { e.preventDefault(); }, []);
  const onClickCapture = useCallback((e) => {
    if (armedRef.current) { e.preventDefault(); e.stopPropagation(); }
  }, []);

  useEffect(() => () => { clearTimer(); }, []);

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
      onContextMenu,
      onClickCapture,
      draggable: false,
      style: { touchAction: 'pan-y', WebkitTouchCallout: 'none' },
    },
  };
}

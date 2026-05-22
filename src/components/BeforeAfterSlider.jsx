import { useCallback, useEffect, useRef, useState } from 'react';

// Drag-handle Before/After image comparator (Phase 10-5).
// No library — uses CSS `clip-path: inset(...)` on the after image so both
// images stay the same size and the visible slice always lines up.
//
// Convention: when the handle is at 50%, the LEFT half shows the AFTER image
// (new design) and the RIGHT half shows the BEFORE image (original photo).
export function BeforeAfterSlider({ beforeSrc, afterSrc, beforeLabel, afterLabel, alt = '' }) {
  const containerRef = useRef(null);
  const draggingRef = useRef(false);
  const [percent, setPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  // Match container to the natural image aspect so portrait/square shots
  // aren't cropped to a forced 4:3 box (CSS default). AI preserves input
  // aspect, so before/after match; whichever <img> reports natural size
  // first wins. The other one is identical so the slider reveal still
  // aligns pixel-for-pixel.
  const [aspectRatio, setAspectRatio] = useState(null);
  const handleAspectFromImg = useCallback((e) => {
    if (aspectRatio) return;
    const img = e.target;
    if (img.naturalWidth && img.naturalHeight) {
      setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
    }
  }, [aspectRatio]);

  const updateFromClientX = useCallback((clientX) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.max(0, Math.min(100, next)));
  }, []);

  // Direction-aware pointer flow — defers capture until we know the user
  // intends a horizontal drag, so vertical swipes pass through to the page
  // scroll. Paired with `touch-action: pan-y` in CSS so the browser handles
  // vertical scrolling natively before our handlers even need to decide.
  const startRef = useRef(null); // { x, y, decided }
  const DIRECTION_THRESHOLD = 6; // px before we commit to an axis

  const handlePointerDown = (e) => {
    startRef.current = { x: e.clientX, y: e.clientY, decided: false };
    // No setPointerCapture / setIsDragging yet — wait for direction.
  };
  const handlePointerMove = (e) => {
    const s = startRef.current;
    if (!s) return;
    if (!s.decided) {
      const dx = Math.abs(e.clientX - s.x);
      const dy = Math.abs(e.clientY - s.y);
      if (dx < DIRECTION_THRESHOLD && dy < DIRECTION_THRESHOLD) return;
      if (dy > dx) {
        // Vertical intent — release to browser scroll, abort gesture.
        startRef.current = null;
        return;
      }
      // Horizontal — commit.
      s.decided = true;
      draggingRef.current = true;
      setIsDragging(true);
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    }
    updateFromClientX(e.clientX);
  };
  const handlePointerUp = (e) => {
    const s = startRef.current;
    // Tap (no movement, never committed) → jump slider to clicked x.
    if (s && !s.decided) updateFromClientX(e.clientX);
    draggingRef.current = false;
    setIsDragging(false);
    startRef.current = null;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
  };
  const handlePointerCancel = (e) => {
    // Browser took over (e.g. scroll) — reset everything.
    draggingRef.current = false;
    setIsDragging(false);
    startRef.current = null;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
  };

  // Keyboard support — focus the handle and use ←/→. 5% steps, 1% with Shift.
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPercent(p => Math.max(0, p - (e.shiftKey ? 1 : 5)));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPercent(p => Math.min(100, p + (e.shiftKey ? 1 : 5)));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setPercent(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setPercent(100);
    }
  };

  // Cancel drag if the window loses focus mid-drag.
  useEffect(() => {
    const cancel = () => { draggingRef.current = false; };
    window.addEventListener('blur', cancel);
    return () => window.removeEventListener('blur', cancel);
  }, []);

  return (
    <div
      ref={containerRef}
      className="ba-slider"
      style={aspectRatio ? { aspectRatio } : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <img
        src={beforeSrc}
        alt={alt ? `${alt} — before` : 'Before'}
        className="ba-img"
        draggable={false}
        onLoad={handleAspectFromImg}
      />
      <img
        src={afterSrc}
        alt={alt ? `${alt} — after` : 'After'}
        className={`ba-img ba-img-after ${isDragging ? 'ba-no-transition' : ''}`}
        draggable={false}
        onLoad={handleAspectFromImg}
        style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
      />

      {/* 슬라이더가 양쪽 끝에 있을 때 — 보이지 않는 쪽 이미지의 라벨도 hide.
         percent=0 (전체 Original) → AI Design 라벨 hide.
         percent=100 (전체 AI Design) → Original 라벨 hide. */}
      {beforeLabel && percent < 100 && <span className="ba-label ba-label-before">{beforeLabel}</span>}
      {afterLabel && percent > 0 && <span className="ba-label ba-label-after">{afterLabel}</span>}

      <div
        role="slider"
        aria-label="Before / After comparison"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        tabIndex={0}
        className={`ba-handle ${isDragging ? 'ba-no-transition' : ''}`}
        style={{ left: `${percent}%` }}
        onKeyDown={handleKeyDown}
      >
        <div className="ba-handle-line" />
        <div className="ba-handle-knob">
          <i className="material-icons">chevron_left</i>
          <i className="material-icons">chevron_right</i>
        </div>
      </div>
    </div>
  );
}

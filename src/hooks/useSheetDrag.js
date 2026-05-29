import { useRef, useState } from 'react';

// Returns handlers for the drag-handle bar of a bottom sheet.
// Attach `handleProps` to the `.create-sheet-handle` div and
// `sheetStyle` to the `.create-sheet` panel so dragging down
// (threshold 80px) closes the sheet; releasing early springs back.
export function useSheetDrag(onClose) {
  const startY = useRef(null);
  const [dy, setDy] = useState(0);

  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setDy(delta);
  };

  const onTouchEnd = () => {
    if (dy > 80) onClose();
    setDy(0);
    startY.current = null;
  };

  return {
    sheetStyle: {
      transform: dy > 0 ? `translateY(${dy}px)` : 'translateY(0)',
      transition: dy > 0 ? 'none' : 'transform 0.2s ease-out',
      willChange: 'transform',
    },
    handleProps: { onTouchStart, onTouchMove, onTouchEnd },
  };
}

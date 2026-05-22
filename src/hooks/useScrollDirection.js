import { useState, useEffect, useRef } from 'react';

// Instagram·TikTok 식 scroll-aware nav 패턴 — 화면 내릴 때 'down' / 위로 올릴 때
// 'up' / 화면 최상단 근처는 'top'. 호출 측은 'down' 일 때 헤더 숨기고 그 외엔
// 노출. RAF throttle 로 scroll spam 회피, threshold 미만 미세 떨림은 무시.
export function useScrollDirection({ threshold = 8, topOffset = 64 } = {}) {
  const [direction, setDirection] = useState('top');
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const update = () => {
      const y = window.scrollY;
      if (y < topOffset) {
        setDirection('top');
      } else {
        const delta = y - lastY.current;
        if (Math.abs(delta) >= threshold) {
          setDirection(delta > 0 ? 'down' : 'up');
        }
      }
      lastY.current = y;
      ticking.current = false;
    };
    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(update);
        ticking.current = true;
      }
    };
    lastY.current = window.scrollY;
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold, topOffset]);

  return direction;
}

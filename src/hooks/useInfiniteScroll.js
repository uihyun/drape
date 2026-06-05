import { useEffect, useRef } from 'react';

// Attach the returned ref to a sentinel element at the bottom of a list.
// When it scrolls into view (400px early) and there's more to load and we're
// not already loading, onLoadMore() fires. Disconnects when there's no more.
export function useInfiniteScroll({ hasMore, loading, onLoadMore }) {
  const sentinelRef = useRef(null);
  const cbRef = useRef(onLoadMore);
  cbRef.current = onLoadMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) cbRef.current?.();
    }, { rootMargin: '400px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading]);

  return sentinelRef;
}

export default useInfiniteScroll;

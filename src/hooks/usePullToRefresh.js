import { useEffect, useRef, useState } from 'react';

export default function usePullToRefresh(onRefresh, containerRef) {
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const threshold = 70;

  useEffect(() => {
    const el = containerRef?.current || window;
    const isWindow = el === window;

    const getScrollTop = () => isWindow ? window.scrollY : el.scrollTop;

    const onTouchStart = (e) => {
      if (getScrollTop() <= 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const onTouchEnd = async (e) => {
      if (startY.current === null) return;
      const dy = e.changedTouches[0].clientY - startY.current;
      startY.current = null;
      if (dy > threshold && !refreshing) {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh, refreshing]);

  return refreshing;
}
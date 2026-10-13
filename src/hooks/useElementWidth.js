import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Bề rộng thật (px) của 1 phần tử, cập nhật khi đổi kích thước — để vẽ SVG đúng pixel
 * (chữ trong biểu đồ không bị co giãn theo viewBox). Phần tử bị ẩn (display: none) cho 0.
 */
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

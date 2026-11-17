import { useEffect, useLayoutEffect } from 'react';

/**
 * Vỏ của popover nổi: bấm ra ngoài / Esc thì đóng; nếu là position: fixed thì đẩy vào trong màn hình
 * (chỉ lúc mở — muốn tính lại thì đổi `key` cho popover mount lại).
 */
export function usePopoverShell(ref, onClose) {
  useEffect(() => {
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
  }, [ref, onClose]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || getComputedStyle(el).position !== 'fixed') return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) el.style.top = `${Math.max(8, window.innerHeight - r.height - 8)}px`;
    if (r.right > window.innerWidth - 8) el.style.left = `${Math.max(8, window.innerWidth - r.width - 8)}px`;
  }, [ref]);
}

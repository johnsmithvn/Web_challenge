import { useEffect, useLayoutEffect } from 'react';

const M = 8; // lề tối thiểu với mép màn hình

// Phần tử vừa bấm (nút mở popover): các nơi gọi chỉ truyền top = đáy nút + khoảng hở, nên hook tự nhớ nút
// để lật popover lên TRÊN nút khi bên dưới không đủ chỗ (thay vì đẩy lên đè lên chính nút).
let lastDown = null;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { lastDown = e.target; }, true);
}

/**
 * Vỏ của popover nổi: bấm ra ngoài / Esc thì đóng; nếu là position: fixed thì giữ trong màn hình:
 * - Dưới nút không đủ chỗ → lật lên trên nút (neo đáy, nên cao thêm thì mọc lên); không đủ cả hai → sát mép dưới.
 * - Theo dõi kích thước (ResizeObserver): bấm "Thêm giờ", đổi tháng 5→6 hàng… vẫn không tràn mép.
 * - Chỉ khi cao hơn cả màn hình mới cho cuộn bên trong (màn rất thấp).
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
    if (!el || getComputedStyle(el).position !== 'fixed') return undefined;
    const top0 = parseFloat(el.style.top);
    const left0 = parseFloat(el.style.left);
    if (Number.isNaN(top0)) return undefined; // nơi gọi tự neo theo bottom → để nguyên

    // Nút mở: phần tử vừa bấm có đáy ngay trên mép trên popover
    const btn = lastDown?.closest?.('button, [role="button"], a') || lastDown;
    const ar = btn?.isConnected ? btn.getBoundingClientRect() : null;
    const gap = ar ? top0 - ar.bottom : 0;
    const anchor = ar && gap >= -2 && gap <= 24 ? ar : null;

    let side = null; // 'below' | 'above' — chọn một lần lúc mở để popover không nhảy qua lại
    const place = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      // Chiều cao thật của nội dung (kể cả khi đang bị maxHeight cắt) — không reset style để ResizeObserver không lặp
      const h = el.scrollHeight + el.offsetHeight - el.clientHeight;
      const w = el.offsetWidth;

      if (!side) {
        const fitsBelow = top0 + h <= vh - M;
        const fitsAbove = anchor && anchor.top - gap - h >= M;
        side = !fitsBelow && fitsAbove ? 'above' : 'below';
      }
      if (side === 'above' && anchor.top - gap - h >= M) {
        el.style.top = 'auto';
        el.style.bottom = `${vh - (anchor.top - gap)}px`;
      } else {
        el.style.bottom = '';
        el.style.top = `${Math.max(M, Math.min(top0, vh - h - M))}px`;
      }
      const tooTall = h > vh - 2 * M;
      if (tooTall) {
        el.style.top = `${M}px`;
        el.style.bottom = '';
      }
      el.style.maxHeight = tooTall ? `${vh - 2 * M}px` : '';
      el.style.overflowY = tooTall ? 'auto' : '';
      el.style.overscrollBehavior = tooTall ? 'contain' : '';
      el.style.scrollbarWidth = tooTall ? 'thin' : '';
      if (!Number.isNaN(left0)) el.style.left = `${Math.max(M, Math.min(left0, vw - w - M))}px`;
    };

    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [ref]);
}

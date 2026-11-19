import { useEffect, useId, useRef } from 'react';
import AppIcon from '../AppIcon';

/**
 * Khung hộp thoại của Chốn: điện thoại = bottom sheet, máy tính = hộp thoại giữa màn (`size` quyết định độ rộng).
 * Nền đặc --chon-pop (không backdrop-filter: trời phía sau chuyển động). Esc / bấm nền mờ = đóng,
 * mở thì focus ô đầu tiên (hoặc phần tử có [data-autofocus]), đóng thì trả focus về chỗ cũ.
 * Dựng riêng thay GenericModal vì cần bottom sheet + đầu / chân tuỳ biến theo mockup 2B / 2D
 * (giống Body có body-modal-panel riêng) — ghi ở DESIGN.md mục Chốn.
 */
export default function ChonSheet({ title, subtitle, onClose, footer, children, size = 'md', className = '', hideHeader = false, label }) {
  const panelRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const prev = document.activeElement;
    const panel = panelRef.current;
    const target = panel?.querySelector('[data-autofocus]')
      || panel?.querySelector('input:not([type="hidden"]), textarea, select, button:not(.chon-sheet__close)');
    target?.focus();
    return () => { if (prev && typeof prev.focus === 'function') prev.focus(); };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        // Popover con (lịch, menu) tự đóng trước; chỉ đóng sheet khi Esc chưa bị ai nhận.
        if (e.defaultPrevented) return;
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="chon-sheet-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section
        ref={panelRef}
        className={`chon-sheet chon-sheet--${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hideHeader ? undefined : titleId}
        aria-label={hideHeader ? (label || title) : undefined}
      >
        <span className="chon-sheet__grip" aria-hidden="true" />
        {!hideHeader && (
          <header className="chon-sheet__head">
            <div className="chon-sheet__titles">
              <h2 id={titleId} className="chon-sheet__title">{title}</h2>
              {subtitle && <p className="chon-sheet__sub">{subtitle}</p>}
            </div>
            <button type="button" className="chon-icon-btn chon-sheet__close" onClick={onClose} aria-label="Đóng">
              <AppIcon name="x" size={18} />
            </button>
          </header>
        )}
        <div className="chon-sheet__body">{children}</div>
        {footer && <footer className="chon-sheet__foot">{footer}</footer>}
      </section>
    </div>
  );
}

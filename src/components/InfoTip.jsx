import { useState, useEffect, useRef } from 'react';
import '../styles/infotip.css';
import AppIcon from './AppIcon';

/**
 * InfoTip — nút "?" mở bong bóng chú thích.
 *
 * Dùng cho những đoạn giải thích DÀI mà app vẫn cần nói (cách một con số được tính,
 * vì sao một khoản không vào tổng chi): để nguyên trong layout thì nó thành một khối
 * chữ nhỏ dày đặc chen giữa các con số, đọc mệt mà vẫn chiếm chỗ mỗi lần mở màn.
 * Bấm mới hiện thì chữ vẫn còn đó cho người cần, còn màn hình thì gọn.
 *
 * KHÔNG dùng `title` HTML thay cho cái này: title không mở được bằng cảm ứng, không
 * đọc được bằng bàn phím và không xuống dòng.
 *
 * @param children — nội dung chú thích (chuỗi hoặc JSX).
 * @param label — nhãn cho screen reader / tooltip hệ thống.
 * @param align — 'left' (mặc định) mở sang phải, 'right' mở sang trái khi nút nằm sát lề.
 */
export default function InfoTip({ children, label = 'Xem giải thích', align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <span className="infotip" ref={ref}>
      {/* type="button" là BẮT BUỘC: component này hay nằm trong <form>, thiếu nó thì
          bấm xem chú thích lại submit form (đúng lỗi đã gặp ở DatePickerPopover). */}
      <button type="button" className={`infotip__btn${open ? ' is-open' : ''}`}
        aria-expanded={open} aria-label={label} title={label}
        onClick={() => setOpen(o => !o)}>
        <AppIcon name="question" size={11} weight="bold" />
      </button>
      {open && (
        <span className={`infotip__bubble infotip__bubble--${align}`} role="note">{children}</span>
      )}
    </span>
  );
}

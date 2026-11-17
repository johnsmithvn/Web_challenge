import { Fragment, useEffect, useRef } from 'react';
import AppIcon from './AppIcon';
import { usePopoverShell } from '../hooks/usePopoverShell';
import '../styles/action-menu.css';

/**
 * ActionMenu — menu thao tác nổi (nút ⋯ hoặc chuột phải), dùng chung cả app.
 * `at`: { x, y } toạ độ màn hình của góc trên trái; tự đẩy vào trong màn hình khi sát mép.
 * `items`: [{ key, icon, label, onSelect, danger, divider, sub, keepOpen, checked }] hoặc { key, heading, divider }
 *   icon: tên AppIcon hoặc phần tử (vd chấm màu) · divider: vạch ngăn trước mục · sub: có bước con (hiện ›,
 *   không đóng menu) · keepOpen: bấm không đóng menu (vd quay lại, bật / tắt bộ lọc) · checked (true / false): mục
 *   bật / tắt, true hiện ✓ cuối dòng · heading: nhãn nhóm, không bấm được.
 * Render tại chỗ (không portal) để ăn token của module; màu qua --am-* (module map ở CSS của mình).
 * Đổi bước con thì đổi `key` cho menu mount lại — để đo lại vị trí và focus mục đầu.
 */
export default function ActionMenu({ at, items, onClose, label }) {
  const ref = useRef(null);
  usePopoverShell(ref, onClose);
  useEffect(() => { ref.current?.querySelector('button')?.focus(); }, []);

  return (
    <div
      ref={ref}
      className="action-menu"
      role="menu"
      aria-label={label}
      style={{ left: at.x, top: at.y }}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map(it => (
        <Fragment key={it.key}>
          {it.divider && <div className="action-menu__sep" role="separator" />}
          {it.heading ? <div className="action-menu__head">{it.heading}</div> : (
          <button
            type="button"
            role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={it.checked}
            className={`action-menu__item${it.danger ? ' is-danger' : ''}`}
            onClick={() => {
              if (!it.sub && !it.keepOpen) onClose();
              it.onSelect();
            }}
          >
            {typeof it.icon === 'string' ? <AppIcon name={it.icon} size={16} /> : it.icon}
            <span className="action-menu__label">{it.label}</span>
            {it.sub && <AppIcon name="caretRight" size={12} className="action-menu__end" />}
            {it.checked && <AppIcon name="check" size={14} className="action-menu__end" />}
          </button>
          )}
        </Fragment>
      ))}
    </div>
  );
}

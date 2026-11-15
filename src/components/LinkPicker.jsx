import { useState, useEffect, useRef } from 'react';
import AppIcon from './AppIcon';
import '../styles/link-picker.css';

/**
 * LinkPicker — popover gắn / bỏ liên kết task ↔ bài viết, dùng ở hai phía:
 * ngăn chi tiết task (chọn bài) và cột phải trang đọc Kiến thức (chọn việc).
 * Ô tìm + nhóm (vd Đã gắn / Gợi ý / Gần đây), bấm dòng để gắn hoặc bỏ, dòng cuối tạo mới.
 * ↑↓ chọn · Enter gắn / bỏ · Esc đóng. Khung `.tk-popover` + token --tk-* (date-popover.css); Kiến thức map
 * token sang --kb-* ở collect.css. Đặt cố định theo nút mở, tự lật lên trên khi dưới không đủ chỗ.
 *
 * groups: [{ key, label, items: [{ id, title, meta?, metaTone?: 'late', dot?, linked }] }]
 */
const W = 420;

function place(anchorEl) {
  const r = anchorEl.getBoundingClientRect();
  const width = Math.min(W, window.innerWidth - 24);
  const left = Math.min(Math.max(12, r.left), window.innerWidth - width - 12);
  const below = window.innerHeight - r.bottom;
  return below >= 360 || below >= r.top
    ? { position: 'fixed', left, width, top: r.bottom + 6, maxHeight: below - 18 }
    : { position: 'fixed', left, width, bottom: window.innerHeight - r.top + 6, maxHeight: r.top - 18 };
}

export default function LinkPicker({ anchorEl, label, placeholder, groups, query, onQuery, onToggle, createLabel, onCreate, emptyText, onClose }) {
  const [style] = useState(() => place(anchorEl));
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const listRef = useRef(null);

  const rows = groups.flatMap((g) => g.items);
  // Vị trí dòng đầu của mỗi nhóm trong `rows` (đánh số cho ↑↓)
  const starts = groups.reduce((acc, g, k) => [...acc, k ? acc[k - 1] + groups[k - 1].items.length : 0], []);
  const count = rows.length + (onCreate ? 1 : 0);
  const cur = count ? Math.min(active, count - 1) : -1;

  // Bấm ra ngoài thì đóng (trừ chính nút mở — nút đó tự bật / tắt)
  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current?.contains(e.target) || anchorEl.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [anchorEl, onClose]);

  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [cur]);

  const pick = (i) => (i < rows.length ? onToggle(rows[i]) : onCreate?.());

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      // Không để Esc lọt ra ngăn task / trang đọc (chúng cũng đóng bằng Esc)
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (count) setActive((cur + (e.key === 'ArrowDown' ? 1 : -1) + count) % count);
    } else if (e.key === 'Enter' && cur >= 0) {
      e.preventDefault();
      pick(cur);
    }
  };

  return (
    <div ref={boxRef} className="tk-popover tk-linkpick" style={style} role="dialog" aria-label={label} onKeyDown={onKeyDown}>
      <label className="tk-linkpick__search">
        <AppIcon name="search" size={15} />
        <input
          autoFocus
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => {
            onQuery(e.target.value);
            setActive(0);
          }}
        />
        <kbd>Esc</kbd>
      </label>

      <div ref={listRef} className="tk-linkpick__list">
        {rows.length === 0 && <p className="tk-linkpick__empty">{emptyText}</p>}
        {groups.map((g, gi) => g.items.length > 0 && (
          <div key={g.key} role="group" aria-label={g.label}>
            <div className="tk-linkpick__group">{g.label}</div>
            {g.items.map((it, ii) => {
              const idx = starts[gi] + ii;
              return (
                <button
                  key={it.id}
                  type="button"
                  aria-pressed={it.linked}
                  className={`tk-linkpick__row${idx === cur ? ' is-active' : ''}`}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => pick(idx)}
                >
                  <span className={`tk-linkpick__check${it.linked ? ' is-on' : ''}`}>
                    {it.linked && <AppIcon name="check" size={11} weight="bold" />}
                  </span>
                  <span className="tk-linkpick__text">
                    <span className="tk-linkpick__title">{it.title || '(Không tiêu đề)'}</span>
                    {it.meta && (
                      <span className={`tk-linkpick__meta${it.metaTone ? ` is-${it.metaTone}` : ''}`}>
                        {it.dot && <span className="tk-linkpick__dot" style={{ background: it.dot }} />}
                        {it.meta}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {onCreate && (
        <button
          type="button"
          className={`tk-linkpick__create${cur === rows.length ? ' is-active' : ''}`}
          onMouseEnter={() => setActive(rows.length)}
          onClick={onCreate}
        >
          <AppIcon name="plus" size={14} />
          <span>{createLabel}</span>
        </button>
      )}
      <div className="tk-linkpick__keys" aria-hidden="true">
        <span>↑↓ chọn</span><span>Enter gắn / bỏ</span><span>Esc đóng</span>
      </div>
    </div>
  );
}

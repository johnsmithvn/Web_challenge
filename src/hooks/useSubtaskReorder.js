import { useEffect, useRef, useState } from 'react';
import { dropIndexAt, reorderByDrag } from '../utils/subtaskUtils';

/**
 * useSubtaskReorder — kéo thả sắp xếp việc con bằng Pointer Events (chuột + cảm ứng; HTML5
 * drag-and-drop không chạy trên mobile). Nhấn tay nắm rồi kéo dọc (quá 4px mới tính là kéo),
 * thả → `onReorder(danh sách mới)`. Thứ tự luôn giữ nhóm ưu tiên (`reorderByDrag`): kéo quá
 * ranh giới nhóm thì dừng ở đầu/cuối nhóm, vạch thả hiện đúng chỗ việc con sẽ rơi vào.
 * Bàn phím: Alt + ↑/↓ trên tay nắm.
 *
 * `list` = đủ việc con đã xếp (sortSubtasks), kể cả phần bị ẩn sau "Xem thêm" — hàng hiển thị
 * là đoạn đầu nên index trùng nhau và sort_order đánh lại đủ cả danh sách.
 * rowProps(i) gắn vào hàng (đo vị trí, `data-drag="self|before|after"` cho CSS);
 * handleProps(i) gắn vào nút tay nắm.
 */
export default function useSubtaskReorder(list, onReorder) {
  const [drag, setDrag] = useState(null); // { from, to, dy } khi đang kéo
  const rows = useRef([]);
  const stopRef = useRef(null);
  useEffect(() => () => stopRef.current?.(), []);

  const commit = (from, to) => {
    const next = reorderByDrag(list, from, to);
    if (next.some((s, k) => s !== list[k])) onReorder(next);
  };

  const mids = () => rows.current.map((el) => {
    if (!el) return Infinity;
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  });

  const landing = drag ? reorderByDrag(list, drag.from, drag.to).indexOf(list[drag.from]) : -1;

  const rowProps = (i) => {
    let state;
    if (drag?.from === i) state = 'self';
    else if (i === landing) state = landing < drag.from ? 'before' : 'after';
    return {
      ref: (el) => { rows.current[i] = el; },
      'data-drag': state,
      style: drag?.from === i ? { transform: `translateY(${drag.dy}px)` } : undefined,
    };
  };

  const handleProps = (i) => ({
    // Tay nắm là nguồn kéo HTML5 rồi huỷ ngay → thẻ Kanban bọc ngoài (draggable) không bị kéo theo
    draggable: true,
    onDragStart: (e) => { e.preventDefault(); e.stopPropagation(); },
    // Không để vuốt ngang đổi cột của Kanban mobile bắt nhầm
    onTouchStart: (e) => e.stopPropagation(),
    onPointerDown: (e) => {
      if (e.button !== 0 || list.length < 2) return;
      stopRef.current?.();
      const y0 = e.clientY;
      let moved = false;
      const move = (ev) => {
        const dy = ev.clientY - y0;
        if (!moved && Math.abs(dy) < 4) return;
        moved = true;
        setDrag({ from: i, to: dropIndexAt(mids(), i, ev.clientY), dy });
      };
      const stop = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', stop);
        stopRef.current = null;
        setDrag(null);
      };
      const up = (ev) => {
        const to = dropIndexAt(mids(), i, ev.clientY);
        stop();
        if (!moved) return;
        // Thả ngoài hàng thì click rơi vào khung bọc (thẻ Kanban) → nuốt để không mở ngăn chi tiết
        const swallow = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
        commit(i, to);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', stop);
      stopRef.current = stop;
    },
    onKeyDown: (e) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      e.stopPropagation();
      const to = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (to >= 0 && to < list.length) commit(i, to);
    },
  });

  return { dragging: drag !== null, rowProps, handleProps };
}

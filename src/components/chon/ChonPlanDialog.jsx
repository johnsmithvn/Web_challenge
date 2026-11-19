import { useRef } from 'react';
import DatePickerPopover from '../DatePickerPopover';
import { useUserTasks } from '../../hooks/useUserTasks';
import { toDateStr } from '../../utils/dateUtils';

/**
 * Hẹn ngày đi một chốn → việc "Đi <tên chốn>" bên Nhiệm vụ (hạn = ngày chọn, giờ tuỳ chọn).
 * useUserTasks chỉ mount khi hộp này mở (docs/PLAN_CHON.md §5) để trang Chốn không tải cả danh sách việc
 * lúc vào. Đang có hẹn chưa xong → DỜI việc đó (updateTask, giữ tên user có thể đã sửa), không tạo việc trùng;
 * chưa hẹn / hẹn cũ đã xong → tạo việc mới.
 *
 * @param {(task) => Promise<void>} onPlanned — task: { id, title, due_date, due_time, completed, moved }
 */
export default function ChonPlanDialog({ place, onPlanned, onError, onClose }) {
  const { addTask, updateTask } = useUserTasks();
  const picked = useRef({ date: '', time: '', saved: false, busy: false });
  const open = place.plan_task && !place.plan_task.completed ? place.plan_task : null;

  const finish = async () => {
    const { date, time, saved, busy } = picked.current;
    if (busy) return;                                   // bấm Lưu hai lần nhanh → chỉ một việc
    if (!saved || !date) { onClose(); return; }
    picked.current.busy = true;
    const dueTime = time || null;

    if (open) {
      const ok = await updateTask(open.id, { due_date: date, due_time: dueTime });
      if (!ok) { onError?.('Chưa dời được việc bên Nhiệm vụ. Thử lại.'); onClose(); return; }
      await onPlanned({ ...open, due_date: date, due_time: dueTime, completed: false, moved: true });
      onClose();
      return;
    }

    const title = `Đi ${place.name}`;
    const task = await addTask({ title, dueDate: date, dueTime, description: place.address || '' });
    if (!task?.id) { onError?.('Chưa tạo được việc bên Nhiệm vụ. Thử lại.'); onClose(); return; }
    await onPlanned({ id: task.id, title, due_date: date, due_time: dueTime, completed: false });
    onClose();
  };

  return (
    <div className="chon-sheet-backdrop chon-plan" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chon-plan__box" role="dialog" aria-modal="true" aria-label={`Hẹn ngày đi ${place.name}`}>
        <p className="chon-plan__title">{open ? 'Dời ngày đi' : 'Hẹn ngày đi'} <strong>{place.name}</strong></p>
        <p className="chon-plan__sub">
          {open ? `Sẽ dời việc “${open.title}” bên Nhiệm vụ.` : `Sẽ thêm việc “Đi ${place.name}” vào Nhiệm vụ.`}
        </p>
        <div className="chon-plan__picker">
          <DatePickerPopover
            value={open?.due_date || toDateStr()}
            onChange={d => { picked.current.date = d; picked.current.saved = true; }}
            timeValue={open?.due_time ? open.due_time.slice(0, 5) : ''}
            onTimeChange={t => { picked.current.time = t; }}
            onClose={finish}
            label="Giờ đi"
            style={{ position: 'static' }}
          />
        </div>
      </div>
    </div>
  );
}

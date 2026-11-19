import { useRef } from 'react';
import DatePickerPopover from '../DatePickerPopover';
import { useUserTasks } from '../../hooks/useUserTasks';
import { toDateStr } from '../../utils/dateUtils';

/**
 * Hẹn ngày đi một chốn → tạo việc "Đi <tên chốn>" bên Nhiệm vụ (hạn = ngày chọn, giờ tuỳ chọn).
 * useUserTasks chỉ mount khi hộp này mở (docs/PLAN_CHON.md §5) để trang Chốn không tải cả danh sách việc
 * lúc vào. Đã có hẹn thì ngày cũ hiện sẵn; việc cũ giữ nguyên bên Nhiệm vụ, chốn trỏ sang việc mới.
 *
 * @param {(task) => Promise<void>} onPlanned — task: { id, title, due_date, completed }
 */
export default function ChonPlanDialog({ place, onPlanned, onError, onClose }) {
  const { addTask } = useUserTasks();
  const picked = useRef({ date: '', time: '', saved: false });
  const current = place.plan_task?.completed ? '' : (place.plan_task?.due_date || '');

  const finish = async () => {
    const { date, time, saved } = picked.current;
    if (!saved || !date) { onClose(); return; }
    const title = `Đi ${place.name}`;
    const task = await addTask({ title, dueDate: date, dueTime: time || null, description: place.address || '' });
    if (!task?.id) { onError?.('Chưa tạo được việc bên Nhiệm vụ. Thử lại.'); onClose(); return; }
    await onPlanned({ id: task.id, title, due_date: date, completed: false });
    onClose();
  };

  return (
    <div className="chon-sheet-backdrop chon-plan" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chon-plan__box" role="dialog" aria-modal="true" aria-label={`Hẹn ngày đi ${place.name}`}>
        <p className="chon-plan__title">Hẹn ngày đi <strong>{place.name}</strong></p>
        <p className="chon-plan__sub">Sẽ thêm việc “Đi {place.name}” vào Nhiệm vụ.</p>
        <div className="chon-plan__picker">
          <DatePickerPopover
            value={current || toDateStr()}
            onChange={d => { picked.current.date = d; picked.current.saved = true; }}
            timeValue=""
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

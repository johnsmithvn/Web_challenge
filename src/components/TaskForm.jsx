import { useState, useId } from 'react';
import DatePickerPopover from './DatePickerPopover';
import PriorityPicker from './PriorityPicker';
import TagPicker from './TagPicker';
import AppIcon from './AppIcon';
import { WEEKDAYS } from '../utils/taskFields';
import { toDateStr } from '../utils/dateUtils';
import { timeToMinutes } from '../utils/calendarTimeUtils';
import '../styles/tasks.css';

const REC_TYPES = [
  { key: 'interval', label: 'Mỗi N ngày' },
  { key: 'weekly', label: 'Hàng tuần' },
  { key: 'monthly', label: 'Hàng tháng' },
];

/**
 * TaskForm — form tạo/sửa Task DUY NHẤT (thay 4 bản copy trước đây):
 *   - TaskListSection: form thêm đầu Danh sách + form sửa (trong hàng & trong popup Chi tiết)
 *   - TasksPage: form sửa trong popup Chi tiết mở từ Kanban/Lịch
 *   - TaskCreateModal: tạo từ Lịch/Kanban
 * Field mới của Task chỉ thêm ở đây.
 *
 * Không tự ghi DB: trả payload snake_case (đúng cột user_tasks) + tagIds qua
 * `onSubmit`; nơi gọi tự chọn addTask/updateTask và đồng bộ tag.
 *
 * Thêm nhanh: tiêu đề tự focus, Enter ở ô tiêu đề là lưu (submit native của
 * <form>), Ctrl/Cmd+Enter lưu từ bất kỳ ô nào. Escape do modal bọc ngoài xử lý.
 */
export default function TaskForm({
  task,          // có = sửa, không có = tạo mới
  initialDate,   // Smart Prefill khi tạo từ ô Lịch
  initialTime,
  initialBlockStart, // click ô giờ trên lưới Ngày/Tuần → khung giờ làm 1 tiếng (kiểu Google Calendar)
  allTags = [],
  addTag,
  onSubmit,      // async (fields, tagIds) => void
  onCancel,
  submitLabel,
  children,      // phần riêng của nơi gọi, hiện trên hàng nút (vd liên kết KB)
}) {
  const id = useId();
  const rec = task?.recurrence_rule;

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [dueDate, setDueDate] = useState(task?.due_date || initialDate || toDateStr());
  // Sửa: giữ đúng giờ đang lưu (null → rỗng). Tạo: mặc định 23:59 = "Hết ngày".
  const [dueTime, setDueTime] = useState(
    task ? (task.due_time ? task.due_time.substring(0, 5) : '') : (initialTime || '23:59')
  );
  // Khung giờ làm (v6.17.0) — cùng ngày với dueDate, tách khỏi giờ HẠN dueTime.
  const [showBlock, setShowBlock] = useState(Boolean(task?.start_time || initialBlockStart));
  const [startTime, setStartTime] = useState(
    task?.start_time ? task.start_time.substring(0, 5) : (initialBlockStart || '09:00')
  );
  const [endTime, setEndTime] = useState(() => {
    if (task?.end_time) return task.end_time.substring(0, 5);
    if (!initialBlockStart) return '10:00';
    // +1 giờ, chặn ở 23:59 (khung không được qua đêm — CHECK dưới DB).
    const end = Math.min(timeToMinutes(initialBlockStart) + 60, 1439);
    return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  });
  const [priority, setPriority] = useState(task?.priority || 0);
  const [tagIds, setTagIds] = useState(() => (task?._tags || []).map((t) => t.id));
  const [showRec, setShowRec] = useState(!!rec);
  const [recType, setRecType] = useState(rec?.type || 'interval');
  const [recDays, setRecDays] = useState(rec?.days || 7);
  const [recWeekday, setRecWeekday] = useState(rec?.weekday ?? 1);
  const [recMonthDay, setRecMonthDay] = useState(rec?.day || 1);
  const [showDP, setShowDP] = useState(false);
  const [saving, setSaving] = useState(false);

  // 'HH:MM' so sánh chuỗi được; khớp CHECK end_time > start_time dưới DB.
  const blockInvalid = showBlock && !(startTime && endTime && endTime > startTime);
  const canSubmit = Boolean(title.trim()) && !saving && !blockInvalid;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!canSubmit) return;

    let recurrenceRule = null;
    if (showRec) {
      if (recType === 'interval') recurrenceRule = { type: 'interval', days: recDays };
      else if (recType === 'weekly') recurrenceRule = { type: 'weekly', weekday: recWeekday };
      else recurrenceRule = { type: 'monthly', day: recMonthDay };
    }

    const fields = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || toDateStr(),
      due_time: dueTime || null,
      priority,
      recurrence_rule: recurrenceRule,
    };
    // Chỉ gửi khung giờ khi đang có hoặc vừa bỏ — task không dùng khung giờ thì
    // payload không chạm 2 cột này (an toàn cả khi DB chưa chạy migration v6.17.0).
    if (showBlock || task?.start_time) {
      fields.start_time = showBlock ? startTime : null;
      fields.end_time = showBlock ? endTime : null;
    }

    setSaving(true);
    try {
      await onSubmit(fields, tagIds);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form className="task-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <div>
        <label className="task-form__label" htmlFor={`${id}-title`}>Tiêu đề nhiệm vụ *</label>
        <input
          id={`${id}-title`}
          className="auth-input task-form__title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tên nhiệm vụ *"
          autoFocus
        />
      </div>

      <div>
        <label className="task-form__label" htmlFor={`${id}-desc`}>Mô tả / Ghi chú</label>
        <textarea
          id={`${id}-desc`}
          className="auth-input task-desc-input task-form__desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Thêm mô tả hoặc ghi chú..."
        />
      </div>

      <div style={{ position: 'relative' }}>
        <span className="task-form__label">Thời hạn</span>
        <button type="button" className="auth-input task-form__date-btn" onClick={() => setShowDP(!showDP)}>
          <AppIcon name="calendar" size={14} />
          {dueDate
            ? new Date(dueDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'short' })
            : 'Chọn ngày'}
          {dueTime && dueTime !== '00:00' && (
            <>
              {' '}· <AppIcon name="clock" size={14} /> {dueTime === '23:59' ? '23:59 (Hết ngày)' : dueTime}
            </>
          )}
        </button>
        {showDP && (
          <DatePickerPopover
            value={dueDate}
            onChange={(d) => setDueDate(d)}
            onClose={() => setShowDP(false)}
            timeValue={dueTime}
            onTimeChange={setDueTime}
            style={{ top: '100%', left: 0, marginTop: '0.25rem' }}
          />
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowBlock(!showBlock)}
          className={`task-option-btn ${showBlock ? 'task-option-btn--active-cyan' : ''}`}
        >
          <AppIcon name="timer" size={14} /> Khung giờ làm {showBlock && <AppIcon name="check" size={12} />}
        </button>
        {showBlock && (
          <div className="task-form-rec-panel">
            <div className="task-form__row">
              <label className="task-form__muted" htmlFor={`${id}-start`}>Từ</label>
              <input
                id={`${id}-start`}
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="auth-input task-form__time"
              />
              <label className="task-form__muted" htmlFor={`${id}-end`}>đến</label>
              <input
                id={`${id}-end`}
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="auth-input task-form__time"
              />
            </div>
            {blockInvalid && (
              <span className="task-form__error">Giờ kết thúc phải sau giờ bắt đầu (cùng ngày).</span>
            )}
          </div>
        )}
      </div>

      <div>
        <span className="task-form__label">Độ ưu tiên</span>
        <PriorityPicker value={priority} onChange={setPriority} />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowRec(!showRec)}
          className={`task-option-btn ${showRec ? 'task-option-btn--active-cyan' : ''}`}
        >
          <AppIcon name="refresh" size={14} /> Lặp lại {showRec && <AppIcon name="check" size={12} />}
        </button>
        {showRec && (
          <div className="task-form-rec-panel">
            <div className="task-form__row">
              {REC_TYPES.map((rt) => (
                <button
                  key={rt.key}
                  type="button"
                  onClick={() => setRecType(rt.key)}
                  className={`task-option-btn task-option-btn--sm ${recType === rt.key ? 'task-option-btn--active-cyan' : ''}`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
            {recType === 'interval' && (
              <div className="task-form__row">
                <span className="task-form__muted">Mỗi</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={recDays}
                  onChange={(e) => setRecDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="auth-input task-form__num"
                />
                <span className="task-form__muted">ngày</span>
              </div>
            )}
            {recType === 'weekly' && (
              <div className="task-form__row">
                {WEEKDAYS.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRecWeekday(i)}
                    className={`task-option-btn task-option-btn--sm ${recWeekday === i ? 'task-option-btn--active-cyan' : ''}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
            {recType === 'monthly' && (
              <div className="task-form__row">
                <span className="task-form__muted">Ngày</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={recMonthDay}
                  onChange={(e) => setRecMonthDay(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="auth-input task-form__num"
                />
                <span className="task-form__muted">mỗi tháng</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <span className="task-form__label">Tag</span>
        <TagPicker
          tags={allTags}
          selected={tagIds}
          onToggle={(tagId) =>
            setTagIds((prev) => (prev.includes(tagId) ? prev.filter((x) => x !== tagId) : [...prev, tagId]))
          }
          onAdd={addTag}
        />
      </div>

      {children}

      <div className="task-form__footer">
        <span className="task-form__hint">
          <kbd>Enter</kbd> ở tiêu đề hoặc <kbd>Ctrl</kbd>+<kbd>Enter</kbd> để lưu
        </span>
        <button type="button" onClick={onCancel} className="btn btn-secondary task-form__btn" disabled={saving}>
          Huỷ
        </button>
        <button type="submit" className="btn btn-primary task-form__btn" disabled={!canSubmit}>
          <AppIcon name={task ? 'save' : 'pushPin'} size={14} />
          {saving ? 'Đang lưu...' : submitLabel || (task ? 'Lưu thay đổi' : 'Tạo việc')}
        </button>
      </div>
    </form>
  );
}

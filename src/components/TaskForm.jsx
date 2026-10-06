import { useState, useId } from 'react';
import DatePickerPopover from './DatePickerPopover';
import PriorityPicker from './PriorityPicker';
import TagPicker from './TagPicker';
import SubtaskList from './SubtaskList';
import AppIcon from './AppIcon';
import { WEEKDAYS } from '../utils/taskFields';
import { hasExplicitTime, isStartAfterDue, timeToMinutes } from '../utils/calendarTimeUtils';
import '../styles/tasks.css';

const hhmm = (t) => (hasExplicitTime(t) ? t.substring(0, 5) : '');
// "T2, 5/10 · 09:00" — 1 mốc trên dòng Thời gian
const fmtWhen = (date, time) =>
  `${new Date(date + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })}${time ? ` · ${time}` : ''}`;

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
  initialStart,  // click ô giờ trên lưới Ngày/Tuần → Bắt đầu = ô đó, Hạn = +1 giờ (kiểu Google Calendar)
  allTags = [],
  addTag,
  onSubmit,      // async (fields, tagIds, subtaskTitles) => void — subtaskTitles chỉ có khi TẠO
  onCancel,
  submitLabel,
  taskModel,     // khi SỬA: có thì hiện subtask thật (lưu ngay, xem SubtaskList)
  onOpenTask,    // mở popup Chi tiết của 1 subtask
  children,      // phần riêng của nơi gọi, hiện trên hàng nút (vd liên kết KB)
}) {
  const id = useId();
  const rec = task?.recurrence_rule;

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  // Thời gian (v6.21.0): 2 mốc đều tuỳ chọn — Bắt đầu và Hạn ('' = không đặt).
  // Tạo mới mặc định KHÔNG ngày; tạo từ ô Lịch thì điền sẵn ngày/giờ của ô đó.
  const [dueDate, setDueDate] = useState(task ? (task.due_date || '') : (initialDate || ''));
  const [dueTime, setDueTime] = useState(() => {
    if (task) return hhmm(task.due_time);
    if (!initialStart) return hhmm(initialTime);
    // Hạn = Bắt đầu +1 giờ, chặn ở 23:59 (không qua đêm).
    const end = Math.min(timeToMinutes(initialStart) + 60, 1439);
    return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  });
  const [startDate, setStartDate] = useState(task ? (task.start_date || '') : (initialStart && initialDate) || '');
  const [startTime, setStartTime] = useState(task?.start_time ? task.start_time.substring(0, 5) : (initialStart || ''));
  const [showDates, setShowDates] = useState(false); // popover Bắt đầu → Hạn
  // Subtask nháp khi TẠO task (chưa có task cha để gắn) — tạo thật sau khi lưu task cha.
  const [subtaskTitles, setSubtaskTitles] = useState([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [priority, setPriority] = useState(task?.priority || 0);
  const [tagIds, setTagIds] = useState(() => (task?._tags || []).map((t) => t.id));
  const [showRec, setShowRec] = useState(!!rec);
  const [recType, setRecType] = useState(rec?.type || 'interval');
  const [recDays, setRecDays] = useState(rec?.days || 7);
  const [recWeekday, setRecWeekday] = useState(rec?.weekday ?? 1);
  const [recMonthDay, setRecMonthDay] = useState(rec?.day || 1);
  const [saving, setSaving] = useState(false);

  // Khớp CHECK user_tasks_start_before_due dưới DB (popover đã chặn, đây là chốt cuối).
  const startAfterDue = isStartAfterDue({ startDate, startTime, dueDate, dueTime });
  // Kỳ lặp sau dời theo ngày Hạn → task lặp phải có Hạn.
  const recNeedsDue = showRec && !dueDate;
  const canSubmit = Boolean(title.trim()) && !saving && !startAfterDue && !recNeedsDue;

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
      due_date: dueDate || null,
      due_time: dueDate && dueTime ? dueTime : null,
      priority,
      recurrence_rule: recurrenceRule,
    };
    // Bắt đầu chỉ gửi khi đang có hoặc vừa bỏ — task không dùng thì payload không chạm cột.
    if (startDate || task?.start_date) {
      fields.start_date = startDate || null;
      fields.start_time = startDate && startTime ? startTime : null;
    }
    // Ô subtask nháp còn chữ mà chưa Enter → vẫn tính (không lặng lẽ mất).
    const pendingTitles = subtaskDraft.trim() ? [...subtaskTitles, subtaskDraft.trim()] : subtaskTitles;

    setSaving(true);
    try {
      await onSubmit(fields, tagIds, task ? undefined : pendingTitles);
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

  // Dòng Thời gian: 1 nút mở popover Bắt đầu → Hạn (DatePickerPopover mode="task"), ✕ bỏ cả hai.
  const hasDates = Boolean(startDate || dueDate);
  const setDates = (v) => {
    setStartDate(v.startDate);
    setStartTime(v.startTime);
    setDueDate(v.dueDate);
    setDueTime(v.dueTime);
  };
  const renderDates = () => (
    <div className="task-form__when">
      <span className="task-form__label">Thời gian</span>
      <div className="task-form__when-row">
        <button type="button" className="auth-input task-form__date-btn" onClick={() => setShowDates(!showDates)}>
          {!hasDates && <><AppIcon name="calendar" size={14} /> <span className="task-form__muted">Không đặt</span></>}
          {startDate && <span title="Bắt đầu"><AppIcon name="play" size={13} /> {fmtWhen(startDate, startTime)}</span>}
          {startDate && dueDate && <span className="task-form__muted">→</span>}
          {dueDate && <span title="Hạn"><AppIcon name="calendar" size={13} /> {fmtWhen(dueDate, dueTime)}</span>}
        </button>
        {hasDates && (
          <button
            type="button"
            className="task-form__clear"
            onClick={() => setDates({ startDate: '', startTime: '', dueDate: '', dueTime: '' })}
            title="Bỏ Bắt đầu và Hạn"
            aria-label="Bỏ Bắt đầu và Hạn"
          >
            <AppIcon name="x" size={14} />
          </button>
        )}
      </div>
      {showDates && (
        <DatePickerPopover
          mode="task"
          value={{ startDate, startTime, dueDate, dueTime }}
          onChange={setDates}
          onClose={() => setShowDates(false)}
          style={{ top: '100%', left: 0, marginTop: '0.25rem' }}
        />
      )}
    </div>
  );

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

      {/* Subtask: SỬA → danh sách thật, lưu ngay. TẠO → nháp, tạo cùng task cha khi Lưu.
          Subtask không có subtask (1 cấp). */}
      {task && taskModel && !task.parent_task_id && (
        <SubtaskList parent={task} taskModel={taskModel} onOpenTask={onOpenTask} />
      )}
      {!task && (
        <div className="subtask-list subtask-list--edit">
          <div className="subtask-list__head">
            <span><AppIcon name="listChecks" size={14} /> Subtask{subtaskTitles.length > 0 && ` · ${subtaskTitles.length}`}</span>
          </div>
          {subtaskTitles.map((t, i) => (
            <div key={`${i}-${t}`} className="subtask-draft-row">
              <AppIcon name="checkSquare" size={13} />
              <span>{t}</span>
              <button
                type="button"
                className="subtask-row__icon subtask-row__icon--danger"
                onClick={() => setSubtaskTitles((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Bỏ subtask: ${t}`}
              >
                <AppIcon name="x" size={13} />
              </button>
            </div>
          ))}
          <input
            className="auth-input subtask-list__add"
            value={subtaskDraft}
            onChange={(e) => setSubtaskDraft(e.target.value)}
            placeholder="Thêm subtask… (Enter để thêm tiếp)"
            aria-label="Thêm subtask"
            onKeyDown={(e) => {
              // Enter thêm subtask nháp, KHÔNG submit form.
              if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                if (subtaskDraft.trim()) {
                  setSubtaskTitles((prev) => [...prev, subtaskDraft.trim()]);
                  setSubtaskDraft('');
                }
              }
            }}
          />
        </div>
      )}

      {renderDates()}
      {startAfterDue && <span className="task-form__error">Bắt đầu phải trước Hạn.</span>}

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
            {recNeedsDue && <span className="task-form__error">Task lặp cần có ngày Hạn.</span>}
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

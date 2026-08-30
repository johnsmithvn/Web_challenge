import { useState, useCallback, useEffect } from 'react';
import { useTags } from '../hooks/useTags';
import DatePickerPopover from './DatePickerPopover';
import TagPicker from './TagPicker';
import { PRIORITY_OPTIONS, WEEKDAYS } from '../utils/taskFields';
import { toDateStr } from '../utils/dateUtils';
import AppIcon from './AppIcon';

/**
 * TaskCreateModal — Modal tạo nhiệm vụ đầy đủ tính năng ngay trên Lịch Tuần.
 * Tái sử dụng trọn vẹn 100% logic và trường dữ liệu của hệ thống:
 * Tiêu đề, Mô tả, Ngày giờ, Độ ưu tiên (Priority), Tags, Lặp lại (Recurrence).
 */
export default function TaskCreateModal({
  isOpen,
  initialDate,
  initialTime,
  onClose,
  taskModel,
}) {
  const { allTags, addTag, linkTaskTag } = useTags();
  const { addTask } = taskModel;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(initialDate || toDateStr());
  const [dueTime, setDueTime] = useState(initialTime || '09:00');
  const [priority, setPriority] = useState(0);
  const [tagIds, setTagIds] = useState([]);
  const [showDP, setShowDP] = useState(false);

  // Recurrence state
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [recType, setRecType] = useState('interval');
  const [recDays, setRecDays] = useState(7);
  const [recWeekday, setRecWeekday] = useState(1);
  const [recMonthDay, setRecMonthDay] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Đồng bộ initialDate / initialTime khi modal mở
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setDueDate(initialDate || toDateStr());
      setDueTime(initialTime || '09:00');
      setPriority(0);
      setTagIds([]);
      setShowRecurrence(false);
      setShowDP(false);
      setIsSubmitting(false);
    }
  }, [isOpen, initialDate, initialTime]);

  // Đóng modal khi bấm Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let recurrenceRule = null;
      if (showRecurrence) {
        if (recType === 'interval') recurrenceRule = { type: 'interval', days: recDays };
        else if (recType === 'weekly') recurrenceRule = { type: 'weekly', weekday: recWeekday };
        else if (recType === 'monthly') recurrenceRule = { type: 'monthly', day: recMonthDay };
      }

      const created = await addTask({
        title: title.trim(),
        description: description.trim() || null,
        dueDate: dueDate || toDateStr(),
        dueTime: dueTime || '09:00',
        priority,
        recurrenceRule,
      });

      if (created && tagIds.length > 0) {
        const selectedTags = allTags.filter((t) => tagIds.includes(t.id));
        await Promise.all(selectedTags.map((tag) => linkTaskTag(created.id, tag)));
      }

      onClose?.();
    } finally {
      setIsSubmitting(false);
    }
  }, [
    title,
    description,
    dueDate,
    dueTime,
    priority,
    showRecurrence,
    recType,
    recDays,
    recWeekday,
    recMonthDay,
    tagIds,
    allTags,
    addTask,
    linkTaskTag,
    onClose,
    isSubmitting,
  ]);

  if (!isOpen) return null;

  return (
    <div className="qc-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="card task-create-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.25rem',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-glass)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.05rem' }}>
            <AppIcon name="pushPin" size={18} style={{ color: 'var(--purple)' }} />
            <span>Thêm nhiệm vụ mới</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: '4px', borderRadius: '50%' }}
            aria-label="Đóng"
          >
            <AppIcon name="x" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Tên nhiệm vụ */}
          <div>
            <input
              type="text"
              autoFocus
              className="auth-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tên nhiệm vụ cần làm *..."
              style={{ fontWeight: 600, fontSize: '0.95rem' }}
            />
          </div>

          {/* Mô tả chi tiết */}
          <div>
            <textarea
              className="auth-input task-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Thêm mô tả hoặc ghi chú..."
              style={{ fontSize: '0.84rem' }}
            />
          </div>

          {/* Ngày & Giờ (DatePicker) */}
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
              Thời hạn
            </label>
            <button
              type="button"
              onClick={() => setShowDP(!showDP)}
              className="auth-input"
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <AppIcon name="calendar" size={15} />
              <span>
                {dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Chọn ngày'}
              </span>
              {dueTime && (
                <>
                  <span>·</span>
                  <AppIcon name="clock" size={14} />
                  <span>{dueTime}</span>
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

          {/* Độ ưu tiên (Priority) */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
              Độ ưu tiên
            </label>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {PRIORITY_OPTIONS.filter((o) => o.value > 0).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(priority === opt.value ? 0 : opt.value)}
                  className={`task-option-btn ${priority === opt.value ? 'active' : ''}`}
                  style={
                    priority === opt.value
                      ? {
                          background: `${opt.color}22`,
                          borderColor: opt.color,
                          color: opt.color,
                          fontWeight: 700,
                        }
                      : {}
                  }
                >
                  <AppIcon name={opt.icon} size={14} /> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lặp lại (Recurrence) */}
          <div>
            <button
              type="button"
              onClick={() => setShowRecurrence(!showRecurrence)}
              className={`task-option-btn ${showRecurrence ? 'task-option-btn--active-cyan' : ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <AppIcon name="refresh" size={14} />
              <span>{showRecurrence ? 'Có lặp lại' : 'Lặp lại định kỳ'}</span>
              {showRecurrence && <AppIcon name="check" size={12} />}
            </button>

            {showRecurrence && (
              <div className="task-form-rec-panel" style={{ marginTop: '0.45rem' }}>
                <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.4rem' }}>
                  {[
                    { key: 'interval', label: 'Mỗi N ngày' },
                    { key: 'weekly', label: 'Hàng tuần' },
                    { key: 'monthly', label: 'Hàng tháng' },
                  ].map((rt) => (
                    <button
                      key={rt.key}
                      type="button"
                      onClick={() => setRecType(rt.key)}
                      className={`task-option-btn ${recType === rt.key ? 'task-option-btn--active-cyan' : ''}`}
                      style={{ padding: '0.22rem 0.45rem', fontSize: '0.72rem' }}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>

                {recType === 'interval' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mỗi</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={recDays}
                      onChange={(e) => setRecDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="auth-input"
                      style={{ width: '60px', fontSize: '0.82rem', textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ngày</span>
                  </div>
                )}

                {recType === 'weekly' && (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {WEEKDAYS.map((day, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRecWeekday(i)}
                        className={`task-option-btn ${recWeekday === i ? 'task-option-btn--active-cyan' : ''}`}
                        style={{ padding: '0.25rem 0.4rem', fontSize: '0.72rem' }}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                )}

                {recType === 'monthly' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ngày</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={recMonthDay}
                      onChange={(e) => setRecMonthDay(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="auth-input"
                      style={{ width: '55px', fontSize: '0.82rem', textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>mỗi tháng</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
              Nhãn dán (Tag)
            </label>
            <TagPicker
              tags={allTags}
              selected={tagIds}
              onToggle={(tagId) =>
                setTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
              }
              onAdd={addTag}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!title.trim() || isSubmitting}
              id="task-create-modal-submit"
            >
              <AppIcon name="pushPin" size={15} />
              <span>{isSubmitting ? 'Đang tạo...' : 'Tạo việc'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

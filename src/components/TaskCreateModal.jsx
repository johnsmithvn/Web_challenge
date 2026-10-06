import { useEffect } from 'react';
import { useTags } from '../hooks/useTags';
import TaskForm from './TaskForm';
import AppIcon from './AppIcon';

/**
 * TaskCreateModal — vỏ modal tạo nhiệm vụ từ Lịch/Kanban. Phần form là TaskForm
 * dùng chung; modal chỉ lo backdrop, Escape, Smart Prefill ngày/giờ và cột
 * Kanban (`initialStatus`).
 */
export default function TaskCreateModal({
  isOpen,
  initialDate,
  initialTime,
  initialBlockStart,
  initialStatus = 'todo',
  onClose,
  taskModel,
}) {
  const { tags: allTags, addTag } = useTags();
  const { addTask, addSubtasks, linkTaskTag } = taskModel;

  // Escape đóng modal. Ctrl/Cmd+Enter do TaskForm tự xử lý.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCreate = async (fields, tagIds, subtaskTitles = []) => {
    const status = initialStatus || 'todo';
    const created = await addTask({
      title: fields.title,
      description: fields.description,
      dueDate: fields.due_date,
      dueTime: fields.due_time,
      startTime: fields.start_time,
      endTime: fields.end_time,
      priority: fields.priority,
      recurrenceRule: fields.recurrence_rule,
      status,
      completed: status === 'done',
      completedAt: status === 'done' ? new Date().toISOString() : null,
    });

    if (created && tagIds.length > 0 && linkTaskTag) {
      const selectedTags = (allTags || []).filter((t) => tagIds.includes(t.id));
      await Promise.all(selectedTags.map((tag) => linkTaskTag(created.id, tag)));
    }
    if (created && subtaskTitles.length > 0) await addSubtasks(created, subtaskTitles);

    onClose?.();
  };

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

        <TaskForm
          initialDate={initialDate}
          initialTime={initialTime}
          initialBlockStart={initialBlockStart}
          allTags={allTags}
          addTag={addTag}
          onSubmit={handleCreate}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

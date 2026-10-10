import { useState, useEffect, useMemo, useCallback } from 'react';
import AppIcon from './AppIcon';
import { StatusPopover, PriorityPopover, TaskDatePickerPopover, RecurrencePopover } from './TaskFloatingPopovers';
import { useActivityLog } from '../hooks/useActivityLog';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { PRIORITY_LABELS } from '../utils/taskNlpParser';
import { describeRecurrence, describeActivity } from '../utils/taskFields';
import { useConfirm } from './ConfirmModal';
import UI_STRINGS from '../data/ui-strings.json';

export default function TaskDetailDrawer({
  task,
  onClose,
  taskModel,
  onOpenSubtaskDetail,
}) {
  const { user } = useAuth();
  const { confirm, ConfirmModal } = useConfirm();
  const { getTaskLogs, addNote, deleteLog } = useActivityLog();
  const { updateTask, completeTask, uncompleteTask, deleteTask } = taskModel || {};

  const [titleDraft, setTitleDraft] = useState(task?.title || '');
  const [descDraft, setDescDraft] = useState(task?.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [subtaskInput, setSubtaskInput] = useState('');

  // Tab chân drawer: 'activity' | 'notes'
  const [footerTab, setFooterTab] = useState('activity');
  const [logs, setLogs] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Popovers state
  const [activePopover, setActivePopover] = useState(null); // 'status' | 'priority' | 'date'

  // Subtasks từ database/state
  const [fetchedSubs, setFetchedSubs] = useState([]);

  useEffect(() => {
    setTitleDraft(task?.title || '');
    setDescDraft(task?.description || '');
  }, [task]);

  // Load audit logs & notes
  const loadLogs = useCallback(async () => {
    if (!task?.id || !user || !getTaskLogs) return;
    try {
      setLoadingLogs(true);
      const data = await getTaskLogs(task.id);
      setLogs(data || []);
    } catch (err) {
      console.warn('Lỗi tải logs nhiệm vụ:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [task?.id, user, getTaskLogs]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (task?.id && taskModel?.getSubtasks) {
      taskModel.getSubtasks(task.id).then((rows) => {
        if (rows) setFetchedSubs(rows);
      });
    }
  }, [task?.id, taskModel]);

  const subtasks = useMemo(() => {
    if (!task?.id) return [];
    const map = new Map();
    for (const s of fetchedSubs) map.set(s.id, s);
    const localSubs = (taskModel?.tasks || []).filter((t) => t.parent_task_id === task.id);
    for (const s of localSubs) map.set(s.id, s);
    return Array.from(map.values());
  }, [fetchedSubs, taskModel?.tasks, task?.id]);

  const parentTask = useMemo(() => {
    if (!task?.parent_task_id) return null;
    return (taskModel?.tasks || []).find((t) => t.id === task.parent_task_id);
  }, [task?.parent_task_id, taskModel?.tasks]);

  if (!task) return null;

  // Xử lý lưu tiêu đề khi blur hoặc Enter
  const handleSaveTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== task.title) {
      updateTask?.(task.id, { title: trimmed });
    }
  };

  // Xử lý lưu mô tả (chỉ lưu khi có thay đổi thực sự để tránh sinh log rác)
  const handleSaveDesc = () => {
    const currentDesc = task.description || '';
    if (descDraft.trim() !== currentDesc.trim()) {
      updateTask?.(task.id, { description: descDraft });
    }
    setIsEditingDesc(false);
  };

  // Thêm việc con
  const handleAddSubtask = async (e) => {
    if (e.key === 'Enter') {
      const trimmed = subtaskInput.trim();
      if (!trimmed || !taskModel?.addTask) return;
      await taskModel.addTask({
        title: trimmed,
        dueDate: task.due_date,
        parentTaskId: task.id,
      });
      setSubtaskInput('');
      if (taskModel?.getSubtasks) {
        const rows = await taskModel.getSubtasks(task.id);
        if (rows) setFetchedSubs(rows);
      }
    }
  };

  // Thêm ghi chú mới
  const handleAddNote = async () => {
    const trimmed = noteDraft.trim();
    if (!trimmed || !addNote) return;
    await addNote(task.id, trimmed);
    setNoteDraft('');
    loadLogs();
  };

  const isDone = task.completed || task.status === 'completed' || task.status === 'done';
  const doneSubtasks = subtasks.filter((s) => s.completed || s.status === 'completed' || s.status === 'done').length;
  const subtaskPct = subtasks.length > 0 ? Math.round((doneSubtasks / subtasks.length) * 100) : 0;

  return (
    <>
      {ConfirmModal}
      {/* Backdrop mờ nhẹ */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 90,
          backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
      />

      <aside className="tk-drawer" style={{ transform: 'translateX(0)' }}>
        {/* Header Drawer */}
        <div className="tk-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {parentTask && (
              <button
                type="button"
                onClick={() => onOpenSubtaskDetail?.(parentTask)}
                style={{
                  background: 'rgba(94, 242, 194, 0.1)',
                  border: '1px solid rgba(94, 242, 194, 0.25)',
                  borderRadius: '6px',
                  color: 'var(--tk-accent, #5EF2C2)',
                  cursor: 'pointer',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                }}
                title={`Quay lại việc cha: ${parentTask.title}`}
              >
                <span>← {parentTask.title.slice(0, 16)}{parentTask.title.length > 16 ? '...' : ''}</span>
              </button>
            )}
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--tk-accent)', fontWeight: 600 }}>
              LH-{task.id?.toString().slice(-4) || 'TASK'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--tk-text-mute)' }}>
              {task.created_at ? formatDate(task.created_at) : 'Hôm nay'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={async () => {
                const cfg = UI_STRINGS.confirm.deleteTask;
                const ok = await confirm({ ...cfg, message: cfg.message.replace('{name}', task.title) });
                if (ok) {
                  await deleteTask?.(task.id);
                  onClose();
                }
              }}
              title="Xóa việc"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--tk-text-mute)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
              }}
            >
              <AppIcon name="trash" size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Đóng"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--tk-text-sub)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
              }}
            >
              <AppIcon name="x" size={18} />
            </button>
          </div>
        </div>

        {/* Nội dung chi tiết cuộn được */}
        <div className="tk-drawer-content">
          {/* Tiêu đề Task (Inline edit) */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                if (isDone) uncompleteTask?.(task.id);
                else completeTask?.(task.id);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isDone ? 'var(--tk-text-done)' : 'var(--tk-text-mute)',
                padding: '4px 0',
              }}
            >
              <AppIcon name={isDone ? 'check-circle' : 'circle'} size={22} />
            </button>
            <textarea
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveTitle();
                  e.target.blur();
                }
              }}
              rows={2}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '18px',
                fontWeight: 700,
                color: isDone ? 'var(--tk-text-done)' : 'var(--tk-text-main)',
                textDecoration: isDone ? 'line-through' : 'none',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.35,
              }}
              placeholder="Tên nhiệm vụ..."
            />
          </div>

          {/* Dải thuộc tính nhanh */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', position: 'relative' }}>
            {/* 1. Trạng thái */}
            <button
              type="button"
              onClick={() => setActivePopover((p) => (p === 'status' ? null : 'status'))}
              className="tk-badge-pill"
              style={{
                background: 'var(--tk-border-soft)',
                border: '1px solid var(--tk-border)',
                color: 'var(--tk-text-main)',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isDone ? '#34D399' : task.status === 'skip' ? '#94A3B8' : task.status === 'doing' ? '#FBBF24' : '#60A5FA' }} />
              <span>{isDone ? 'Hoàn thành' : task.status === 'doing' ? 'Đang làm' : task.status === 'skip' ? 'Bỏ qua' : 'Cần làm'}</span>
            </button>
            {activePopover === 'status' && (
              <StatusPopover
                currentStatus={task.status}
                onSelect={(st) => {
                  if (st === 'done') {
                    completeTask?.(task.id);
                  } else {
                    if (task.completed || task.status === 'done' || task.status === 'completed') {
                      uncompleteTask?.(task.id, st);
                    } else {
                      updateTask?.(task.id, { status: st });
                    }
                  }
                }}
                onClose={() => setActivePopover(null)}
                style={{ top: '32px', left: '0' }}
              />
            )}

            {/* 2. Ngày giờ */}
            <button
              type="button"
              onClick={() => setActivePopover((p) => (p === 'date' ? null : 'date'))}
              className="tk-badge-pill"
              style={{
                background: task.due_date ? 'var(--tk-accent-soft)' : 'var(--tk-border-soft)',
                border: `1px solid ${task.due_date ? 'var(--tk-accent-border)' : 'var(--tk-border)'}`,
                color: task.due_date ? 'var(--tk-accent)' : 'var(--tk-text-mute)',
              }}
            >
              <AppIcon name="calendar" size={13} />
              <span>{task.due_date ? `${formatDate(task.due_date)}${task.due_time ? ' · ' + task.due_time.slice(0, 5) : ''}` : 'Đặt hạn'}</span>
            </button>
            {activePopover === 'date' && (
              <TaskDatePickerPopover
                initialDate={task.due_date}
                initialTime={task.due_time}
                onSave={(d, t) => updateTask?.(task.id, { due_date: d, due_time: t })}
                onClose={() => setActivePopover(null)}
                style={{ top: '32px', left: '80px' }}
              />
            )}

            {/* 3. Mức ưu tiên */}
            <button
              type="button"
              onClick={() => setActivePopover((p) => (p === 'priority' ? null : 'priority'))}
              className="tk-badge-pill"
              style={{
                background: 'var(--tk-border-soft)',
                border: '1px solid var(--tk-border)',
                color: 'var(--tk-text-main)',
              }}
            >
              <AppIcon name="flag" size={13} />
              <span>{PRIORITY_LABELS[task.priority]?.label || 'Ưu tiên'}</span>
            </button>
            {activePopover === 'priority' && (
              <PriorityPopover
                currentPriority={task.priority}
                onSelect={(pr) => updateTask?.(task.id, { priority: pr })}
                onClose={() => setActivePopover(null)}
                style={{ top: '32px', left: '160px' }}
              />
            )}

            {/* 4. Lặp lại (Recurrence) */}
            <button
              type="button"
              onClick={() => setActivePopover((p) => (p === 'recurrence' ? null : 'recurrence'))}
              className="tk-badge-pill"
              style={{
                background: task.recurrence_rule ? 'var(--tk-accent-soft)' : 'var(--tk-border-soft)',
                border: `1px solid ${task.recurrence_rule ? 'var(--tk-accent-border)' : 'var(--tk-border)'}`,
                color: task.recurrence_rule ? 'var(--tk-accent)' : 'var(--tk-text-mute)',
              }}
            >
              <AppIcon name="repeat" size={13} />
              <span>{describeRecurrence(task.recurrence_rule)}</span>
            </button>
            {activePopover === 'recurrence' && (
              <RecurrencePopover
                currentRule={task.recurrence_rule}
                onSelect={(rule) => updateTask?.(task.id, { recurrence_rule: rule })}
                onClose={() => setActivePopover(null)}
                style={{ top: '32px', left: '220px' }}
              />
            )}

            {/* Nút Bắt đầu làm việc (Timer) */}
            {task.status !== 'doing' && !isDone && (
              <button
                type="button"
                onClick={() => updateTask?.(task.id, { status: 'doing' })}
                className="tk-badge-pill"
                style={{
                  background: 'rgba(251, 191, 36, 0.12)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  color: '#FBBF24',
                }}
              >
                <AppIcon name="play" size={12} />
                <span>Bắt đầu làm</span>
              </button>
            )}
          </div>

          {/* Nhãn và liên kết kiến thức */}
          {((task._tags && task._tags.length > 0) || (task._collections && task._collections.length > 0)) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {task._tags?.map((t) => (
                <span
                  key={t.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11.5px',
                    background: `${t.color || '#5EF2C2'}18`,
                    color: t.color || 'var(--tk-accent)',
                    border: `1px solid ${t.color || '#5EF2C2'}33`,
                  }}
                >
                  <AppIcon name="tag" size={11} />
                  <span>#{t.name}</span>
                </span>
              ))}
              {task._collections?.map((c) => (
                <span
                  key={c.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    background: 'rgba(96, 165, 250, 0.1)',
                    color: '#60A5FA',
                    border: '1px solid rgba(96, 165, 250, 0.25)',
                  }}
                  title="Bài viết liên kết"
                >
                  <AppIcon name="link" size={11} />
                  <span>{c.title}</span>
                </span>
              ))}
            </div>
          )}

          {/* Thông tin thực tế: started_at, completed_at */}
          {(task.started_at || (task.completed && task.completed_at)) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px', fontSize: '11.5px', color: 'var(--tk-text-mute)' }}>
              {task.started_at && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <AppIcon name="play" size={11} /> Bắt đầu: {formatDateTime(task.started_at)}
                </span>
              )}
              {task.completed && task.completed_at && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--tk-text-done)' }}>
                  <AppIcon name="checkCircle" size={11} /> Xong lúc: {formatDateTime(task.completed_at)}
                </span>
              )}
            </div>
          )}

          {/* Việc con (Subtasks) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tk-text-main)' }}>
                Việc con ({doneSubtasks}/{subtasks.length})
              </span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tk-accent)' }}>
                {subtaskPct}%
              </span>
            </div>

            {/* Progress bar mini */}
            {subtasks.length > 0 && (
              <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'var(--tk-border-soft)', overflow: 'hidden' }}>
                <div style={{ width: `${subtaskPct}%`, height: '100%', background: 'var(--tk-accent)', transition: 'width 0.2s ease' }} />
              </div>
            )}

            {/* Danh sách các subtask */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {subtasks.map((st) => {
                const stDone = st.completed || st.status === 'completed' || st.status === 'done';
                return (
                  <div
                    key={st.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      background: 'var(--tk-border-soft)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => (stDone ? uncompleteTask?.(st.id) : completeTask?.(st.id))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: stDone ? 'var(--tk-text-done)' : 'var(--tk-text-mute)' }}
                    >
                      <AppIcon name={stDone ? 'checkSquare' : 'square'} size={16} />
                    </button>
                    <span
                      onClick={() => onOpenSubtaskDetail?.(st)}
                      style={{
                        flex: 1,
                        fontSize: '13px',
                        color: stDone ? 'var(--tk-text-mute)' : 'var(--tk-text-main)',
                        textDecoration: stDone ? 'line-through' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {st.title}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteTask?.(st.id);
                        setFetchedSubs((prev) => prev.filter((p) => p.id !== st.id));
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tk-text-mute)', opacity: 0.6 }}
                      title="Xoá việc con"
                    >
                      <AppIcon name="x" size={13} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Ô thêm việc con */}
            <input
              type="text"
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              onKeyDown={handleAddSubtask}
              placeholder="+ Thêm việc con, nhấn Enter..."
              style={{
                height: '34px',
                borderRadius: '8px',
                border: '1px solid var(--tk-border)',
                background: 'transparent',
                padding: '0 10px',
                fontSize: '12.5px',
                color: 'var(--tk-text-main)',
                outline: 'none',
              }}
            />
          </div>

          {/* Mô tả (Description) Markdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tk-text-main)' }}>
              Mô tả chi tiết
            </span>
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onFocus={() => setIsEditingDesc(true)}
              onBlur={handleSaveDesc}
              rows={4}
              placeholder="Thêm mô tả (hỗ trợ định dạng Markdown, danh sách việc - [ ])..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: '10px',
                border: `1px solid ${isEditingDesc ? 'var(--tk-accent)' : 'var(--tk-border)'}`,
                background: 'var(--tk-border-soft)',
                padding: '10px',
                fontSize: '13px',
                color: 'var(--tk-text-main)',
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Khối Footer 2 tab: Hoạt động & Ghi chú */}
          <div style={{ marginTop: '14px', borderTop: '1px solid var(--tk-border-soft)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setFooterTab('activity')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: footerTab === 'activity' ? 'var(--tk-accent)' : 'var(--tk-text-mute)',
                  cursor: 'pointer',
                  borderBottom: footerTab === 'activity' ? '2px solid var(--tk-accent)' : '2px solid transparent',
                  paddingBottom: '4px',
                }}
              >
                Hoạt động ({logs.filter((l) => l.action !== 'note').length})
              </button>
              <button
                type="button"
                onClick={() => setFooterTab('notes')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: footerTab === 'notes' ? 'var(--tk-accent)' : 'var(--tk-text-mute)',
                  cursor: 'pointer',
                  borderBottom: footerTab === 'notes' ? '2px solid var(--tk-accent)' : '2px solid transparent',
                  paddingBottom: '4px',
                }}
              >
                Ghi chú ({logs.filter((l) => l.action === 'note').length})
              </button>
            </div>

            {footerTab === 'activity' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {loadingLogs ? (
                  <span style={{ fontSize: '12px', color: 'var(--tk-text-mute)' }}>Đang tải nhật ký...</span>
                ) : logs.filter((l) => l.action !== 'note').length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--tk-text-mute)' }}>Chưa có hoạt động nào được ghi lại.</span>
                ) : (
                  logs
                    .filter((l) => l.action !== 'note')
                    .map((lg) => {
                      const desc = describeActivity(lg);
                      return (
                        <div key={lg.id} style={{ fontSize: '12px', color: 'var(--tk-text-sub)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AppIcon name={desc.icon} size={12} color="var(--tk-accent)" />
                          <span style={{ flex: 1 }}>{desc.text}{desc.newText ? `: ${desc.newText}` : ''}</span>
                          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--tk-text-mute)' }}>
                            {lg.created_at ? formatDate(lg.created_at) : ''}
                          </span>
                        </div>
                      );
                    })
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Viết ghi chú nhanh, Enter để lưu..."
                    style={{
                      flex: 1,
                      height: '32px',
                      borderRadius: '6px',
                      border: '1px solid var(--tk-border)',
                      background: 'var(--tk-border-soft)',
                      padding: '0 8px',
                      fontSize: '12.5px',
                      color: 'var(--tk-text-main)',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddNote}
                    className="tk-btn-primary"
                    style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                  >
                    Ghi
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  {logs
                    .filter((l) => l.action === 'note')
                    .map((nt) => (
                      <div
                        key={nt.id}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: 'var(--tk-border-soft)',
                          fontSize: '12.5px',
                          color: 'var(--tk-text-main)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>{nt.details}</span>
                        <button
                          type="button"
                          onClick={() => {
                            deleteLog?.(nt.id);
                            loadLogs();
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--tk-text-mute)', cursor: 'pointer' }}
                        >
                          <AppIcon name="x" size={12} />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

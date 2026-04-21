import { useState, useCallback } from 'react';
import { useUserTasks } from '../hooks/useUserTasks';
import { useAuth } from '../contexts/AuthContext';

const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * TaskListSection — Personal to-do list in TrackerPage.
 * Not connected to habits/XP/journey.
 */
export default function TaskListSection() {
  const { user } = useAuth();
  const { pendingTasks, completedToday, addTask, completeTask, deleteTask, isLoading } = useUserTasks();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(todayStr());
  const [dueTime, setDueTime] = useState('');
  const [expandedTask, setExpandedTask] = useState(null);  // For viewing description

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    await addTask({
      title: title.trim(),
      description: description.trim() || null,
      dueDate: dueDate || todayStr(),
      dueTime: dueTime || null,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setDueDate(todayStr());
    setDueTime('');
    setShowForm(false);
  }, [title, description, dueDate, dueTime, addTask]);

  const isOverdue = (task) => {
    const now = new Date();
    const taskDate = new Date(task.due_date + 'T00:00:00');
    if (taskDate < new Date(todayStr() + 'T00:00:00')) return true;
    if (task.due_time && task.due_date === todayStr()) {
      const [h, m] = task.due_time.split(':').map(Number);
      if (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) return true;
    }
    return false;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return null;
    return timeStr.substring(0, 5); // HH:MM
  };

  const formatDate = (dateStr) => {
    if (dateStr === todayStr()) return 'Hôm nay';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
  };

  const totalCount = pendingTasks.length + completedToday.length;

  return (
    <div className="card task-list-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="dash-card-title" style={{ margin: 0 }}>📌 Nhiệm Vụ</span>
          {totalCount > 0 && (
            <span style={{
              background: pendingTasks.length > 0 ? 'rgba(139,92,246,0.2)' : 'rgba(0,255,136,0.15)',
              color: pendingTasks.length > 0 ? '#a78bfa' : 'var(--green)',
              padding: '0.15rem 0.55rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}>
              {pendingTasks.length}/{totalCount}
            </span>
          )}
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => setShowForm(!showForm)}
          id="task-add-btn"
          style={{
            fontSize: '0.82rem',
            padding: '0.3rem 0.75rem',
            color: showForm ? 'var(--red)' : 'var(--purple)',
          }}
        >
          {showForm ? '✕ Đóng' : '+ Thêm'}
        </button>
      </div>

      {/* Add Task Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="task-form" style={{
          background: 'rgba(139,92,246,0.06)',
          border: '1px solid rgba(139,92,246,0.15)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          marginBottom: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}>
          <input
            type="text"
            placeholder="Tên nhiệm vụ *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            id="task-title-input"
            className="auth-input"
            style={{ fontSize: '0.88rem' }}
          />
          <textarea
            placeholder="Mô tả (tuỳ chọn)..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            id="task-desc-input"
            className="auth-input"
            rows={2}
            style={{ resize: 'none', fontSize: '0.82rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                📅 Ngày
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                id="task-date-input"
                className="auth-input"
                style={{ fontSize: '0.82rem', width: '100%' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                ⏰ Giờ (tuỳ chọn)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                id="task-time-input"
                className="auth-input"
                style={{ fontSize: '0.82rem', width: '100%' }}
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!title.trim()}
            id="task-submit-btn"
            style={{
              justifyContent: 'center',
              padding: '0.65rem',
              fontSize: '0.85rem',
              marginTop: '0.25rem',
            }}
          >
            📌 Thêm Nhiệm Vụ
          </button>
        </form>
      )}

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {pendingTasks.map(task => {
            const overdue = isOverdue(task);
            const isExpanded = expandedTask === task.id;

            return (
              <div key={task.id} className="task-item" style={{
                padding: '0.75rem',
                background: overdue ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${overdue ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-base)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  {/* Checkbox */}
                  <button
                    onClick={() => completeTask(task.id)}
                    id={`task-check-${task.id}`}
                    style={{
                      width: 22, height: 22, minWidth: 22,
                      borderRadius: 'var(--radius-sm)',
                      border: `2px solid ${overdue ? 'rgba(239,68,68,0.4)' : 'rgba(139,92,246,0.4)'}`,
                      background: 'transparent',
                      cursor: 'pointer',
                      marginTop: '0.1rem',
                      transition: 'var(--transition-base)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="Hoàn thành"
                  />

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: task.description ? 'pointer' : 'default',
                        color: 'var(--text-primary)',
                      }}
                      onClick={() => task.description && setExpandedTask(isExpanded ? null : task.id)}
                    >
                      {task.title}
                      {task.description && (
                        <span style={{ fontSize: '0.72rem', marginLeft: '0.35rem', color: 'var(--text-muted)' }}>
                          {isExpanded ? '▾' : '▸'}
                        </span>
                      )}
                    </div>

                    {/* Description expand */}
                    {isExpanded && task.description && (
                      <div style={{
                        marginTop: '0.4rem',
                        padding: '0.5rem 0.6rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {task.description}
                      </div>
                    )}

                    {/* Meta row */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      marginTop: '0.3rem', flexWrap: 'wrap',
                    }}>
                      {task.due_date !== todayStr() && (
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '0.1rem 0.45rem',
                          borderRadius: 'var(--radius-full)',
                          background: overdue ? 'rgba(239,68,68,0.12)' : 'rgba(139,92,246,0.1)',
                          color: overdue ? '#f87171' : '#a78bfa',
                        }}>
                          📅 {formatDate(task.due_date)}
                        </span>
                      )}
                      {task.due_time && (
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '0.1rem 0.45rem',
                          borderRadius: 'var(--radius-full)',
                          background: overdue ? 'rgba(239,68,68,0.12)' : 'rgba(6,182,212,0.1)',
                          color: overdue ? '#f87171' : '#22d3ee',
                        }}>
                          ⏰ {formatTime(task.due_time)}
                        </span>
                      )}
                      {overdue && (
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '0.1rem 0.45rem',
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(239,68,68,0.15)',
                          color: '#f87171',
                          fontWeight: 700,
                        }}>
                          Quá hạn
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => deleteTask(task.id)}
                    id={`task-delete-${task.id}`}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: '0.85rem',
                      padding: '0.15rem 0.3rem', borderRadius: 'var(--radius-sm)',
                      opacity: 0.5, transition: 'var(--transition-base)',
                    }}
                    title="Xoá"
                    onMouseEnter={e => e.target.style.opacity = 1}
                    onMouseLeave={e => e.target.style.opacity = 0.5}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed Today */}
      {completedToday.length > 0 && (
        <div style={{ marginTop: pendingTasks.length > 0 ? '0.75rem' : 0 }}>
          <div style={{
            fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem',
            display: 'flex', alignItems: 'center', gap: '0.3rem',
          }}>
            ✅ Đã hoàn thành hôm nay ({completedToday.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {completedToday.map(task => (
              <div key={task.id} style={{
                padding: '0.5rem 0.75rem',
                background: 'rgba(0,255,136,0.04)',
                border: '1px solid rgba(0,255,136,0.1)',
                borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <span style={{ color: 'var(--green)', fontSize: '0.9rem' }}>✓</span>
                <span style={{
                  textDecoration: 'line-through',
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem',
                  flex: 1,
                }}>
                  {task.title}
                </span>
                {task.completed_at && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {new Date(task.completed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {pendingTasks.length === 0 && completedToday.length === 0 && !isLoading && (
        <div style={{
          textAlign: 'center',
          padding: '1rem 0',
          color: 'var(--text-muted)',
          fontSize: '0.82rem',
        }}>
          {user ? 'Chưa có nhiệm vụ nào. Bấm "+ Thêm" để tạo!' : 'Đăng nhập để tạo và lưu nhiệm vụ.'}
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          ⏳ Đang tải...
        </div>
      )}
    </div>
  );
}

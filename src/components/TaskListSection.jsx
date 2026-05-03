import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserTasks } from '../hooks/useUserTasks';
import { useAuth } from '../contexts/AuthContext';

// Timezone-safe local date string
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const ENERGY_OPTIONS = [
  { key: null, label: 'Tất cả', icon: '📋' },
  { key: 'high', label: 'Cao', icon: '⚡' },
  { key: 'medium', label: 'Vừa', icon: '🔋' },
  { key: 'low', label: 'Thấp', icon: '🪫' },
  { key: 'none', label: 'Chưa gắn', icon: '➖' },
];

const DURATION_OPTIONS = [
  { value: 5, label: '5p' },
  { value: 15, label: '15p' },
  { value: 30, label: '30p' },
  { value: 60, label: '1h' },
  { value: 120, label: '2h+' },
];

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export default function TaskListSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    todayTasks, overdueTasks, futureTasks, completedToday,
    addTask, completeTask, uncompleteTask, updateTask, deleteTask, rolloverTask,
    isLoading,
  } = useUserTasks();

  const [showForm, setShowForm]     = useState(false);
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate]       = useState(todayStr());
  const [dueTime, setDueTime]       = useState('');

  // Energy + Duration + Recurrence form state
  const [energyLevel, setEnergyLevel]   = useState(null);
  const [durationEst, setDurationEst]   = useState(null);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [recType, setRecType]           = useState('interval');
  const [recDays, setRecDays]           = useState(7);
  const [recWeekday, setRecWeekday]     = useState(1);
  const [recMonthDay, setRecMonthDay]   = useState(1);

  // Filter state
  const [filterEnergy, setFilterEnergy] = useState(null);

  // Edit state — full fields
  const [editId, setEditId]               = useState(null);
  const [editTitle, setEditTitle]         = useState('');
  const [editDesc, setEditDesc]           = useState('');
  const [editDate, setEditDate]           = useState('');
  const [editTime, setEditTime]           = useState('');
  const [editEnergy, setEditEnergy]       = useState(null);
  const [editDuration, setEditDuration]   = useState(null);
  const [editShowRec, setEditShowRec]     = useState(false);
  const [editRecType, setEditRecType]     = useState('interval');
  const [editRecDays, setEditRecDays]     = useState(7);
  const [editRecWeekday, setEditRecWeekday] = useState(1);
  const [editRecMonthDay, setEditRecMonthDay] = useState(1);

  const [expandedTask, setExpandedTask] = useState(null);
  const [showFuture, setShowFuture]     = useState(false);

  /* ── Add ── */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    let recurrenceRule = null;
    if (showRecurrence) {
      if (recType === 'interval') recurrenceRule = { type: 'interval', days: recDays };
      else if (recType === 'weekly') recurrenceRule = { type: 'weekly', weekday: recWeekday };
      else if (recType === 'monthly') recurrenceRule = { type: 'monthly', day: recMonthDay };
    }

    await addTask({
      title: title.trim(),
      description: description.trim() || null,
      dueDate: dueDate || todayStr(),
      dueTime: dueTime || null,
      energyLevel: energyLevel,
      durationEst: durationEst,
      recurrenceRule,
    });
    setTitle(''); setDescription(''); setDueDate(todayStr()); setDueTime('');
    setEnergyLevel(null); setDurationEst(null);
    setShowRecurrence(false); setRecType('interval'); setRecDays(7);
    setShowForm(false);
  }, [title, description, dueDate, dueTime, energyLevel, durationEst, showRecurrence, recType, recDays, recWeekday, recMonthDay, addTask]);

  /* ── Inline edit ── */
  const startEdit = (task) => {
    setEditId(task.id);
    setEditTitle(task.title);
    setEditDesc(task.description || '');
    setEditDate(task.due_date || todayStr());
    setEditTime(task.due_time ? task.due_time.substring(0,5) : '');
    setEditEnergy(task.energy_level || null);
    setEditDuration(task.duration_est || null);
    const rec = task.recurrence_rule;
    if (rec) {
      setEditShowRec(true);
      setEditRecType(rec.type || 'interval');
      setEditRecDays(rec.days || 7);
      setEditRecWeekday(rec.weekday ?? 1);
      setEditRecMonthDay(rec.day || 1);
    } else {
      setEditShowRec(false);
      setEditRecType('interval'); setEditRecDays(7);
    }
  };

  const saveEdit = async (taskId) => {
    if (!editTitle.trim()) return;
    let recurrenceRule = null;
    if (editShowRec) {
      if (editRecType === 'interval') recurrenceRule = { type: 'interval', days: editRecDays };
      else if (editRecType === 'weekly')   recurrenceRule = { type: 'weekly',   weekday: editRecWeekday };
      else if (editRecType === 'monthly')  recurrenceRule = { type: 'monthly',  day: editRecMonthDay };
    }
    // updateTask passes changes directly to Supabase → must be snake_case
    await updateTask(taskId, {
      title:            editTitle.trim(),
      description:      editDesc.trim() || null,
      due_date:         editDate || todayStr(),
      due_time:         editTime || null,
      energy_level:     editEnergy,
      duration_est:     editDuration,
      recurrence_rule:  recurrenceRule,
    });
    setEditId(null);
  };

  const cancelEdit = () => setEditId(null);

  /* ── Helpers ── */
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

  const fmtTime = (t) => t ? t.substring(0, 5) : null;
  const fmtDate = (d) => {
    if (d === todayStr()) return 'Hôm nay';
    return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
  };

  const overdueDays = (d) => {
    const diff = Math.floor((new Date(todayStr() + 'T00:00:00') - new Date(d + 'T00:00:00')) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const totalPending = todayTasks.length + overdueTasks.length + futureTasks.length;

  // Apply energy filter
  const filterFn = (tasks) => {
    if (!filterEnergy) return tasks;
    if (filterEnergy === 'none') return tasks.filter(t => !t.energy_level);
    return tasks.filter(t => t.energy_level === filterEnergy);
  };
  const filteredToday   = filterFn(todayTasks);
  const filteredOverdue = filterFn(overdueTasks);
  const filteredFuture  = filterFn(futureTasks);

  const totalCount = totalPending + completedToday.length;

  const btnBase = {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '0.15rem 0.3rem', borderRadius: 'var(--radius-sm)',
    fontSize: '0.78rem', transition: 'var(--transition-base)',
  };

  /* ── Render a single task card ── */
  const renderTask = (task, options = {}) => {
    const { showRollover = false } = options;
    const overdue = isOverdue(task);
    const isEditing = editId === task.id;
    const isExpanded = expandedTask === task.id;

    return (
      <div key={task.id} className="task-item" style={{
        padding: '0.75rem',
        background: overdue ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${overdue ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 'var(--radius-md)', transition: 'var(--transition-base)',
      }}>
        {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem',
            background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)',
            borderRadius: 'var(--radius-md)', padding: '0.85rem', marginBottom: '0.25rem' }}>

            {/* Title */}
            <input className="auth-input" value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              style={{ fontSize: '0.88rem', fontWeight: 600 }} autoFocus
              placeholder="Tên nhiệm vụ *" />

            {/* Description */}
            <textarea className="auth-input" value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={2} placeholder="Mô tả..." style={{ resize: 'none', fontSize: '0.82rem' }} />

            {/* Date + Time */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>📅 Ngày</label>
                <input type="date" className="auth-input" value={editDate}
                  onChange={e => setEditDate(e.target.value)} style={{ fontSize: '0.82rem', width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>⏰ Giờ</label>
                <input type="time" className="auth-input" value={editTime}
                  onChange={e => setEditTime(e.target.value)} style={{ fontSize: '0.82rem', width: '100%' }} />
              </div>
            </div>

            {/* Energy */}
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Năng lượng</label>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {ENERGY_OPTIONS.filter(o => o.key && o.key !== 'none').map(opt => (
                  <button key={opt.key} type="button"
                    onClick={() => setEditEnergy(editEnergy === opt.key ? null : opt.key)}
                    style={{
                      padding: '0.28rem 0.6rem', borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem', cursor: 'pointer',
                      background: editEnergy === opt.key ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${editEnergy === opt.key ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: editEnergy === opt.key ? '#a78bfa' : 'var(--text-muted)',
                    }}>{opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>⏱ Ước tính thời gian</label>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {DURATION_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setEditDuration(editDuration === opt.value ? null : opt.value)}
                    style={{
                      padding: '0.28rem 0.55rem', borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem', cursor: 'pointer',
                      background: editDuration === opt.value ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${editDuration === opt.value ? 'rgba(6,182,212,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      color: editDuration === opt.value ? '#22d3ee' : 'var(--text-muted)',
                    }}>{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recurrence toggle */}
            <div>
              <button type="button"
                onClick={() => setEditShowRec(!editShowRec)}
                style={{
                  ...btnBase, fontSize: '0.78rem', padding: '0.28rem 0.6rem',
                  color: editShowRec ? '#22d3ee' : 'var(--text-muted)',
                  background: editShowRec ? 'rgba(6,182,212,0.1)' : 'transparent',
                  border: `1px solid ${editShowRec ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}>🔁 {editShowRec ? 'Lặp lại ✓' : 'Lặp lại'}
              </button>
              {editShowRec && (
                <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem',
                  padding: '0.6rem', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.12)' }}>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[{ key: 'interval', label: 'Mỗi N ngày' }, { key: 'weekly', label: 'Hàng tuần' }, { key: 'monthly', label: 'Hàng tháng' }].map(rt => (
                      <button key={rt.key} type="button" onClick={() => setEditRecType(rt.key)}
                        style={{
                          padding: '0.22rem 0.45rem', borderRadius: 'var(--radius-sm)',
                          fontSize: '0.72rem', cursor: 'pointer',
                          background: editRecType === rt.key ? 'rgba(6,182,212,0.15)' : 'transparent',
                          border: `1px solid ${editRecType === rt.key ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.08)'}`,
                          color: editRecType === rt.key ? '#22d3ee' : 'var(--text-muted)',
                        }}>{rt.label}
                      </button>
                    ))}
                  </div>
                  {editRecType === 'interval' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mỗi</span>
                      <input type="number" min="1" max="365" value={editRecDays}
                        onChange={e => setEditRecDays(Math.max(1, parseInt(e.target.value)||1))}
                        className="auth-input" style={{ width: '60px', fontSize: '0.82rem', textAlign: 'center' }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ngày</span>
                    </div>
                  )}
                  {editRecType === 'weekly' && (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {WEEKDAYS.map((day, i) => (
                        <button key={i} type="button" onClick={() => setEditRecWeekday(i)}
                          style={{
                            padding: '0.22rem 0.38rem', borderRadius: 'var(--radius-sm)',
                            fontSize: '0.72rem', cursor: 'pointer',
                            background: editRecWeekday === i ? 'rgba(6,182,212,0.2)' : 'transparent',
                            border: `1px solid ${editRecWeekday === i ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.08)'}`,
                            color: editRecWeekday === i ? '#22d3ee' : 'var(--text-muted)',
                          }}>{day}
                        </button>
                      ))}
                    </div>
                  )}
                  {editRecType === 'monthly' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ngày</span>
                      <input type="number" min="1" max="31" value={editRecMonthDay}
                        onChange={e => setEditRecMonthDay(Math.min(31, Math.max(1, parseInt(e.target.value)||1)))}
                        className="auth-input" style={{ width: '55px', fontSize: '0.82rem', textAlign: 'center' }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>mỗi tháng</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => saveEdit(task.id)} className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
                disabled={!editTitle.trim()}>
                ✓ Lưu
              </button>
              <button onClick={cancelEdit} className="btn btn-ghost"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', color: 'var(--text-muted)' }}>
                Huỷ
              </button>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            {/* Checkbox */}
            <button onClick={() => completeTask(task.id)} id={`task-check-${task.id}`}
              style={{
                width: 22, height: 22, minWidth: 22, borderRadius: 'var(--radius-sm)',
                border: `2px solid ${overdue ? 'rgba(239,68,68,0.4)' : 'rgba(139,92,246,0.4)'}`,
                background: 'transparent', cursor: 'pointer', marginTop: '0.1rem',
                transition: 'var(--transition-base)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }} title="Hoàn thành" />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', cursor: task.description ? 'pointer' : 'default' }}
                onClick={() => task.description && setExpandedTask(isExpanded ? null : task.id)}>
                {task.title}
                {task.description && (
                  <span style={{ fontSize: '0.72rem', marginLeft: '0.35rem', color: 'var(--text-muted)' }}>
                    {isExpanded ? '▾' : '▸'}
                  </span>
                )}
              </div>

              {isExpanded && task.description && (
                <div style={{
                  marginTop: '0.4rem', padding: '0.5rem 0.6rem',
                  background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}>
                  {task.description}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                {task.due_date !== todayStr() && (
                  <span style={{
                    fontSize: '0.72rem', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)',
                    background: overdue ? 'rgba(239,68,68,0.12)' : 'rgba(139,92,246,0.1)',
                    color: overdue ? '#f87171' : '#a78bfa',
                  }}>📅 {fmtDate(task.due_date)}</span>
                )}
                {task.due_time && (
                  <span style={{
                    fontSize: '0.72rem', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)',
                    background: overdue ? 'rgba(239,68,68,0.12)' : 'rgba(6,182,212,0.1)',
                    color: overdue ? '#f87171' : '#22d3ee',
                  }}>⏰ {fmtTime(task.due_time)}</span>
                )}
                {overdue && !showRollover && (
                  <span style={{
                    fontSize: '0.68rem', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)',
                    background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 700,
                  }}>Quá hạn</span>
                )}
                {task.recurrence_rule && (
                  <span style={{
                    fontSize: '0.68rem', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)',
                    background: 'rgba(6,182,212,0.1)', color: '#22d3ee',
                  }}>🔁 {task.recurrence_rule.type === 'interval' ? `${task.recurrence_rule.days}d` : task.recurrence_rule.type === 'weekly' ? WEEKDAYS[task.recurrence_rule.weekday] : `D${task.recurrence_rule.day}`}</span>
                )}
                {task.energy_level && (
                  <span style={{
                    fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)',
                    background: task.energy_level === 'high' ? 'rgba(234,179,8,0.12)' : task.energy_level === 'medium' ? 'rgba(139,92,246,0.1)' : 'rgba(100,116,139,0.12)',
                    color: task.energy_level === 'high' ? '#eab308' : task.energy_level === 'medium' ? '#a78bfa' : '#94a3b8',
                  }}>{task.energy_level === 'high' ? '⚡' : task.energy_level === 'medium' ? '🔋' : '🪫'}</span>
                )}
                {task.duration_est && (
                  <span style={{
                    fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)',
                    background: 'rgba(139,92,246,0.08)', color: 'var(--text-muted)',
                  }}>⏱ {task.duration_est >= 60 ? `${Math.floor(task.duration_est / 60)}h${task.duration_est % 60 ? task.duration_est % 60 + 'p' : ''}` : `${task.duration_est}p`}</span>
                )}
                {task.collection_id && (
                  <span
                    onClick={(e) => { e.stopPropagation(); navigate('/collect'); }}
                    style={{
                      fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)',
                      background: 'rgba(6,182,212,0.1)', color: '#22d3ee', cursor: 'pointer',
                    }}
                    title="Xem bài viết liên kết"
                  >🔗 KB</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.15rem', flexShrink: 0, alignItems: 'center' }}>
              {showRollover && (
                <button onClick={() => rolloverTask(task.id)} id={`task-rollover-${task.id}`}
                  style={{ ...btnBase, color: '#f59e0b', opacity: 0.8, fontSize: '0.72rem' }}
                  title="Dời sang hôm nay"
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.8}>
                  🔄
                </button>
              )}
              <button onClick={() => startEdit(task)} id={`task-edit-${task.id}`}
                style={{ ...btnBase, color: 'var(--text-muted)', opacity: 0.6 }}
                title="Sửa"
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0.6}>
                ✏️
              </button>
              <button onClick={() => deleteTask(task.id)} id={`task-delete-${task.id}`}
                style={{ ...btnBase, color: 'var(--text-muted)', opacity: 0.5 }}
                title="Xoá"
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
                🗑
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card task-list-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="dash-card-title" style={{ margin: 0 }}>📌 Nhiệm Vụ</span>
          {totalCount > 0 && (
            <span style={{
              background: (todayTasks.length + overdueTasks.length) > 0 ? 'rgba(139,92,246,0.2)' : 'rgba(0,255,136,0.15)',
              color: (todayTasks.length + overdueTasks.length) > 0 ? '#a78bfa' : 'var(--green)',
              padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)',
              fontSize: '0.72rem', fontWeight: 700,
            }}>
              {todayTasks.length + overdueTasks.length}/{totalCount}
            </span>
          )}
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => setShowForm(!showForm)}
          id="task-add-btn"
          style={{ fontSize: '0.82rem', padding: '0.3rem 0.75rem', color: showForm ? 'var(--red)' : 'var(--purple)' }}
        >
          {showForm ? '✕ Đóng' : '+ Thêm'}
        </button>
      </div>

      {/* ── Add Form ── */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{
          background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)',
          borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '0.75rem',
          display: 'flex', flexDirection: 'column', gap: '0.6rem',
        }}>
          <input type="text" placeholder="Tên nhiệm vụ *" value={title} onChange={e => setTitle(e.target.value)}
            required id="task-title-input" className="auth-input" style={{ fontSize: '0.88rem' }} />
          <textarea placeholder="Mô tả (tuỳ chọn)..." value={description} onChange={e => setDescription(e.target.value)}
            id="task-desc-input" className="auth-input" rows={2} style={{ resize: 'none', fontSize: '0.82rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>📅 Ngày</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                id="task-date-input" className="auth-input" style={{ fontSize: '0.82rem', width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>⏰ Giờ (tuỳ chọn)</label>
              <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                id="task-time-input" className="auth-input" style={{ fontSize: '0.82rem', width: '100%' }} />
            </div>
          </div>

          {/* ── Energy Level ── */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Năng lượng</label>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {ENERGY_OPTIONS.filter(o => o.key && o.key !== 'none').map(opt => (
                <button key={opt.key} type="button"
                  onClick={() => setEnergyLevel(energyLevel === opt.key ? null : opt.key)}
                  style={{
                    padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem', cursor: 'pointer',
                    background: energyLevel === opt.key ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${energyLevel === opt.key ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: energyLevel === opt.key ? '#a78bfa' : 'var(--text-muted)',
                    transition: 'var(--transition-base)',
                  }}>
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Duration Estimate ── */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Ước tính thời gian</label>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {DURATION_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setDurationEst(durationEst === opt.value ? null : opt.value)}
                  style={{
                    padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem', cursor: 'pointer',
                    background: durationEst === opt.value ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${durationEst === opt.value ? 'rgba(6,182,212,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    color: durationEst === opt.value ? '#22d3ee' : 'var(--text-muted)',
                    transition: 'var(--transition-base)',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Recurrence ── */}
          <div>
            <button type="button"
              onClick={() => setShowRecurrence(!showRecurrence)}
              style={{
                ...btnBase, display: 'flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.78rem', padding: '0.3rem 0.6rem',
                color: showRecurrence ? '#22d3ee' : 'var(--text-muted)',
                background: showRecurrence ? 'rgba(6,182,212,0.1)' : 'transparent',
                border: `1px solid ${showRecurrence ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 'var(--radius-sm)',
              }}>
              🔁 {showRecurrence ? 'Lặp lại ✓' : 'Lặp lại'}
            </button>
            {showRecurrence && (
              <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem',
                padding: '0.6rem', borderRadius: 'var(--radius-sm)',
                background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.12)',
              }}>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[
                    { key: 'interval', label: 'Mỗi N ngày' },
                    { key: 'weekly', label: 'Hàng tuần' },
                    { key: 'monthly', label: 'Hàng tháng' },
                  ].map(rt => (
                    <button key={rt.key} type="button"
                      onClick={() => setRecType(rt.key)}
                      style={{
                        padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)',
                        fontSize: '0.72rem', cursor: 'pointer',
                        background: recType === rt.key ? 'rgba(6,182,212,0.15)' : 'transparent',
                        border: `1px solid ${recType === rt.key ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        color: recType === rt.key ? '#22d3ee' : 'var(--text-muted)',
                        transition: 'var(--transition-base)',
                      }}>
                      {rt.label}
                    </button>
                  ))}
                </div>
                {recType === 'interval' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mỗi</span>
                    <input type="number" min="1" max="365" value={recDays}
                      onChange={e => setRecDays(Math.max(1, parseInt(e.target.value) || 1))}
                      className="auth-input" style={{ width: '60px', fontSize: '0.82rem', textAlign: 'center' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ngày</span>
                  </div>
                )}
                {recType === 'weekly' && (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {WEEKDAYS.map((day, i) => (
                      <button key={i} type="button" onClick={() => setRecWeekday(i)}
                        style={{
                          padding: '0.25rem 0.4rem', borderRadius: 'var(--radius-sm)',
                          fontSize: '0.72rem', cursor: 'pointer',
                          background: recWeekday === i ? 'rgba(6,182,212,0.2)' : 'transparent',
                          border: `1px solid ${recWeekday === i ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.08)'}`,
                          color: recWeekday === i ? '#22d3ee' : 'var(--text-muted)',
                        }}>
                        {day}
                      </button>
                    ))}
                  </div>
                )}
                {recType === 'monthly' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ngày</span>
                    <input type="number" min="1" max="31" value={recMonthDay}
                      onChange={e => setRecMonthDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="auth-input" style={{ width: '55px', fontSize: '0.82rem', textAlign: 'center' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>mỗi tháng</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()} id="task-submit-btn"
            style={{ justifyContent: 'center', padding: '0.65rem', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            📌 Thêm Nhiệm Vụ
          </button>
        </form>
      )}

      {/* ── Energy Filter Chips ── */}
      {totalPending > 0 && (
        <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
          {ENERGY_OPTIONS.map(opt => (
            <button
              key={opt.key ?? 'all'}
              onClick={() => setFilterEnergy(opt.key)}
              style={{
                padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem', fontWeight: filterEnergy === opt.key ? 700 : 500,
                background: filterEnergy === opt.key ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${filterEnergy === opt.key ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: filterEnergy === opt.key ? '#a78bfa' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'var(--transition-base)',
              }}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Overdue Section ── */}
      {filteredOverdue.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{
            fontSize: '0.75rem', fontWeight: 700, color: '#f87171', marginBottom: '0.5rem',
            display: 'flex', alignItems: 'center', gap: '0.35rem',
          }}>
            ⚠️ Quá hạn ({filteredOverdue.length})
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.4rem',
            padding: '0.5rem', borderRadius: 'var(--radius-md)',
            background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)',
          }}>
            {filteredOverdue.map(task => renderTask(task, { showRollover: true }))}
          </div>
        </div>
      )}

      {/* ── Today Section ── */}
      {filteredToday.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {filteredOverdue.length > 0 && (
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              📅 Hôm nay ({filteredToday.length})
            </div>
          )}
          {filteredToday.map(task => renderTask(task))}
        </div>
      )}

      {/* ── Future Section (collapsed) ── */}
      {filteredFuture.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <button
            onClick={() => setShowFuture(!showFuture)}
            style={{
              ...btnBase, display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600,
              padding: '0.3rem 0', width: '100%', justifyContent: 'flex-start',
            }}>
            {showFuture ? '▾' : '▸'} 🔮 Sắp tới ({filteredFuture.length})
          </button>
          {showFuture && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
              {filteredFuture.map(task => renderTask(task))}
            </div>
          )}
        </div>
      )}

      {/* ── Completed Today ── */}
      {completedToday.length > 0 && (
        <div style={{ marginTop: (todayTasks.length > 0 || overdueTasks.length > 0 || futureTasks.length > 0) ? '0.75rem' : 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            ✅ Đã hoàn thành hôm nay ({completedToday.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {completedToday.map(task => (
              <div key={task.id} style={{
                padding: '0.5rem 0.75rem',
                background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.1)',
                borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <span style={{ color: 'var(--green)', fontSize: '0.9rem' }}>✓</span>
                <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.82rem', flex: 1 }}>
                  {task.title}
                </span>
                {task.completed_at && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {new Date(task.completed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {/* Uncheck */}
                <button
                  onClick={() => uncompleteTask(task.id)}
                  id={`task-uncheck-${task.id}`}
                  style={{ ...btnBase, opacity: 0.5, color: 'var(--text-muted)' }}
                  title="Đánh dấu chưa xong"
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                >↩</button>
                {/* Delete */}
                <button
                  onClick={() => deleteTask(task.id)}
                  id={`task-delete-done-${task.id}`}
                  style={{ ...btnBase, opacity: 0.45, color: 'var(--text-muted)' }}
                  title="Xoá"
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.45}
                >🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {todayTasks.length === 0 && overdueTasks.length === 0 && futureTasks.length === 0 && completedToday.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
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

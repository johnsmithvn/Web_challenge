import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserTasks } from '../hooks/useUserTasks';
import { useAuth } from '../contexts/AuthContext';
import { useCollections } from '../hooks/useCollections';
import { useTags } from '../hooks/useTags';
import LinkKBModal from './LinkKBModal';
import DatePickerPopover from './DatePickerPopover';
import TagPicker from './TagPicker';
import TaskDetailModal from './TaskDetailModal';
import { useConfirm } from './ConfirmModal';
import { toDateStr } from '../utils/dateUtils';
// v5.0.0: PRIORITY_OPTIONS/WEEKDAYS dời sang utils/taskFields để TaskDetailModal
// dùng chung mà không phải import ngược file này (vòng tròn import).
import { PRIORITY_OPTIONS, WEEKDAYS } from '../utils/taskFields';
import UI_STRINGS from '../data/ui-strings.json';
import AppIcon from './AppIcon';
import '../styles/tasks.css';

const fmtDMY = (d) => new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function TaskListSection({ showForm, setShowForm }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    todayTasks, overdueTasks, futureTasks,
    addTask, completeTask, uncompleteTask, updateTask, deleteTask,
    linkCollection, unlinkCollection,
    linkTaskTag, unlinkTaskTag,
    getCompletedTasksRange,
    isLoading,
  } = useUserTasks();
  const { items: allCollections, fetchItems: fetchCollections } = useCollections();
  const { tags: allTags, addTag } = useTags();
  const { confirm, ConfirmModal } = useConfirm();

  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate]       = useState(toDateStr());
  const [dueTime, setDueTime]       = useState('23:59');

  // Priority + Recurrence + Tags form state
  const [priority, setPriority]         = useState(0);
  const [tagIds, setTagIds]             = useState([]);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [recType, setRecType]           = useState('interval');
  const [recDays, setRecDays]           = useState(7);
  const [recWeekday, setRecWeekday]     = useState(1);
  const [recMonthDay, setRecMonthDay]   = useState(1);

  // Edit state — full fields
  const [editId, setEditId]               = useState(null);
  const [editTitle, setEditTitle]         = useState('');
  const [editDesc, setEditDesc]           = useState('');
  const [editDate, setEditDate]           = useState('');
  const [editTime, setEditTime]           = useState('');
  const [editPriority, setEditPriority]   = useState(0);
  const [editTagIds, setEditTagIds]       = useState([]);
  const [editShowRec, setEditShowRec]     = useState(false);
  const [editRecType, setEditRecType]     = useState('interval');
  const [editRecDays, setEditRecDays]     = useState(7);
  const [editRecWeekday, setEditRecWeekday] = useState(1);
  const [editRecMonthDay, setEditRecMonthDay] = useState(1);

  const [showFuture, setShowFuture]     = useState(false);
  const [detailTaskId, setDetailTaskId] = useState(null);
  // v6.1.0: mở lại cơ chế expand mô tả tại chỗ (v5.0.0 từng bỏ vì 1 click có 2
  // nghĩa). Giờ không còn xung đột: popup Chi tiết đã có nút con mắt riêng.
  const [expandedId, setExpandedId]     = useState(null);

  // ── Completed section (collapsed by default, lọc theo KHOẢNG ngày A→B) ──
  const [showCompleted, setShowCompleted]   = useState(false);
  const [range, setRange]                   = useState({ from: toDateStr(), to: toDateStr() });
  const [completedList, setCompletedList]   = useState([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [showRangeDP, setShowRangeDP]   = useState(false);
  const [showAddDP, setShowAddDP]       = useState(false);
  const [showEditDP, setShowEditDP]     = useState(false);
  const [quickDateTaskId, setQuickDateTaskId] = useState(null);
  const [overflowTaskId, setOverflowTaskId]   = useState(null); // mobile "..." action menu
  const [linkTaskId, setLinkTaskId]     = useState(null); // task ID for LinkKBModal

  // Fetch collections when modal opens (allCollections is lazy — not auto-fetched)
  useEffect(() => {
    if (linkTaskId && fetchCollections) fetchCollections({});
  }, [linkTaskId, fetchCollections]);

  // Fetch completed tasks trong khoảng đang chọn — chỉ khi section đang mở.
  // getCompletedTasksRange đệm ±1 ngày cho lệch timezone nên phải tự lọc lại đúng
  // ngày địa phương (cùng pattern với MonthCalendar).
  useEffect(() => {
    if (!showCompleted) return;
    let stale = false;
    setCompletedLoading(true);
    getCompletedTasksRange(range.from, range.to).then(rows => {
      if (stale) return;
      const filtered = (rows || [])
        .filter(r => {
          if (!r.completed_at) return false;
          const d = toDateStr(new Date(r.completed_at));
          return d >= range.from && d <= range.to;
        })
        // Khoảng nhiều ngày thì mới nhất phải nằm trên (hook trả về tăng dần).
        .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
      setCompletedList(filtered);
      setCompletedLoading(false);
    });
    return () => { stale = true; };
  }, [showCompleted, range, getCompletedTasksRange]);

  const confirmDeleteTask = useCallback((task) => {
    const cfg = UI_STRINGS.confirm.deleteTask;
    return confirm({ ...cfg, message: cfg.message.replace('{name}', task.title) });
  }, [confirm]);

  // Xoá task đang pending (quá hạn/hôm nay/sắp tới) — `deleteTask` đã tự filter
  // khỏi `tasks` state nên todayTasks/overdueTasks/futureTasks tự cập nhật.
  const handleDeleteTask = useCallback(async (task) => {
    if (!(await confirmDeleteTask(task))) return;
    await deleteTask(task.id);
  }, [confirmDeleteTask, deleteTask]);

  const handleDeleteCompleted = useCallback(async (task) => {
    if (!(await confirmDeleteTask(task))) return;
    const deleted = await deleteTask(task.id);
    if (deleted !== false) setCompletedList(prev => prev.filter(t => t.id !== task.id));
  }, [confirmDeleteTask, deleteTask]);

  // Bỏ tích từ khung lịch sử. Task của ngày CŨ không nằm trong `tasks` state
  // (fetchTasks chỉ lấy completed hôm nay) nên nó chỉ rời khung này; task hôm
  // nay thì hiện lại đúng khối pending ngay lập tức.
  const handleUncomplete = useCallback(async (task) => {
    await uncompleteTask(task.id);
    setCompletedList(prev => prev.filter(t => t.id !== task.id));
  }, [uncompleteTask]);

  // completedList là dữ liệu tải riêng theo khoảng ngày, nên optimistic state
  // trong useUserTasks không tự chảy vào đây. Cập nhật cả hai bằng cùng timestamp
  // và rollback hàng lịch sử nếu Supabase từ chối thao tác.
  const handleComplete = useCallback(async (task) => {
    const completedAt = new Date().toISOString();
    const completedDate = toDateStr(new Date(completedAt));
    const appearsInRange = completedDate >= range.from && completedDate <= range.to;

    if (appearsInRange) {
      setCompletedList(prev => [
        { ...task, completed: true, completed_at: completedAt },
        ...prev.filter(item => item.id !== task.id),
      ]);
    }

    const saved = await completeTask(task.id, completedAt);
    if (!saved && appearsInRange) {
      setCompletedList(prev => prev.filter(item => item.id !== task.id));
    }
    return saved;
  }, [completeTask, range]);

  // Close mobile overflow menu on outside click
  useEffect(() => {
    if (!overflowTaskId) return;
    const handler = (e) => {
      if (!e.target.closest('.task-actions--mobile')) setOverflowTaskId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowTaskId]);

  /**
   * Mở/gập mô tả tại chỗ. Guard cho mobile: cột nội dung nằm NGOÀI
   * `.task-actions--mobile`, nên thao tác "mở menu ⋯ rồi bấm ra ngoài để đóng"
   * sẽ vô tình bung mô tả. Menu đang mở → cú bấm đó chỉ đóng menu.
   */
  const toggleExpand = useCallback((taskId) => {
    if (overflowTaskId) { setOverflowTaskId(null); return; }
    setExpandedId(prev => prev === taskId ? null : taskId);
  }, [overflowTaskId]);

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

    const created = await addTask({
      title: title.trim(),
      description: description.trim() || null,
      dueDate: dueDate || toDateStr(),
      dueTime: dueTime || '00:00',
      priority,
      recurrenceRule,
    });
    if (created && tagIds.length > 0) {
      const selectedTags = allTags.filter(t => tagIds.includes(t.id));
      await Promise.all(selectedTags.map(tag => linkTaskTag(created.id, tag)));
    }
    setTitle(''); setDescription(''); setDueDate(toDateStr()); setDueTime('23:59');
    setPriority(0); setTagIds([]);
    setShowRecurrence(false); setRecType('interval'); setRecDays(7);
    setShowForm(false);
  }, [title, description, dueDate, dueTime, priority, tagIds, allTags, showRecurrence, recType, recDays, recWeekday, recMonthDay, addTask, linkTaskTag, setShowForm]);

  /* ── Inline edit ── */
  const startEdit = (task) => {
    setEditId(task.id);
    setEditTitle(task.title);
    setEditDesc(task.description || '');
    setEditDate(task.due_date || toDateStr());
    setEditTime(task.due_time ? task.due_time.substring(0,5) : '');
    setEditPriority(task.priority || 0);
    setEditTagIds((task._tags || []).map(t => t.id));
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
    const changes = {
      title:            editTitle.trim(),
      description:      editDesc.trim() || null,
      due_date:         editDate || toDateStr(),
      due_time:         editTime || null,
      priority:         editPriority,
      recurrence_rule:  recurrenceRule,
    };
    const saved = await updateTask(taskId, changes);
    if (!saved) return;
    setCompletedList(prev => prev.map(task => task.id === taskId ? { ...task, ...changes } : task));

    // Diff tags against current state → link mới thêm, unlink cái bị bỏ chọn
    const task = [...todayTasks, ...overdueTasks, ...futureTasks, ...completedList].find(t => t.id === taskId);
    const currentTagIds = (task?._tags || []).map(t => t.id);
    const toAdd = editTagIds.filter(id => !currentTagIds.includes(id));
    const toRemove = currentTagIds.filter(id => !editTagIds.includes(id));
    const tagsToAdd = allTags.filter(t => toAdd.includes(t.id));
    await Promise.all([
      ...tagsToAdd.map(tag => linkTaskTag(taskId, tag)),
      ...toRemove.map(tagId => unlinkTaskTag(taskId, tagId)),
    ]);

    setEditId(null);
  };

  const cancelEdit = () => setEditId(null);

  /* ── Helpers ── */
  const isOverdue = (task) => {
    const now = new Date();
    const taskDate = new Date(task.due_date + 'T00:00:00');
    if (taskDate < new Date(toDateStr() + 'T00:00:00')) return true;
    if (task.due_time && task.due_time.substring(0, 5) !== '00:00' && task.due_time.substring(0, 5) !== '23:59' && task.due_date === toDateStr()) {
      const [h, m] = task.due_time.split(':').map(Number);
      if (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) return true;
    }
    return false;
  };

  const fmtTime = (t) => t ? t.substring(0, 5) : null;
  // Khoảng lọc nhiều ngày thì "Xong lúc" phải kèm ngày, 1 ngày thì giờ là đủ.
  const doneAt = (iso) => {
    const d = new Date(iso);
    const t = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return range.from === range.to ? t : `${d.getDate()}/${d.getMonth() + 1} ${t}`;
  };
  const fmtDate = (d) => {
    if (d === toDateStr()) return 'Hôm nay';
    return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
  };


  const totalPending = todayTasks.length + overdueTasks.length + futureTasks.length;


  /* ── Render a single task card ── */
  const renderTask = (task, options = {}) => {
    const { showRollover = false, insideDetail = false } = options;
    const overdue = isOverdue(task);
    // Cùng một form có thể được render ở list hoặc popup, nhưng không được hiện
    // ở cả hai nơi cùng lúc khi popup đang sở hữu phiên sửa.
    const isEditing = editId === task.id && (insideDetail || detailTaskId !== task.id);
    const expanded = expandedId === task.id;

    // Dải màu priority bên trái — quét mắt thấy ngay cái nào gấp.
    // Màu lấy từ PRIORITY_OPTIONS, không thêm token/class mới.
    const pri = PRIORITY_OPTIONS.find(o => o.value === task.priority);
    const stripe = task.priority > 0 && pri ? { borderLeft: `3px solid ${pri.color}` } : {};

    return (
      <div key={task.id} className="task-item" style={{
        ...stripe,
        ...(overdue ? {
          background: 'rgba(239,68,68,0.06)',
          borderColor: 'rgba(239,68,68,0.2)',
          ...(task.priority > 0 && pri ? { borderLeftColor: pri.color } : {}),
        } : {}),
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
            <textarea className="auth-input task-desc-input" value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={2} placeholder="Mô tả..." style={{ fontSize: '0.82rem' }} />

            {/* Date + Time (DatePicker) */}
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => setShowEditDP(!showEditDP)}
                className="auth-input"
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '0.82rem',
                }}>
                <AppIcon name="calendar" size={14} /> {editDate ? new Date(editDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Chọn ngày'}
                {editTime && editTime !== '00:00' && <> · <AppIcon name="clock" size={14} /> {editTime}</>}
              </button>
              {showEditDP && (
                <DatePickerPopover
                  value={editDate}
                  onChange={(d) => setEditDate(d)}
                  onClose={() => setShowEditDP(false)}
                  timeValue={editTime}
                  onTimeChange={setEditTime}
                  style={{ top: '100%', left: 0, marginTop: '0.25rem' }}
                />
              )}
            </div>

            {/* Priority */}
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Độ ưu tiên</label>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {PRIORITY_OPTIONS.filter(o => o.value > 0).map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setEditPriority(editPriority === opt.value ? 0 : opt.value)}
                    className={`task-option-btn ${editPriority === opt.value ? 'active' : ''}`}
                    style={editPriority === opt.value ? {
                      background: `${opt.color}20`,
                      borderColor: `${opt.color}60`,
                      color: opt.color,
                    } : {}}><AppIcon name={opt.icon} size={14} /> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recurrence toggle */}
            <div>
              <button type="button"
                onClick={() => setEditShowRec(!editShowRec)}
                className={`task-option-btn ${editShowRec ? 'task-option-btn--active-cyan' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              ><AppIcon name="refresh" size={14} /> {editShowRec ? 'Lặp lại' : 'Lặp lại'} {editShowRec && <AppIcon name="check" size={12} />}
              </button>
              {editShowRec && (
                <div className="task-form-rec-panel">
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[{ key: 'interval', label: 'Mỗi N ngày' }, { key: 'weekly', label: 'Hàng tuần' }, { key: 'monthly', label: 'Hàng tháng' }].map(rt => (
                      <button key={rt.key} type="button" onClick={() => setEditRecType(rt.key)}
                        className={`task-option-btn ${editRecType === rt.key ? 'task-option-btn--active-cyan' : ''}`}
                        style={{ padding: '0.22rem 0.45rem', fontSize: '0.72rem' }}
                      >{rt.label}
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
                          className={`task-option-btn ${editRecWeekday === i ? 'task-option-btn--active-cyan' : ''}`}
                          style={{ padding: '0.22rem 0.38rem', fontSize: '0.72rem' }}
                        >{day}
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

            {/* Tags */}
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Tag</label>
              <TagPicker
                tags={allTags}
                selected={editTagIds}
                onToggle={(tagId) => setEditTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId])}
                onAdd={addTag}
              />
            </div>

            {/* KB Link */}
            <div>
              <button type="button"
                onClick={() => setLinkTaskId(task.id)}
                className={`task-option-btn ${(task._collections || []).length > 0 ? 'task-option-btn--active-cyan' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              ><AppIcon name="link" size={14} /> {(task._collections || []).length > 0 ? `${(task._collections || []).length} bài viết liên kết` : 'Liên kết bài viết'}
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => saveEdit(task.id)} className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
                disabled={!editTitle.trim()}>
                <AppIcon name="save" size={14} /> Lưu
              </button>
              <button onClick={cancelEdit} className="btn btn-ghost"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', color: 'var(--text-muted)' }}>
                Huỷ
              </button>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <div className="task-row-view">
            {/* Checkbox */}
            {/* Animation tick nằm hoàn toàn trong CSS (:active + :hover) — không cần state React */}
            <button onClick={() => handleComplete(task)} id={`task-check-${task.id}`}
              className="task-checkbox-btn"
              style={{
                border: `2px solid ${overdue ? 'rgba(239,68,68,0.4)' : 'rgba(139,92,246,0.4)'}`,
              }} title="Hoàn thành" aria-label={`Hoàn thành: ${task.title}`} />

            {/* Vạch ngăn tick ↔ nội dung */}
            <span className="task-row-sep" aria-hidden="true" />

            {/* Content — bấm = mở/gập mô tả NGAY TẠI CHỖ (v6.1.0). Popup chi
                tiết đi bằng nút con mắt riêng bên phải, nên 1 click chỉ còn 1
                nghĩa. Cố ý gắn onClick Ở ĐÂY chứ không phải trên cả
                `.task-item`: đặt trên container thì checkbox và mọi nút hành
                động đều bubble lên, phải rắc stopPropagation ~10 chỗ. */}
            <div className="task-row-body"
              role="button" tabIndex={0} title={expanded ? 'Thu gọn' : 'Xem mô tả'}
              onClick={() => toggleExpand(task.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(task.id); }
              }}>
              {/* Tiêu đề + toàn bộ nhãn nằm CÙNG 1 hàng; màn hẹp mới xuống dòng. */}
              <div className="task-row-line">
                <span className="task-title-1line"
                  style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  {task.title}
                </span>
                {task.due_date !== toDateStr() && (
                  <span className="task-chip" style={{
                    background: overdue ? 'rgba(239,68,68,0.12)' : 'rgba(139,92,246,0.1)',
                    color: overdue ? '#f87171' : '#a78bfa',
                  }}><AppIcon name="calendar" size={12} weight="bold" /> {fmtDate(task.due_date)}</span>
                )}
                {task.due_time && task.due_time.substring(0,5) !== '00:00' && task.due_time.substring(0,5) !== '23:59' && (
                  <span className="task-chip" style={{
                    background: overdue ? 'rgba(239,68,68,0.12)' : 'rgba(6,182,212,0.1)',
                    color: overdue ? '#f87171' : '#22d3ee',
                  }}><AppIcon name="clock" size={12} weight="bold" /> {fmtTime(task.due_time)}</span>
                )}
                {overdue && !showRollover && (
                  <span className="task-chip" style={{
                    background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 700,
                  }}>Quá hạn</span>
                )}
                {task.due_date === toDateStr() && !overdue && (
                  <span className="task-chip" style={{
                    background: 'rgba(234,179,8,0.12)', color: '#eab308', fontWeight: 600,
                    border: '1px solid rgba(234,179,8,0.2)'
                  }}><AppIcon name="timer" size={12} weight="bold" /> Nhanh lên sắp hết ngày rồi</span>
                )}
                {task.recurrence_rule && (
                  <span className="task-chip" style={{
                    background: 'rgba(6,182,212,0.1)', color: '#22d3ee',
                  }}><AppIcon name="refresh" size={12} weight="bold" /> {task.recurrence_rule.type === 'interval' ? `${task.recurrence_rule.days}d` : task.recurrence_rule.type === 'weekly' ? WEEKDAYS[task.recurrence_rule.weekday] : `D${task.recurrence_rule.day}`}</span>
                )}
                {task.priority > 0 && (() => {
                  const p = PRIORITY_OPTIONS.find(o => o.value === task.priority);
                  return p ? (
                    <span className="task-chip" style={{ background: `${p.color}18`, color: p.color }}>
                      <AppIcon name={p.icon} size={12} weight="bold" /> {p.label}
                    </span>
                  ) : null;
                })()}
                {(task._collections || []).length > 0 && (
                  <span className="task-chip"
                    onClick={(e) => { e.stopPropagation(); navigate('/collect'); }}
                    style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee', cursor: 'pointer' }}
                    title="Xem bài viết liên kết"
                  ><AppIcon name="link" size={12} weight="bold" /> {(task._collections || []).length} bài</span>
                )}
                {(task._tags || []).map(tag => (
                  <span key={tag.id} className="task-chip"
                    style={{ background: `${tag.color}18`, color: tag.color }}
                  ><AppIcon name="tag" size={12} weight="bold" /> {tag.name}</span>
                ))}
              </div>

              {expanded && (
                <div className="task-desc-box">
                  {task.description || <span style={{ color: 'var(--text-muted)' }}>Nhiệm vụ này chưa có mô tả.</span>}
                </div>
              )}
            </div>

            {/* Actions — Desktop: inline buttons, Mobile: overflow ⋯ */}
            <div className="task-row-acts">
              {/* ── Desktop buttons (hidden on mobile via CSS) ── */}
              <div className="task-actions--desktop">
                <button onClick={() => setDetailTaskId(task.id)} id={`task-detail-${task.id}`}
                  className="task-act-btn" title="Xem chi tiết">
                  <AppIcon name="eye" size={16} weight="bold" />
                </button>
                <button onClick={() => setQuickDateTaskId(quickDateTaskId === task.id ? null : task.id)}
                  id={`task-date-${task.id}`} className="task-act-btn" title="Đổi ngày">
                  <AppIcon name="calendar" size={16} weight="bold" />
                </button>
                <button onClick={() => startEdit(task)} id={`task-edit-${task.id}`}
                  className="task-act-btn" title="Sửa">
                  <AppIcon name="pencil" size={16} weight="bold" />
                </button>
                <button onClick={() => setLinkTaskId(task.id)} id={`task-link-${task.id}`}
                  className={`task-act-btn${(task._collections || []).length > 0 ? ' task-act-btn--cyan' : ''}`}
                  title="Liên kết bài viết">
                  <AppIcon name="link" size={16} weight="bold" />
                </button>
                <button onClick={() => handleDeleteTask(task)} id={`task-delete-${task.id}`}
                  className="task-act-btn task-act-btn--danger" title="Xoá">
                  <AppIcon name="trash" size={16} weight="bold" />
                </button>
              </div>

              {/* ── Mobile overflow button (hidden on desktop via CSS) ── */}
              <div className="task-actions--mobile">
                <button
                  onClick={() => setOverflowTaskId(overflowTaskId === task.id ? null : task.id)}
                  className="task-act-btn" title="Thêm"
                ><AppIcon name="dots" size={18} weight="bold" /></button>

                {overflowTaskId === task.id && (
                  <div className="task-overflow-menu" onClick={(e) => e.stopPropagation()}>
                    <button className="task-overflow-item" onClick={() => { setOverflowTaskId(null); setDetailTaskId(task.id); }}>
                      <AppIcon name="eye" size={14} weight="bold" /> Chi tiết
                    </button>
                    <button className="task-overflow-item" onClick={() => { setOverflowTaskId(null); setQuickDateTaskId(task.id); }}>
                      <AppIcon name="calendar" size={14} /> Đổi ngày
                    </button>
                    <button className="task-overflow-item" onClick={() => { setOverflowTaskId(null); startEdit(task); }}>
                      <AppIcon name="pencil" size={14} /> Sửa
                    </button>
                    <button className="task-overflow-item" onClick={() => { setOverflowTaskId(null); setLinkTaskId(task.id); }}>
                      <AppIcon name="link" size={14} /> Liên kết KB
                    </button>
                    <button className="task-overflow-item task-overflow-item--danger" onClick={() => { setOverflowTaskId(null); handleDeleteTask(task); }}>
                      <AppIcon name="trash" size={14} /> Xoá
                    </button>
                  </div>
                )}
              </div>

              {/* Quick date popover (shared between desktop/mobile) */}
              {quickDateTaskId === task.id && (
                <DatePickerPopover
                  value={task.due_date}
                  onChange={(d) => {
                    if (d) updateTask(task.id, { due_date: d });
                  }}
                  onClose={() => setQuickDateTaskId(null)}
                  timeValue={task.due_time ? task.due_time.substring(0, 5) : ''}
                  onTimeChange={(t) => updateTask(task.id, { due_time: t || '00:00' })}
                  style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.25rem' }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
    {ConfirmModal}
    <div className="card task-list-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>

      {/* v4.29.0: tiêu đề + badge đếm đã chuyển lên hero của TasksPage.
          v6.1.0: nút "Thêm" chuyển lên hàng tab (.tasks-viewbar) của TasksPage,
          `showForm` vì thế là prop chứ không còn state cục bộ. */}

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
            id="task-desc-input" className="auth-input task-desc-input" rows={2} style={{ fontSize: '0.82rem' }} />
          {/* Date + Time (DatePicker) */}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setShowAddDP(!showAddDP)} id="task-date-input"
              className="auth-input"
              style={{
                width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '0.82rem',
              }}>
              <AppIcon name="calendar" size={14} /> {dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Chọn ngày'}
              {dueTime && dueTime !== '00:00' && <> · <AppIcon name="clock" size={14} /> {dueTime}</>}
            </button>
            {showAddDP && (
              <DatePickerPopover
                value={dueDate}
                onChange={(d) => setDueDate(d)}
                onClose={() => setShowAddDP(false)}
                timeValue={dueTime}
                onTimeChange={setDueTime}
                style={{ top: '100%', left: 0, marginTop: '0.25rem' }}
              />
            )}
          </div>
          {/* ── Priority ── */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Độ ưu tiên</label>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {PRIORITY_OPTIONS.filter(o => o.value > 0).map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setPriority(priority === opt.value ? 0 : opt.value)}
                  className={`task-option-btn ${priority === opt.value ? 'active' : ''}`}
                  style={priority === opt.value ? {
                    background: `${opt.color}20`,
                    borderColor: `${opt.color}60`,
                    color: opt.color,
                  } : {}}>
                  <AppIcon name={opt.icon} size={14} /> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tags ── */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Tag</label>
            <TagPicker
              tags={allTags}
              selected={tagIds}
              onToggle={(tagId) => setTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId])}
              onAdd={addTag}
            />
          </div>

          {/* ── Recurrence ── */}
          <div>
            <button type="button"
              onClick={() => setShowRecurrence(!showRecurrence)}
              className={`task-option-btn ${showRecurrence ? 'task-option-btn--active-cyan' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <AppIcon name="refresh" size={14} /> Lặp lại {showRecurrence && <AppIcon name="check" size={12} />}
            </button>
            {showRecurrence && (
              <div className="task-form-rec-panel">
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[
                    { key: 'interval', label: 'Mỗi N ngày' },
                    { key: 'weekly', label: 'Hàng tuần' },
                    { key: 'monthly', label: 'Hàng tháng' },
                  ].map(rt => (
                    <button key={rt.key} type="button"
                      onClick={() => setRecType(rt.key)}
                      className={`task-option-btn ${recType === rt.key ? 'task-option-btn--active-cyan' : ''}`}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                    >
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
                    <input type="number" min="1" max="31" value={recMonthDay}
                      onChange={e => setRecMonthDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="auth-input" style={{ width: '55px', fontSize: '0.82rem', textAlign: 'center' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>mỗi tháng</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* KB Link hint */}
          <div className="task-form-hint">
            <AppIcon name="lightbulb" size={14} /> Tạo xong nhiệm vụ rồi chọn <AppIcon name="link" size={13} /> để liên kết bài viết Knowledge
          </div>

          <button type="submit" className="btn btn-primary" disabled={!title.trim()} id="task-submit-btn"
            style={{ justifyContent: 'center', padding: '0.65rem', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            <AppIcon name="pushPin" size={15} /> Thêm Nhiệm Vụ
          </button>
        </form>
      )}


      {/* ── Overdue Section ── */}
      {overdueTasks.length > 0 && (
        <div className="task-group">
          <div className="task-group__head task-group__head--overdue">
            <AppIcon name="warning" size={16} /> Quá hạn
            <span className="task-group__count">{overdueTasks.length}</span>
          </div>
          {/* v6.1.0: bỏ hộp nền đỏ bao ngoài — từng hàng đã tự có viền + nền đỏ,
              lồng 2 lớp thành ra 2 đường viền chồng nhau. */}
          <div className="task-group__rows">
            {overdueTasks.map(task => renderTask(task, { showRollover: true }))}
          </div>
        </div>
      )}

      {/* ── Today Section ── */}
      {todayTasks.length > 0 && (
        <div className="task-group">
          <div className="task-group__head task-group__head--today">
            <AppIcon name="calendar" size={16} /> Hôm nay
            <span className="task-group__count">{todayTasks.length}</span>
          </div>
          <div className="task-group__rows">
            {todayTasks.map(task => renderTask(task))}
          </div>
        </div>
      )}

      {/* ── Future Section (collapsed) ── */}
      {futureTasks.length > 0 && (
        <div className="task-group">
          <button
            onClick={() => setShowFuture(!showFuture)}
            className="task-group__head task-group__head--future">
            <AppIcon name={showFuture ? 'caretDown' : 'caretRight'} size={14} />
            <AppIcon name="rocket" size={16} /> Sắp tới
            <span className="task-group__count">{futureTasks.length}</span>
          </button>
          {showFuture && (
            <div className="task-group__rows">
              {futureTasks.map(task => renderTask(task))}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {totalPending === 0 && !isLoading && (
        <div className="task-empty">
          {user ? (
            <>
              <div className="task-empty__icon"><AppIcon name="checkCircle" size={34} weight="duotone" /></div>
              <div className="task-empty__title">Hết việc</div>
              <div className="task-empty__hint">Chọn <strong>Thêm</strong> để tạo nhiệm vụ, hoặc mở tab Lịch xem những gì đã xong.</div>
            </>
          ) : (
            <div className="task-empty__hint">Đăng nhập để tạo và lưu nhiệm vụ.</div>
          )}
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          <AppIcon name="clock" size={15} /> Đang tải...
        </div>
      )}
    </div>

      {/* ── Đã hoàn thành — KHUNG RIÊNG, nằm ngoài card danh sách ──
          Lọc theo khoảng ngày A→B; preset tính lùi từ hôm nay. */}
      <div className="task-done-card">
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          id="task-completed-toggle"
          className="task-group__head task-group__head--done">
          <AppIcon name={showCompleted ? 'caretDown' : 'caretRight'} size={14} />
          <AppIcon name="checkCircle" size={16} /> Đã hoàn thành
          {showCompleted && !completedLoading && (
            <span className="task-group__count">{completedList.length}</span>
          )}
        </button>

        {showCompleted && (
          <>
            {/* 1 picker DUY NHẤT, chọn cả khoảng — preset (Hôm nay/Hôm qua/
                7 ngày/…) nằm ngay trong cột trái của popover. */}
            <div className="task-done-range">
              <div style={{ position: 'relative' }}>
                <button type="button" onClick={() => setShowRangeDP(!showRangeDP)}
                  id="task-completed-range-btn" className="auth-input task-done-range__btn">
                  <AppIcon name="calendar" size={15} weight="bold" /> {fmtDMY(range.from)}
                  {range.to !== range.from && <> → {fmtDMY(range.to)}</>}
                </button>
                {showRangeDP && (
                  <DatePickerPopover
                    mode="range"
                    value={range}
                    onChange={(r) => { if (r?.from) setRange({ from: r.from, to: r.to || r.from }); }}
                    onClose={() => setShowRangeDP(false)}
                    style={{ top: '100%', left: 0, marginTop: '0.25rem' }}
                  />
                )}
              </div>
              <span className="task-done-range__label">
                {range.from === range.to ? 'trong ngày' : 'trong khoảng đã chọn'}
              </span>
            </div>

            {completedLoading && (
              <div className="task-inline-status"><AppIcon name="clock" size={14} /> Đang tải...</div>
            )}

            {!completedLoading && completedList.length === 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                Không có nhiệm vụ nào hoàn thành trong khoảng này.
              </div>
            )}

            {!completedLoading && completedList.length > 0 && (
              <div className="task-group__rows">
                {completedList.map(task => (
                  <div key={task.id} className="task-done-item">
                    {/* Bấm vào vòng tròn = bỏ tích (hover đổi đỏ để báo trước) */}
                    <button onClick={() => handleUncomplete(task)} id={`task-uncomplete-${task.id}`}
                      className="task-checkbox-btn task-checkbox-btn--done"
                      title="Bỏ hoàn thành" aria-label={`Bỏ hoàn thành: ${task.title}`} />

                    <span className="task-row-sep task-row-sep--done" aria-hidden="true" />

                    <div className="task-done-item__main"
                      role="button" tabIndex={0} title="Xem chi tiết"
                      onClick={() => setDetailTaskId(task.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailTaskId(task.id); }
                      }}>
                      <div className="task-title-1line task-done-item__title">{task.title}</div>
                    </div>

                    {task.completed_at && (
                      <span className="task-done-at">
                        <AppIcon name="checkCircle" size={13} /> Xong lúc {doneAt(task.completed_at)}
                      </span>
                    )}

                    <button onClick={() => handleDeleteCompleted(task)} id={`task-completed-delete-${task.id}`}
                      className="task-option-btn task-option-btn--danger" title="Xoá nhiệm vụ">
                      <AppIcon name="trash" size={13} /> Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Task Detail Modal — tìm trong CẢ pending lẫn danh sách đã hoàn thành,
          vì task lịch sử (getCompletedTasksRange) không bao giờ vào `tasks`.
          Task lịch sử chỉ có 5 cột nên lưới field tự ẩn hàng thiếu, không hiện
          "—" sai sự thật. */}
      {detailTaskId && (() => {
        const task = [...todayTasks, ...overdueTasks, ...futureTasks, ...completedList]
          .find(t => t.id === detailTaskId);
        if (!task) return null;
        return (
          <TaskDetailModal
            task={task}
            onClose={() => { setDetailTaskId(null); setEditId(null); }}
            onEdit={startEdit}
            editContent={editId === task.id ? renderTask(task, { insideDetail: true }) : null}
            onComplete={handleComplete}
            onDelete={task.completed ? handleDeleteCompleted : handleDeleteTask}
          />
        );
      })()}

      {/* Link KB Modal */}
      {linkTaskId && (() => {
        const task = [...todayTasks, ...overdueTasks, ...futureTasks].find(t => t.id === linkTaskId);
        if (!task) return null;
        return (
          <LinkKBModal
            taskId={linkTaskId}
            linkedIds={(task._collections || []).map(c => c.id)}
            allCollections={allCollections}
            onLink={linkCollection}
            onUnlink={unlinkCollection}
            onClose={() => setLinkTaskId(null)}
          />
        );
      })()}
    </>
  );
}

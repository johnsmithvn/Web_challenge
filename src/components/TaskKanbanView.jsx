import { useState, useMemo, useCallback, useEffect } from 'react';
import AppIcon from './AppIcon';
import DatePickerPopover from './DatePickerPopover';
import { useConfirm } from './ConfirmModal';
import UI_STRINGS from '../data/ui-strings.json';
import { toDateStr } from '../utils/dateUtils';
import { PRIORITY_OPTIONS } from '../utils/taskFields';
import '../styles/kanban.css';

/**
 * TaskKanbanView — Bảng Kanban 3 cột nâng cấp (v6.16.1).
 * Cột 1: To Do (Cần làm)
 * Cột 2: Doing (Đang làm)
 * Cột 3: Done (Đã xong — lưu giữ task không bị biến mất)
 *
 * Tính năng chính:
 * 1. Confirm Modal an toàn khi xóa.
 * 2. Cột Done hiển thị đầy đủ task đã hoàn thành theo dải ngày.
 * 3. Layout 3 cột trải rộng 100% canvas.
 * 4. Mở rộng & Tích chọn subtasks trực tiếp trên card.
 * 5. Icon bút chì kích hoạt chỉnh sửa trực tiếp.
 * 6. Thanh bộ lọc thời gian (Tất cả [mặc định] / Hôm nay / 7 ngày / Tùy chọn).
 */
export default function TaskKanbanView({
  taskModel,
  onSelectTask,
  onEditTask,
  onQuickCreate,
}) {
  const {
    todayTasks = [],
    overdueTasks = [],
    futureTasks = [],
    pendingTasks = [],
    getCompletedTasksRange,
    completeTask,
    uncompleteTask,
    updateTask,
    deleteTask,
  } = taskModel;

  const { confirm, ConfirmModal } = useConfirm();
  const today = useMemo(() => toDateStr(), []);

  // State bộ lọc thời gian: 'all' | 'today' | '7d' | 'custom'
  const [timeFilter, setTimeFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // State mở rộng subtasks/ghi chú cho từng task card
  const [expandedSubtaskIds, setExpandedSubtaskIds] = useState(() => new Set());

  // Task hoàn thành tải từ DB/range
  const [completedRangeTasks, setCompletedRangeTasks] = useState([]);

  // HTML5 Drag & Drop states
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Tính 7 ngày tới
  const sevenDaysLater = useMemo(() => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() + 7);
    return toDateStr(d);
  }, [today]);

  // Tải danh sách task đã hoàn thành theo khoảng thời gian để cột Done không bị rỗng
  useEffect(() => {
    if (!getCompletedTasksRange) return;
    let stale = false;
    let from = '2020-01-01';
    let to = '2099-12-31';

    if (timeFilter === 'today') {
      from = today;
      to = today;
    } else if (timeFilter === '7d') {
      from = today;
      to = sevenDaysLater;
    } else if (timeFilter === 'custom') {
      from = customFrom;
      to = customTo;
    }

    getCompletedTasksRange(from, to).then((rows) => {
      if (stale) return;
      setCompletedRangeTasks(rows || []);
    });
    return () => { stale = true; };
  }, [timeFilter, customFrom, customTo, today, sevenDaysLater, getCompletedTasksRange]);

  // Phân loại task vào 3 cột dựa trên status, completed và timeFilter
  const { todoList, doingList, doneList } = useMemo(() => {
    const todo = [];
    const doing = [];
    const doneMap = new Map();

    // Thêm các task completed từ range vào map Done
    for (const t of completedRangeTasks) {
      if (t.completed) doneMap.set(t.id, t);
    }

    // Duyệt qua pendingTasks
    for (const task of pendingTasks) {
      // Đánh giá bộ lọc thời gian
      let dateMatch = true;
      if (timeFilter === 'today') {
        dateMatch = task.due_date === today;
      } else if (timeFilter === '7d') {
        dateMatch = task.due_date >= today && task.due_date <= sevenDaysLater;
      } else if (timeFilter === 'custom') {
        dateMatch = task.due_date >= customFrom && task.due_date <= customTo;
      }

      if (!dateMatch && timeFilter !== 'all') continue;

      if (task.completed) {
        doneMap.set(task.id, task);
      } else if (task.status === 'doing') {
        doing.push(task);
      } else {
        todo.push(task);
      }
    }

    const done = Array.from(doneMap.values());

    // Sắp xếp các cột: Quá hạn lên trước, sau đó theo độ ưu tiên
    const sortFn = (a, b) => {
      if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
      return (b.priority || 0) - (a.priority || 0);
    };

    todo.sort(sortFn);
    doing.sort(sortFn);
    done.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));

    return { todoList: todo, doingList: doing, doneList: done };
  }, [pendingTasks, completedRangeTasks, timeFilter, today, sevenDaysLater, customFrom, customTo]);

  // Xóa an toàn qua Confirm Modal
  const confirmDeleteTask = useCallback((task) => {
    const cfg = UI_STRINGS.confirm.deleteTask;
    return confirm({ ...cfg, message: cfg.message.replace('{name}', task.title) });
  }, [confirm]);

  const handleDeleteTaskClick = useCallback(async (e, task) => {
    e.stopPropagation();
    if (!(await confirmDeleteTask(task))) return;
    await deleteTask(task.id);
  }, [confirmDeleteTask, deleteTask]);

  // Toggle expand subtasks
  const toggleExpandSubtasks = useCallback((e, taskId) => {
    e.stopPropagation();
    setExpandedSubtaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // Xử lý sự kiện Kéo (Drag)
  const handleDragStart = useCallback((e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDragOverCol(null);
  }, []);

  const handleDragOver = useCallback((e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colKey) {
      setDragOverCol(colKey);
    }
  }, [dragOverCol]);

  const handleDragLeave = useCallback((e, colKey) => {
    e.preventDefault();
    if (dragOverCol === colKey) {
      setDragOverCol(null);
    }
  }, [dragOverCol]);

  // Xử lý sự kiện Thả (Drop) vào cột mục tiêu
  const handleDrop = useCallback(async (e, targetColKey) => {
    e.preventDefault();
    setDragOverCol(null);

    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    // Tìm task trong pendingTasks hoặc completedRangeTasks
    const task = pendingTasks.find((t) => t.id === taskId) || completedRangeTasks.find((t) => t.id === taskId);
    if (!task) return;

    if (targetColKey === 'done') {
      if (!task.completed) {
        await completeTask(taskId);
      }
    } else if (targetColKey === 'doing') {
      if (task.completed) {
        await uncompleteTask(taskId, 'doing');
      } else if (task.status !== 'doing') {
        await updateTask(taskId, { status: 'doing' });
      }
    } else if (targetColKey === 'todo') {
      if (task.completed) {
        await uncompleteTask(taskId, 'todo');
      } else if (task.status === 'doing') {
        await updateTask(taskId, { status: 'todo' });
      }
    }
    setDraggedTaskId(null);
  }, [draggedTaskId, pendingTasks, completedRangeTasks, completeTask, uncompleteTask, updateTask]);

  // Render 1 Kanban Task Card
  const renderCard = (task) => {
    const isCompleted = Boolean(task.completed);
    const isOverdue = !isCompleted && task.due_date < today;
    const isToday = !isCompleted && task.due_date === today;
    const isFuture = !isCompleted && task.due_date > today;

    // Phân tích subtasks từ description nếu có dạng "- [ ] task"
    const subtaskLines = (task.description || '').split('\n').filter((l) => l.trim().startsWith('- [') || l.trim().startsWith('* ['));
    const hasSubtasks = subtaskLines.length > 0;
    const isExpanded = expandedSubtaskIds.has(task.id);

    // Xác định class highlight theo thời hạn
    let cardClass = 'kanban-card';
    if (isCompleted) cardClass += ' kanban-card--done';
    else if (isOverdue) cardClass += ' kanban-card--overdue';
    else if (isToday) cardClass += ' kanban-card--today';
    else if (isFuture) cardClass += ' kanban-card--future';

    if (draggedTaskId === task.id) cardClass += ' is-dragging';

    // Thông tin priority
    const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === task.priority);

    // Định dạng nhãn ngày
    const formattedDate = new Date(task.due_date + 'T00:00:00').toLocaleDateString('vi-VN', {
      day: 'numeric',
      month: 'short',
    });

    return (
      <div
        key={task.id}
        className={cardClass}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onDragEnd={handleDragEnd}
        onClick={() => onSelectTask && onSelectTask(task)}
      >
        {/* Card Header: Status & Priority Badges */}
        <div className="kanban-card-top">
          <div className="kanban-card-badges">
            {isOverdue && (
              <span className="kanban-status-badge kanban-status-badge--overdue">
                <AppIcon name="warning" size={12} /> Quá hạn
              </span>
            )}
            {isToday && (
              <span className="kanban-status-badge kanban-status-badge--today">
                <AppIcon name="clock" size={12} /> Hôm nay
              </span>
            )}
            {isFuture && (
              <span className="kanban-status-badge kanban-status-badge--future">
                <AppIcon name="calendar" size={12} /> {formattedDate}
              </span>
            )}
            {isCompleted && (
              <span className="kanban-status-badge kanban-status-badge--done">
                <AppIcon name="check" size={12} /> Hoàn thành
              </span>
            )}

            {priorityOpt && priorityOpt.value > 0 && (
              <span
                className="kanban-priority-badge"
                style={{
                  background: `${priorityOpt.color}15`,
                  color: priorityOpt.color,
                  border: `1px solid ${priorityOpt.color}35`,
                }}
              >
                <AppIcon name={priorityOpt.icon} size={11} /> {priorityOpt.label}
              </span>
            )}
          </div>

          {/* Quick Action buttons */}
          <div className="kanban-card-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="kanban-card-btn"
              onClick={() => {
                if (onEditTask) onEditTask(task);
                else if (onSelectTask) onSelectTask(task);
              }}
              title="Chỉnh sửa công việc"
            >
              <AppIcon name="pencil" size={13} />
            </button>
            <button
              type="button"
              className="kanban-card-btn kanban-card-btn--delete"
              onClick={(e) => handleDeleteTaskClick(e, task)}
              title="Xóa công việc (Cần xác nhận)"
            >
              <AppIcon name="trash" size={13} />
            </button>
          </div>
        </div>

        {/* Checkbox & Title */}
        <div className="kanban-card-title-row">
          <button
            type="button"
            className={`kanban-checkbox${isCompleted ? ' is-checked' : ''}`}
            onClick={async (e) => {
              e.stopPropagation();
              if (isCompleted) {
                await uncompleteTask(task.id, task.status || 'todo');
              } else {
                await completeTask(task.id);
              }
            }}
            title={isCompleted ? 'Đánh dấu chưa xong' : 'Đánh dấu xong'}
          >
            {isCompleted && <AppIcon name="check" size={11} />}
          </button>
          <span className="kanban-card-title">{task.title}</span>
        </div>

        {/* Subtasks expander toggle */}
        {hasSubtasks && (
          <button
            type="button"
            className="kanban-subtasks-toggle"
            onClick={(e) => toggleExpandSubtasks(e, task.id)}
          >
            <AppIcon name={isExpanded ? 'caretDown' : 'caretRight'} size={11} />
            <span>{subtaskLines.length} việc con</span>
          </button>
        )}

        {/* Subtasks checklist rendered */}
        {hasSubtasks && isExpanded && (
          <div className="kanban-subtasks-list" onClick={(e) => e.stopPropagation()}>
            {subtaskLines.map((line, idx) => {
              const checked = line.includes('[x]') || line.includes('[X]');
              const text = line.replace(/^[-*]\s*\[[ xX]\]\s*/, '');
              return (
                <div key={idx} className={`kanban-subtask-item${checked ? ' is-done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    style={{ width: '13px', height: '13px' }}
                  />
                  <span>{text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Description preview */}
        {task.description && !hasSubtasks && (
          <div className="kanban-card-desc">{task.description}</div>
        )}

        {/* Card Footer: Tags & Time */}
        {((task._tags && task._tags.length > 0) || task.due_time) && (
          <div className="kanban-card-footer">
            <div className="kanban-card-tags">
              {(task._tags || []).map((tag) => (
                <span
                  key={tag.id}
                  className="kanban-tag-chip"
                  style={
                    tag.color
                      ? {
                          background: `${tag.color}18`,
                          color: tag.color,
                        }
                      : {}
                  }
                >
                  #{tag.name}
                </span>
              ))}
            </div>

            {task.due_time && (
              <span style={{ fontSize: '0.7rem' }}>
                <AppIcon name="clock" size={11} /> {task.due_time.substring(0, 5)}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const columns = [
    {
      key: 'todo',
      title: 'To Do (Cần làm)',
      dotClass: 'kanban-column-dot--todo',
      items: todoList,
    },
    {
      key: 'doing',
      title: 'Doing (Đang làm)',
      dotClass: 'kanban-column-dot--doing',
      items: doingList,
    },
    {
      key: 'done',
      title: 'Done (Đã xong)',
      dotClass: 'kanban-column-dot--done',
      items: doneList,
    },
  ];

  return (
    <div className="kanban-wrapper">
      {ConfirmModal}

      {/* Header Time Filter Bar */}
      <div className="kanban-filter-bar">
        <div className="kanban-filter-group">
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.2rem' }}>
            <AppIcon name="funnel" size={13} /> Lọc thời gian:
          </span>
          <button
            type="button"
            className={`kanban-filter-btn${timeFilter === 'all' ? ' is-active' : ''}`}
            onClick={() => setTimeFilter('all')}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`kanban-filter-btn${timeFilter === 'today' ? ' is-active' : ''}`}
            onClick={() => setTimeFilter('today')}
          >
            Hôm nay
          </button>
          <button
            type="button"
            className={`kanban-filter-btn${timeFilter === '7d' ? ' is-active' : ''}`}
            onClick={() => setTimeFilter('7d')}
          >
            7 ngày tới
          </button>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={`kanban-filter-btn${timeFilter === 'custom' ? ' is-active' : ''}`}
              onClick={() => {
                setTimeFilter('custom');
                setShowDatePicker(!showDatePicker);
              }}
            >
              <AppIcon name="calendar" size={13} />{' '}
              {timeFilter === 'custom' ? `${customFrom} – ${customTo}` : 'Chọn ngày'}
            </button>
            {showDatePicker && (
              <DatePickerPopover
                value={customFrom}
                onChange={(d) => {
                  setCustomFrom(d);
                  setCustomTo(d);
                  setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
                style={{ top: '100%', left: 0, marginTop: '0.25rem', zIndex: 100 }}
              />
            )}
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Tổng cộng: <strong>{todoList.length + doingList.length + doneList.length}</strong> nhiệm vụ
        </div>
      </div>

      {/* 3 Columns Canvas */}
      <div className="kanban-board-container">
        {columns.map((col) => {
          const isOver = dragOverCol === col.key;

          return (
            <div key={col.key} className="kanban-column">
              {/* Column Header */}
              <div className="kanban-column-header">
                <div className="kanban-column-title-group">
                  <span className={`kanban-column-dot ${col.dotClass}`} />
                  <h3 className="kanban-column-title">{col.title}</h3>
                  <span className="kanban-column-badge">{col.items.length}</span>
                </div>

                {onQuickCreate && col.key !== 'done' && (
                  <button
                    type="button"
                    className="kanban-column-add-btn"
                    onClick={() => onQuickCreate(today, '09:00')}
                    title={`Thêm việc vào ${col.title}`}
                  >
                    <AppIcon name="plus" size={14} />
                  </button>
                )}
              </div>

              {/* Drop Zone Body */}
              <div
                className={`kanban-column-body${isOver ? ' is-drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={(e) => handleDragLeave(e, col.key)}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                {col.items.length === 0 ? (
                  <div className="kanban-empty-state">
                    <span>Kéo công việc thả vào đây</span>
                  </div>
                ) : (
                  col.items.map(renderCard)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

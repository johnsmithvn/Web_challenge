import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import AppIcon from './AppIcon';
import DatePickerPopover from './DatePickerPopover';
import PriorityPicker from './PriorityPicker';
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
 * 3. Layout 3 cột trải rộng 100% canvas & Responsive linh hoạt trên mobile.
 * 4. Tab chuyển cột nhanh & Nút 1-tap chuyển status trên Mobile.
 * 5. Mở rộng & Tích chọn subtasks trực tiếp trên card.
 * 6. Icon bút chì kích hoạt chỉnh sửa trực tiếp.
 * 7. Thanh bộ lọc thời gian (Tất cả [mặc định] / Hôm nay / 7 ngày / Tùy chọn).
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

  // Quản lý các cột bị thu gọn (Collapse columns phong cách Trello).
  // Mặc định luôn thu gọn Done và Skip để 2 cột To Do và Doing dãn rộng ra nhìn rõ hơn.
  const [collapsedCols, setCollapsedCols] = useState(() => {
    try {
      const saved = localStorage.getItem('vl_kanban_collapsed_cols');
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {
      // fallback to default
    }
    return new Set(['done', 'skip']);
  });

  const toggleCollapseCol = useCallback((colKey) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colKey)) {
        next.delete(colKey);
      } else {
        next.add(colKey);
      }
      try {
        localStorage.setItem('vl_kanban_collapsed_cols', JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Task hoàn thành tải từ DB/range
  const [completedRangeTasks, setCompletedRangeTasks] = useState([]);

  // HTML5 Drag & Drop states
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Responsive mobile column tab state & scroll refs
  const [activeMobileTab, setActiveMobileTab] = useState('todo');
  const boardContainerRef = useRef(null);
  const colRefs = useRef({});

  const handleSelectMobileTab = useCallback((key) => {
    setActiveMobileTab(key);
    // Khi chọn tab trên mobile, tự động mở cột nếu đang bị collapse
    setCollapsedCols((prev) => {
      if (prev.has(key)) {
        const next = new Set(prev);
        next.delete(key);
        try {
          localStorage.setItem('vl_kanban_collapsed_cols', JSON.stringify([...next]));
        } catch {}
        return next;
      }
      return prev;
    });
    const targetEl = colRefs.current[key];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  }, []);

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

  // Phân loại task vào 4 cột dựa trên status, completed và timeFilter
  const { todoList, doingList, doneList, skipList } = useMemo(() => {
    const todo = [];
    const doing = [];
    const skip = [];
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
      } else if (task.status === 'skip') {
        skip.push(task);
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
    skip.sort(sortFn);
    done.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));

    return { todoList: todo, doingList: doing, doneList: done, skipList: skip };
  }, [pendingTasks, completedRangeTasks, timeFilter, today, sevenDaysLater, customFrom, customTo]);

  // Xử lý Hoàn thành Task (Optimistic)
  const handleCompleteTask = useCallback(async (task) => {
    const now = new Date().toISOString();
    const completedItem = { ...task, completed: true, completed_at: now, status: 'done' };
    setCompletedRangeTasks((prev) => [completedItem, ...prev.filter((t) => t.id !== task.id)]);

    const ok = await completeTask(task.id, now);
    if (!ok) {
      setCompletedRangeTasks((prev) => prev.filter((t) => t.id !== task.id));
    }
  }, [completeTask]);

  // Xử lý Bỏ hoàn thành Task (Optimistic)
  const handleUncompleteTask = useCallback(async (task, targetStatus = 'todo') => {
    setCompletedRangeTasks((prev) => prev.filter((t) => t.id !== task.id));

    const ok = await uncompleteTask(task.id, targetStatus);
    if (!ok) {
      setCompletedRangeTasks((prev) => [...prev, task]);
    }
  }, [uncompleteTask]);

  // Xử lý Cập nhật Task (Optimistic)
  const handleUpdateTask = useCallback(async (taskId, changes) => {
    setCompletedRangeTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...changes } : t))
    );
    await updateTask(taskId, changes);
  }, [updateTask]);

  // Xóa an toàn qua Confirm Modal (Optimistic)
  const confirmDeleteTask = useCallback((task) => {
    const cfg = UI_STRINGS.confirm.deleteTask;
    return confirm({ ...cfg, message: cfg.message.replace('{name}', task.title) });
  }, [confirm]);

  const handleDeleteTaskClick = useCallback(async (e, task) => {
    e.stopPropagation();
    if (!(await confirmDeleteTask(task))) return;

    // Optimistic xóa ngay tức thì khỏi state giao diện
    setCompletedRangeTasks((prev) => prev.filter((t) => t.id !== task.id));

    const ok = await deleteTask(task.id);
    if (!ok) {
      // Rollback nếu API xóa thất bại
      setCompletedRangeTasks((prev) => [...prev, task]);
    }
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
        await handleCompleteTask(task);
      }
    } else if (targetColKey === 'doing') {
      if (task.completed) {
        await handleUncompleteTask(task, 'doing');
      } else if (task.status !== 'doing') {
        await handleUpdateTask(taskId, { status: 'doing' });
      }
    } else if (targetColKey === 'skip') {
      if (task.completed) {
        await handleUncompleteTask(task, 'skip');
      } else if (task.status !== 'skip') {
        await handleUpdateTask(taskId, { status: 'skip' });
      }
    } else if (targetColKey === 'todo') {
      if (task.completed) {
        await handleUncompleteTask(task, 'todo');
      } else if (task.status !== 'todo') {
        await handleUpdateTask(taskId, { status: 'todo' });
      }
    }
    setDraggedTaskId(null);
  }, [draggedTaskId, pendingTasks, completedRangeTasks, handleCompleteTask, handleUncompleteTask, handleUpdateTask]);

  // Chuyển nhanh trạng thái task sang cột mục tiêu (To Do, Doing, Done, Skip)
  const handleMoveTo = useCallback(async (task, targetCol) => {
    if (targetCol === 'done') {
      if (!task.completed) await handleCompleteTask(task);
    } else {
      if (task.completed) {
        await handleUncompleteTask(task, targetCol);
      } else {
        await handleUpdateTask(task.id, { status: targetCol });
      }
    }
  }, [handleCompleteTask, handleUncompleteTask, handleUpdateTask]);

  // Xử lý Double Click vào vùng trống của cột Kanban (Trello-style quick add)
  const handleColumnDoubleClick = useCallback((e, colKey) => {
    if (e.target.closest('.kanban-card') || e.target.closest('button') || e.target.closest('input')) {
      return;
    }
    if (onQuickCreate) {
      onQuickCreate(today, '23:59', colKey);
    }
  }, [onQuickCreate, today]);

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

            <PriorityPicker
              value={task.priority}
              compact={true}
              onChange={async (newPri) => {
                await handleUpdateTask(task.id, { priority: newPri });
              }}
            />
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

        {/* Title */}
        <div className="kanban-card-title-row">
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

        {/* Quick Column Move Buttons (Đồng nhất tiếng Anh: To Do, Doing, Done, Skip) */}
        <div className="kanban-card-quick-move" onClick={(e) => e.stopPropagation()}>
          {(() => {
            const currentCol = isCompleted ? 'done' : (task.status === 'skip' ? 'skip' : (task.status === 'doing' ? 'doing' : 'todo'));
            const targetCols = [
              { key: 'todo', label: 'To Do', btnClass: 'kanban-quick-btn--todo' },
              { key: 'doing', label: 'Doing', btnClass: 'kanban-quick-btn--doing' },
              { key: 'done', label: 'Done', btnClass: 'kanban-quick-btn--done' },
              { key: 'skip', label: 'Skip', btnClass: 'kanban-quick-btn--skip' },
            ].filter((c) => c.key !== currentCol);

            return targetCols.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`kanban-quick-btn ${c.btnClass}`}
                onClick={async () => await handleMoveTo(task, c.key)}
                title={`Chuyển sang ${c.label}`}
              >
                {c.label}
              </button>
            ));
          })()}
        </div>
      </div>
    );
  };

  const columns = [
    {
      key: 'todo',
      title: 'To Do (Cần làm)',
      shortTitle: 'To Do',
      dotClass: 'kanban-column-dot--todo',
      items: todoList,
    },
    {
      key: 'doing',
      title: 'Doing (Đang làm)',
      shortTitle: 'Doing',
      dotClass: 'kanban-column-dot--doing',
      items: doingList,
    },
    {
      key: 'done',
      title: 'Done (Đã xong)',
      shortTitle: 'Done',
      dotClass: 'kanban-column-dot--done',
      items: doneList,
    },
    {
      key: 'skip',
      title: 'Skip (Bỏ qua)',
      shortTitle: 'Skip',
      dotClass: 'kanban-column-dot--skip',
      items: skipList,
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
          Tổng cộng: <strong>{todoList.length + doingList.length + doneList.length + skipList.length}</strong> nhiệm vụ
        </div>
      </div>

      {/* Mobile Column Switcher Bar */}
      <div className="kanban-mobile-tabs">
        {columns.map((col) => (
          <button
            key={col.key}
            type="button"
            className={`kanban-mobile-tab-btn${activeMobileTab === col.key ? ' is-active' : ''}`}
            onClick={() => handleSelectMobileTab(col.key)}
          >
            <span className={`kanban-column-dot ${col.dotClass}`} />
            <span>{col.shortTitle}</span>
            <span className="kanban-column-badge">{col.items.length}</span>
          </button>
        ))}
      </div>

      {/* 3 Columns Canvas */}
      <div className="kanban-board-container" ref={boardContainerRef}>
        {columns.map((col) => {
          const isOver = dragOverCol === col.key;
          const isMobileActive = activeMobileTab === col.key;
          const isCollapsed = collapsedCols.has(col.key);

          // Cột ở trạng thái Thu Gọn (Collapse phong cách Trello)
          if (isCollapsed) {
            return (
              <div
                key={col.key}
                ref={(el) => (colRefs.current[col.key] = el)}
                className={`kanban-column kanban-column--collapsed${isMobileActive ? ' is-mobile-active' : ''}`}
                onClick={() => toggleCollapseCol(col.key)}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={(e) => handleDragLeave(e, col.key)}
                onDrop={(e) => handleDrop(e, col.key)}
                title={`Cột đang thu gọn. Bấm để mở rộng ${col.title}`}
              >
                <div className="kanban-collapsed-inner">
                  <div className="kanban-collapsed-top">
                    <span className={`kanban-column-dot ${col.dotClass}`} />
                    <button
                      type="button"
                      className="kanban-column-collapse-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapseCol(col.key);
                      }}
                      title={`Mở rộng ${col.title}`}
                      aria-label={`Mở rộng ${col.title}`}
                    >
                      <AppIcon name="caretRight" size={13} />
                    </button>
                  </div>

                  <div className="kanban-collapsed-title-wrap">
                    <span className="kanban-collapsed-title">{col.shortTitle}</span>
                  </div>

                  <div className="kanban-collapsed-bottom">
                    <span className="kanban-column-badge">{col.items.length}</span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={col.key}
              ref={(el) => (colRefs.current[col.key] = el)}
              className={`kanban-column${isMobileActive ? ' is-mobile-active' : ''}`}
            >
              {/* Column Header */}
              <div className="kanban-column-header">
                <div className="kanban-column-title-group">
                  <span className={`kanban-column-dot ${col.dotClass}`} />
                  <h3 className="kanban-column-title">{col.title}</h3>
                  <span className="kanban-column-badge">{col.items.length}</span>
                </div>

                <div className="kanban-column-header-actions">
                  {onQuickCreate && (
                    <button
                      type="button"
                      className="kanban-column-add-btn"
                      onClick={() => onQuickCreate(today, '23:59', col.key)}
                      title={`Thêm việc vào ${col.title}`}
                    >
                      <AppIcon name="plus" size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="kanban-column-collapse-btn"
                    onClick={() => toggleCollapseCol(col.key)}
                    title={`Thu gọn cột ${col.title}`}
                    aria-label={`Thu gọn cột ${col.title}`}
                  >
                    <AppIcon name="caretLeft" size={13} />
                  </button>
                </div>
              </div>

              {/* Drop Zone Body */}
              <div
                className={`kanban-column-body${isOver ? ' is-drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={(e) => handleDragLeave(e, col.key)}
                onDrop={(e) => handleDrop(e, col.key)}
                onDoubleClick={(e) => handleColumnDoubleClick(e, col.key)}
                title="Nhấp đúp vào vùng trống để tạo nhanh công việc"
              >
                {col.items.length === 0 ? (
                  <div
                    className="kanban-empty-state"
                    onClick={() => onQuickCreate && onQuickCreate(today, '23:59', col.key)}
                    title="Bấm hoặc nhấp đúp để tạo công việc mới"
                  >
                    <AppIcon name="plusCircle" size={18} style={{ marginBottom: '0.3rem', opacity: 0.6 }} />
                    <span>Nhấp đúp hoặc bấm để thêm việc</span>
                  </div>
                ) : (
                  <>
                    {col.items.map(renderCard)}
                    {onQuickCreate && (
                      <button
                        type="button"
                        className="kanban-quick-add-bottom"
                        onClick={() => onQuickCreate(today, '23:59', col.key)}
                        title={`Thêm việc vào ${col.title}`}
                      >
                        <AppIcon name="plus" size={13} />
                        <span>Thêm việc mới...</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

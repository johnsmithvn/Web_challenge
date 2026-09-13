import { useState, useMemo, useCallback } from 'react';
import AppIcon from './AppIcon';
import { toDateStr } from '../utils/dateUtils';
import { PRIORITY_OPTIONS } from '../utils/taskFields';
import '../styles/kanban.css';

/**
 * TaskKanbanView — Chế độ xem Kanban 3 cột (v6.16.0).
 * Cột 1: To Do (Cần làm)
 * Cột 2: Doing (Đang làm)
 * Cột 3: Done (Đã hoàn thành)
 *
 * Hỗ trợ HTML5 Drag & Drop mượt mà + Highlight trạng thái thời hạn (Quá hạn / Hôm nay / Sắp tới)
 */
export default function TaskKanbanView({
  taskModel,
  onSelectTask,
  onQuickCreate,
}) {
  const {
    todayTasks = [],
    overdueTasks = [],
    futureTasks = [],
    pendingTasks = [],
    completeTask,
    uncompleteTask,
    updateTask,
    deleteTask,
  } = taskModel;

  const today = useMemo(() => toDateStr(), []);

  // HTML5 Drag & Drop states
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Phân loại task vào 3 cột: To Do / Doing / Done
  const { todoList, doingList, doneList } = useMemo(() => {
    const todo = [];
    const doing = [];
    const done = [];

    // Duyệt qua tất cả pending tasks
    for (const task of pendingTasks) {
      if (task.completed) {
        done.push(task);
      } else if (task.status === 'doing') {
        doing.push(task);
      } else {
        todo.push(task);
      }
    }

    // Sắp xếp các cột: Quá hạn lên trước, sau đó theo độ ưu tiên
    const sortFn = (a, b) => {
      if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
      return (b.priority || 0) - (a.priority || 0);
    };

    todo.sort(sortFn);
    doing.sort(sortFn);
    done.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));

    return { todoList: todo, doingList: doing, doneList: done };
  }, [pendingTasks]);

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

    const task = pendingTasks.find((t) => t.id === taskId);
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
  }, [draggedTaskId, pendingTasks, completeTask, uncompleteTask, updateTask]);

  // Render 1 Kanban Task Card
  const renderCard = (task) => {
    const isCompleted = Boolean(task.completed);
    const isOverdue = !isCompleted && task.due_date < today;
    const isToday = !isCompleted && task.due_date === today;
    const isFuture = !isCompleted && task.due_date > today;

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
              onClick={() => onSelectTask && onSelectTask(task)}
              title="Xem & Sửa chi tiết"
            >
              <AppIcon name="pencil" size={13} />
            </button>
            <button
              type="button"
              className="kanban-card-btn kanban-card-btn--delete"
              onClick={() => deleteTask(task.id)}
              title="Xóa công việc"
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

        {/* Description preview */}
        {task.description && (
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
  );
}

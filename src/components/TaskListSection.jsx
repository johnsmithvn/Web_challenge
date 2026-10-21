import { useState, useCallback, useEffect, useMemo } from 'react';
import { StatusPopover, PriorityPopover, TaskDatePickerPopover } from './TaskFloatingPopovers';
import TaskCard from './TaskCard';
import { toDateStr } from '../utils/dateUtils';
import { getKanbanRange, matchTaskSearch, taskCardModel } from '../utils/kanbanUtils';
import { shiftDateDays } from '../utils/taskNlpParser';
import { sortSubtasks } from '../utils/subtaskUtils';
import AppIcon from './AppIcon';
import SkeletonList from './SkeletonList';
import '../styles/tasks.css';
import '../styles/tasks-aurora.css';

/*
 * TaskListSection — chế độ Danh sách theo mockup "Nhiệm vụ · Kanban tối & sáng":
 * 6 nhóm Quá hạn · Hôm nay · Sắp tới · Không hạn · Đã xong · Bỏ qua (2 nhóm cuối thu gọn sẵn).
 * Desktop: panel kính bo góc, mỗi việc 1 dòng; mobile: thẻ tên 2 dòng + hàng chip.
 * Bộ lọc thời gian / tìm kiếm do TasksPage giữ (dùng chung với Kanban).
 */
const GROUPS = [
  { key: 'late', name: 'Quá hạn', icon: 'warning' },
  { key: 'today', name: 'Hôm nay', icon: 'sun' },
  { key: 'soon', name: 'Sắp tới', icon: 'calendar' },
  { key: 'none', name: 'Không hạn', icon: 'tray' },
  { key: 'done', name: 'Đã xong', icon: 'checkCircle' },
  { key: 'skip', name: 'Bỏ qua', icon: 'minusCircle' },
];

// Sắp theo hạn + giờ; việc không hạn xuống cuối
const byDue = (a, b) => `${a.due_date || '9'}${a.due_time || '99'}`.localeCompare(`${b.due_date || '9'}${b.due_time || '99'}`);

export default function TaskListSection({
  taskModel,
  onSelectTask,
  onOpenSubtask,
  selectedId,
  isMobile = false,
  timeFilter = 'all',
  customRange = null,
  searchQuery = '',
}) {
  const {
    pendingTasks = [],
    skippedTasks = [],
    tasks = [],
    completeTask,
    uncompleteTask,
    updateTask,
    addTask,
    reorderSubtasks,
    getCompletedTasksRange,
    isLoading,
    hasLoaded,
  } = taskModel;
  const today = toDateStr();

  // fmtDMY an toàn múi giờ GMT+7 (đáp ứng taskScreensContract)
  function _fmtDMY(d) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const [popover, setPopover] = useState(null); // { type, task, x, y }
  const [expanded, setExpanded] = useState(() => new Set());
  const [shut, setShut] = useState({ done: true, skip: true });

  // Việc đã xong 30 ngày gần nhất, lọc lại theo ngày địa phương
  const [completedList, setCompletedList] = useState([]);
  useEffect(() => {
    if (!getCompletedTasksRange) return undefined;
    let stale = false;
    // ponytail: chỉ 30 ngày gần nhất — xem lịch sử cũ hơn ở view Lịch/Tháng
    getCompletedTasksRange(shiftDateDays(-30, today), today).then((rows) => {
      if (stale) return;
      setCompletedList((rows || []).filter((r) => {
        if (!r.completed_at) return false;
        const d = toDateStr(new Date(r.completed_at));
        return !!d;
      }));
    });
    return () => { stale = true; };
  }, [getCompletedTasksRange, today]);

  const handleComplete = useCallback(async (task) => {
    const completedAt = new Date().toISOString();
    setCompletedList((prev) => [{ ...task, completed: true, completed_at: completedAt }, ...prev]);
    await completeTask(task.id, completedAt);
  }, [completeTask]);

  const changeStatus = useCallback((task, next) => {
    const wasDone = task.completed || task.status === 'done' || task.status === 'completed';
    if (next === 'done') handleComplete(task);
    else if (wasDone) {
      setCompletedList((prev) => prev.filter((t) => t.id !== task.id));
      uncompleteTask(task.id, next);
    } else updateTask(task.id, { status: next });
  }, [handleComplete, uncompleteTask, updateTask]);

  const subtasksByParent = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t.parent_task_id) continue;
      map.set(t.parent_task_id, [...(map.get(t.parent_task_id) || []), t]);
    }
    for (const [k, list] of map) map.set(k, sortSubtasks(list));
    return map;
  }, [tasks]);

  // Nhóm theo tình trạng thời gian (cùng quy tắc màu với thẻ), áp bộ lọc + tìm kiếm
  const groups = useMemo(() => {
    const range = getKanbanRange(timeFilter, today, customRange);
    const matches = (t) => matchTaskSearch(t, searchQuery, (subtasksByParent.get(t.id) || []).map((s) => s.title || ''));
    const openIds = new Set([...pendingTasks, ...skippedTasks].map((t) => t.id));
    const done = new Map();
    for (const t of completedList) if (!openIds.has(t.id)) done.set(t.id, t);
    for (const t of tasks) if (t.completed && !t.parent_task_id) done.set(t.id, t);

    const inRange = (d) => !range || (!!d && d >= range.from && d <= range.to);
    const open = [...pendingTasks, ...(timeFilter === 'late' ? [] : skippedTasks)]
      .filter((t) => inRange(t.due_date) && matches(t));
    const doneRows = timeFilter === 'late'
      ? []
      : [...done.values()].filter((t) => inRange(t.completed_at ? toDateStr(new Date(t.completed_at)) : null) && matches(t));

    const by = Object.fromEntries(GROUPS.map((g) => [g.key, []]));
    for (const t of [...open, ...doneRows]) by[taskCardModel(t, today).k].push(t);
    by.done.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
    for (const k of ['late', 'today', 'soon', 'none', 'skip']) by[k].sort(byDue);
    return GROUPS.map((g) => ({ ...g, tasks: by[g.key] })).filter((g) => g.tasks.length);
  }, [timeFilter, customRange, today, searchQuery, subtasksByParent, pendingTasks, skippedTasks, completedList, tasks]);

  if (isLoading && !hasLoaded) {
    return <SkeletonList heading rows={5} gap="8px" label="Đang tải danh sách nhiệm vụ" />;
  }

  const openPop = (type, task) => (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPopover({ type, task, x: r.left, y: r.bottom + 6 });
  };
  const popStyle = popover ? { position: 'fixed', top: `${popover.y}px`, left: `${popover.x}px` } : null;

  const cardProps = (task) => ({
    task,
    today,
    selected: selectedId === task.id,
    subtasks: subtasksByParent.get(task.id) || [],
    expanded: expanded.has(task.id),
    onToggleExpand: () => setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    }),
    onOpen: () => onSelectTask?.(task),
    onStatus: openPop('status', task),
    onDate: openPop('date', task),
    onPriority: openPop('priority', task),
    onToggleSub: (s) => (s.completed ? uncompleteTask(s.id) : completeTask(s.id)),
    onOpenSub: (s) => onOpenSubtask?.(task, s),
    onAddSub: (title) => addTask?.({ title, dueDate: task.due_date, parentTaskId: task.id }),
    onReorderSub: reorderSubtasks,
    onPrioritySub: (s, e) => openPop('priority', s)(e),
  });

  return (
    <div className={isMobile ? 'tk-mlist' : 'tk-list-panel'}>
      {popover?.type === 'status' && (
        <StatusPopover
          currentStatus={popover.task.completed ? 'done' : popover.task.status}
          onSelect={(st) => changeStatus(popover.task, st)}
          onClose={() => setPopover(null)}
          style={popStyle}
        />
      )}
      {popover?.type === 'priority' && (
        <PriorityPopover
          currentPriority={popover.task.priority}
          onSelect={(pr) => updateTask(popover.task.id, { priority: pr })}
          onClose={() => setPopover(null)}
          style={popStyle}
        />
      )}
      {popover?.type === 'date' && (
        <TaskDatePickerPopover
          task={popover.task}
          onSave={(patch) => updateTask(popover.task.id, patch)}
          onClose={() => setPopover(null)}
          style={popStyle}
        />
      )}

      {groups.map((g) => {
        const open = !shut[g.key];
        return (
          <section key={g.key} className="tk-group">
            <button
              type="button"
              className="tk-group__head"
              onClick={() => setShut((s) => ({ ...s, [g.key]: !s[g.key] }))}
              aria-expanded={open}
            >
              <AppIcon name={open ? 'caretDown' : 'caretRight'} size={12} style={{ color: 'var(--tk-text-mute)' }} />
              <AppIcon name={g.icon} size={isMobile ? 16 : 15} style={{ color: `var(--tk-ks-${g.key}-fg)` }} />
              <span className="tk-group__name" style={{ color: `var(--tk-ks-${g.key}-fg)` }}>{g.name}</span>
              <span className="tk-group__count">{g.tasks.length}</span>
              {!isMobile && <span className="tk-group__line" />}
            </button>
            {open && (
              <div className="tk-group__items">
                {g.tasks.map((task) => (
                  <TaskCard key={task.id} variant={isMobile ? 'mobile' : 'row'} {...cardProps(task)} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {groups.length === 0 && <div className="tk-list-empty">Không có việc nào khớp bộ lọc.</div>}
    </div>
  );
}

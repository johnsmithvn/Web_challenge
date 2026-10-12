import { useState, useMemo, useCallback, useEffect } from 'react';
import AppIcon from './AppIcon';
import TaskCard from './TaskCard';
import { ElfColumnDecor, ElfDivider } from './TaskElfDecor';
import { useTheme } from '../contexts/ThemeContext';
import { toDateStr } from '../utils/dateUtils';
import {
  getKanbanRange,
  groupKanbanColumns,
  matchTaskSearch,
  STATUS_META,
} from '../utils/kanbanUtils';
import { parseTaskQuickText } from '../utils/taskNlpParser';
import { sortSubtasks } from '../utils/subtaskUtils';
import { StatusPopover, PriorityPopover, TaskDatePickerPopover } from './TaskFloatingPopovers';
import '../styles/tasks-aurora.css';

/*
 * TaskKanbanView — bảng 4 cột theo mockup "Nhiệm vụ · Kanban tối & sáng".
 *   Desktop: 4 cột (Bỏ qua mặc định thu gọn thành thanh dọc 54px), "+" đầu cột để gõ nhanh,
 *            kéo thẻ sang cột khác để đổi trạng thái.
 *   Mobile : lưới 4 tab (số lớn + tên), hiện từng cột, vuốt ngang để đổi cột,
 *            nút "+ Thêm việc" cuối cột mở sheet Việc mới.
 * Bộ lọc thời gian / tìm kiếm do TasksPage giữ (dùng chung với Danh sách).
 */
const COLUMNS = ['todo', 'doing', 'done', 'skip'];

export default function TaskKanbanView({
  taskModel,
  onSelectTask,
  onOpenSubtask,
  onQuickText,
  onQuickAdd,
  onOpenFullForm,
  refreshKey = 0,
  recentDone = [],
  selectedId,
  isMobile = false,
  timeFilter = 'all',
  customRange = null,
  searchQuery = '',
}) {
  const elf = useTheme().taskStyle === 'elf';
  const {
    pendingTasks = [],
    skippedTasks = [],
    tasks = [],
    completedToday = [],
    getCompletedTasksRange,
    completeTask,
    uncompleteTask,
    updateTask,
    addTask,
  } = taskModel;

  const today = toDateStr();

  // Cột thu gọn (mặc định thu gọn Bỏ qua), nhớ giữa các lần mở
  const [collapsedCols, setCollapsedCols] = useState(() => {
    try {
      const saved = localStorage.getItem('vl_kanban_collapsed_cols');
      if (saved) return new Set(JSON.parse(saved));
    } catch {
      // dùng mặc định
    }
    return new Set(['skip']);
  });
  const toggleCollapseCol = useCallback((colKey) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colKey)) next.delete(colKey);
      else next.add(colKey);
      try { localStorage.setItem('vl_kanban_collapsed_cols', JSON.stringify([...next])); } catch { /* bỏ qua */ }
      return next;
    });
  }, []);

  const [mobileCol, setMobileCol] = useState('todo');
  const [touchX, setTouchX] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [popover, setPopover] = useState(null); // { type, task, x, y }
  const [expanded, setExpanded] = useState(() => new Set());
  const [addingCol, setAddingCol] = useState(null);
  const [addText, setAddText] = useState('');

  const range = useMemo(() => getKanbanRange(timeFilter, today, customRange), [timeFilter, today, customRange]);

  // Lọc "Chọn ngày": việc xong theo ngày hoàn thành trong khoảng (có thể cũ hơn 30 ngày) → tải riêng
  const [rangeDone, setRangeDone] = useState([]);
  useEffect(() => {
    if (!getCompletedTasksRange || timeFilter !== 'custom' || !range) return undefined;
    let stale = false;
    getCompletedTasksRange(range.from, range.to).then((rows) => {
      if (!stale) setRangeDone(rows || []);
    });
    return () => { stale = true; };
  }, [getCompletedTasksRange, timeFilter, range, refreshKey]);

  const subtasksByParent = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t.parent_task_id) continue;
      map.set(t.parent_task_id, [...(map.get(t.parent_task_id) || []), t]);
    }
    for (const [k, list] of map) map.set(k, sortSubtasks(list));
    return map;
  }, [tasks]);
  const matches = useCallback(
    (t) => matchTaskSearch(t, searchQuery, (subtasksByParent.get(t.id) || []).map((s) => s.title || '')),
    [searchQuery, subtasksByParent]
  );

  const openTasks = useMemo(() => {
    const base = timeFilter === 'late' ? pendingTasks : [...pendingTasks, ...skippedTasks];
    return searchQuery.trim() ? base.filter(matches) : base;
  }, [pendingTasks, skippedTasks, timeFilter, searchQuery, matches]);

  // Việc xong = bản tải (30 ngày, hoặc theo khoảng ngày) + việc vừa xong trong state, trừ việc đã mở lại
  const doneSource = useMemo(() => {
    const openIds = new Set([...pendingTasks, ...skippedTasks].map((t) => t.id));
    const map = new Map();
    for (const t of timeFilter === 'custom' ? rangeDone : recentDone) if (!openIds.has(t.id)) map.set(t.id, t);
    for (const t of completedToday) map.set(t.id, t);
    return [...map.values()];
  }, [timeFilter, rangeDone, recentDone, completedToday, pendingTasks, skippedTasks]);

  const completedList = useMemo(() => {
    if (timeFilter === 'late') return [];
    return searchQuery.trim() ? doneSource.filter(matches) : doneSource;
  }, [doneSource, timeFilter, searchQuery, matches]);

  const grouped = useMemo(() => groupKanbanColumns(openTasks, completedList, range), [openTasks, completedList, range]);
  const allVisible = useMemo(() => [...openTasks, ...completedList], [openTasks, completedList]);

  const handleMoveTo = useCallback(async (task, target) => {
    if (target === 'done') await completeTask(task.id);
    else if (task.completed || task.status === 'completed' || task.status === 'done') await uncompleteTask(task.id, target);
    else await updateTask(task.id, { status: target });
  }, [completeTask, uncompleteTask, updateTask]);

  const handleDrop = async (e, col) => {
    e.preventDefault();
    setDragOverCol(null);
    const task = allVisible.find((t) => t.id === draggedTaskId);
    setDraggedTaskId(null);
    if (task && task.status !== col) await handleMoveTo(task, col);
  };

  const openPop = (type, task) => (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPopover({ type, task, x: r.left, y: r.bottom + 6 });
  };
  const popStyle = popover ? { position: 'fixed', top: `${popover.y}px`, left: `${popover.x}px` } : null;

  const submitAdd = async (col) => {
    const raw = addText.trim();
    if (!raw) {
      setAddingCol(null);
      return;
    }
    if (!parseTaskQuickText(raw, today).title) return;
    setAddText('');
    await onQuickText?.(raw, col);
  };

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
  });

  const columns = COLUMNS.map((key) => ({ key, ...STATUS_META[key], tasks: grouped[key] || [] }));
  const emptyLabel = searchQuery.trim() ? 'Không có kết quả' : 'Thả thẻ vào đây';

  const popovers = (
    <>
      {popover?.type === 'status' && (
        <StatusPopover
          currentStatus={popover.task.completed ? 'done' : popover.task.status}
          onSelect={(st) => handleMoveTo(popover.task, st)}
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
    </>
  );

  // ── Mobile: lưới 4 tab + 1 cột ──
  if (isMobile) {
    const col = columns.find((c) => c.key === mobileCol) || columns[0];
    return (
      <div
        className="tk-mkanban"
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          setTouchX(null);
          if (Math.abs(dx) < 60) return;
          const i = Math.max(0, Math.min(COLUMNS.length - 1, COLUMNS.indexOf(mobileCol) + (dx < 0 ? 1 : -1)));
          setMobileCol(COLUMNS[i]);
        }}
      >
        {popovers}
        <div className="tk-mkanban__tabs" role="tablist">
          {columns.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={c.key === col.key}
              className={`tk-mkanban__tab${c.key === col.key ? ' is-on' : ''}`}
              style={{ '--tab-c': c.color }}
              onClick={() => setMobileCol(c.key)}
            >
              <span className="tk-mkanban__count">{c.tasks.length}</span>
              <span className="tk-mkanban__name">
                <span className="tk-dot" style={{ background: c.color }} />
                {c.label}
              </span>
            </button>
          ))}
        </div>
        <div className="tk-mkanban__list">
          {col.tasks.map((task) => (
            <TaskCard key={task.id} variant="mobile" {...cardProps(task)} />
          ))}
          {col.tasks.length === 0 && <div className="tk-mkanban__empty">Chưa có việc</div>}
          <button type="button" className="tk-mkanban__add" onClick={() => onQuickAdd?.(col.key)}>
            <AppIcon name="plus" size={14} />
            Thêm việc
          </button>
        </div>
      </div>
    );
  }

  // ── Desktop: 4 cột ──
  return (
    <div className="tk-board">
      {popovers}
      {columns.map((c) => {
        const shut = collapsedCols.has(c.key);
        const over = dragOverCol === c.key;
        const dz = {
          onDragOver: (e) => {
            e.preventDefault();
            if (dragOverCol !== c.key) setDragOverCol(c.key);
          },
          onDragLeave: (e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null);
          },
          onDrop: (e) => handleDrop(e, c.key),
        };

        if (shut) {
          return (
            <button
              key={c.key}
              type="button"
              className={`tk-col tk-col--shut${over ? ' is-over' : ''}`}
              onClick={() => toggleCollapseCol(c.key)}
              title={`Mở cột ${c.label}`}
              {...dz}
            >
              <span className="tk-col__dot" style={{ background: c.color, boxShadow: `0 0 12px ${c.color}` }} />
              <span className="tk-col__vtitle">{c.label}</span>
              <span className="tk-col__count">{c.tasks.length}</span>
            </button>
          );
        }

        const adding = addingCol === c.key;
        const chips = adding ? parseTaskQuickText(addText, today).chips : [];
        return (
          <div
            key={c.key}
            className={`tk-col${over ? ' is-over' : ''}`}
            style={{ '--col-c': c.color, '--col-tint': `var(--tk-col-tint-${c.key})` }}
            {...dz}
          >
            {elf && <ElfColumnDecor />}
            <div className="tk-col__head">
              <span className="tk-col__dot" style={{ background: c.color, boxShadow: `0 0 12px ${c.color}` }} />
              <span className="tk-col__title">{c.label}</span>
              <span className="tk-col__count">{c.tasks.length}</span>
              <span className="tk-col__spacer" />
              <button
                type="button"
                className="tk-col__btn"
                title="Thêm việc"
                onClick={() => {
                  setAddingCol(adding ? null : c.key);
                  setAddText('');
                }}
              >
                <AppIcon name="plus" size={15} />
              </button>
              <button type="button" className="tk-col__btn tk-col__btn--mute" title="Thu gọn" onClick={() => toggleCollapseCol(c.key)}>
                <AppIcon name="arrowLineLeft" size={14} />
              </button>
            </div>
            {elf && <ElfDivider />}
            <div className="tk-col__body">
              {adding && (
                <div className="tk-inline-add">
                  <input
                    autoFocus
                    value={addText}
                    placeholder="Tên việc… thử “mai 9h !cao #UI”"
                    onChange={(e) => setAddText(e.target.value)}
                    onBlur={() => { if (!addText.trim()) setAddingCol(null); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitAdd(c.key);
                      if (e.key === 'Escape') {
                        setAddingCol(null);
                        setAddText('');
                      }
                    }}
                  />
                  <div className="tk-inline-add__chips">
                    {chips.length ? chips.map((ch, i) => (
                      <span key={i} className="tk-inline-add__chip">
                        <AppIcon name={ch.ic} size={12} />
                        {ch.n}
                      </span>
                    )) : <span className="tk-inline-add__hint">mai · t2 · 9h · !cao · #nhãn</span>}
                    <span className="tk-inline-add__keys">↵ · esc</span>
                    {onOpenFullForm && (
                      <button
                        type="button"
                        className="tk-inline-add__full"
                        title="Mở form đầy đủ"
                        onMouseDown={(e) => {
                          e.preventDefault(); // giữ ô gõ không blur trước khi mở
                          const raw = addText;
                          setAddingCol(null);
                          setAddText('');
                          onOpenFullForm(c.key, parseTaskQuickText(raw, today));
                        }}
                      >
                        <AppIcon name="arrowsOutSimple" size={12} />
                        Chi tiết
                      </button>
                    )}
                  </div>
                </div>
              )}
              {c.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  variant="card"
                  {...cardProps(task)}
                  dragProps={{
                    draggable: true,
                    onDragStart: (e) => {
                      setDraggedTaskId(task.id);
                      e.dataTransfer.setData('text/plain', String(task.id));
                      e.dataTransfer.effectAllowed = 'move';
                    },
                    onDragEnd: () => {
                      setDraggedTaskId(null);
                      setDragOverCol(null);
                    },
                  }}
                />
              ))}
              {c.tasks.length === 0 && !adding && <div className="tk-col__empty">{emptyLabel}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { useState, useMemo, useCallback, useEffect } from 'react';
import AppIcon from './AppIcon';
import { useConfirm } from './ConfirmModal';
import { toDateStr, formatDate } from '../utils/dateUtils';
import { getKanbanRange, groupKanbanColumns, matchTaskSearch, calculateKanbanCounts } from '../utils/kanbanUtils';
import { subtaskProgressByParent } from '../utils/subtaskUtils';
import { parseTaskQuickText, PRIORITY_LABELS } from '../utils/taskNlpParser';
import { describeRecurrence } from '../utils/taskFields';
import { useTags } from '../hooks/useTags';
import { StatusPopover, PriorityPopover, TaskDatePickerPopover } from './TaskFloatingPopovers';
import '../styles/kanban.css';
import '../styles/tasks-aurora.css';

const CARD_STATUS_STYLES = {
  late: {
    glow: '#FF8A98',
    tint: 'rgba(255, 92, 112, 0.07)',
    badgeFg: '#FF8A98',
    badgeBg: 'rgba(255, 92, 112, 0.12)',
    badgeBd: 'rgba(255, 92, 112, 0.3)',
    badgeIcon: 'warning',
  },
  today: {
    glow: '#FCD34D',
    tint: 'rgba(251, 191, 36, 0.05)',
    badgeFg: '#FCD34D',
    badgeBg: 'rgba(251, 191, 36, 0.12)',
    badgeBd: 'rgba(251, 191, 36, 0.3)',
    badgeIcon: 'clock',
  },
  soon: {
    glow: '#93C5FD',
    tint: 'transparent',
    badgeFg: '#93C5FD',
    badgeBg: 'rgba(96, 165, 250, 0.10)',
    badgeBd: 'rgba(96, 165, 250, 0.25)',
    badgeIcon: 'calendar',
  },
  none: {
    glow: 'rgba(255, 255, 255, 0.12)',
    tint: 'transparent',
    badgeFg: 'var(--tk-text-mute, #8A93AD)',
    badgeBg: 'transparent',
    badgeBd: 'var(--tk-border, rgba(255, 255, 255, 0.16))',
    borderDashed: true,
    badgeIcon: 'calendar',
  },
  done: {
    glow: '#34D399',
    tint: 'rgba(52, 211, 153, 0.05)',
    badgeFg: '#6EE7B7',
    badgeBg: 'rgba(52, 211, 153, 0.12)',
    badgeBd: 'rgba(52, 211, 153, 0.3)',
    badgeIcon: 'check',
  },
  skip: {
    glow: '#94A3B8',
    tint: 'transparent',
    badgeFg: '#A9B4C6',
    badgeBg: 'rgba(148, 163, 184, 0.08)',
    badgeBd: 'rgba(148, 163, 184, 0.2)',
    badgeIcon: 'minus',
  },
};

/**
 * TaskKanbanView — Bảng Kanban 4 cột chuẩn thiết kế Vũ trụ Aurora & Clean Pastel.
 */
export default function TaskKanbanView({
  taskModel,
  onSelectTask,
  refreshKey = 0,
}) {
  const {
    pendingTasks = [],
    skippedTasks = [],
    tasks = [],
    getCompletedTasksRange,
    completeTask,
    uncompleteTask,
    updateTask,
    addTask,
    linkTaskTag,
  } = taskModel;

  const { tags: allTags, addTag } = useTags();
  const { ConfirmModal } = useConfirm();
  const today = useMemo(() => toDateStr(), []);

  // State bộ lọc thời gian: 'all' | 'today' | '7d' | 'late'
  const [timeFilter, setTimeFilter] = useState('all');

  // Quản lý cột thu gọn (Mặc định thu gọn cột Bỏ qua)
  const [collapsedCols, setCollapsedCols] = useState(() => {
    try {
      const saved = localStorage.getItem('vl_kanban_collapsed_cols');
      if (saved) return new Set(JSON.parse(saved));
    } catch {
      // fallback
    }
    return new Set(['skip']);
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

  // Drag & drop
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Popover nổi tại chỗ trên thẻ
  const [activePopover, setActivePopover] = useState(null); // { type: 'status'|'date'|'priority', taskId, x, y }

  // Mở rộng subtasks trên thẻ
  const [expandedSubtaskIds, setExpandedSubtaskIds] = useState(() => new Set());
  const [inlineSubInputs, setInlineSubInputs] = useState({});

  // Input thêm việc nhanh ở đầu cột
  const [activeAddingCol, setActiveAddingCol] = useState(null);
  const [quickAddTexts, setQuickAddTexts] = useState({});

  // Map subtasks theo parent_task_id để tìm kiếm nhanh
  const subtasksByParent = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (t.parent_task_id) {
        const list = map.get(t.parent_task_id) || [];
        list.push(t.title || '');
        map.set(t.parent_task_id, list);
      }
    }
    return map;
  }, [tasks]);

  // Tải danh sách task đã hoàn thành theo khoảng thời gian (khi lọc 'late' thì không cần fetch)
  const range = useMemo(
    () => getKanbanRange(timeFilter, today, null),
    [timeFilter, today]
  );

  useEffect(() => {
    if (!getCompletedTasksRange || timeFilter === 'late') return;
    let stale = false;
    getCompletedTasksRange(range?.from ?? '2020-01-01', range?.to ?? '2099-12-31').then((rows) => {
      if (stale) return;
      setCompletedRangeTasks(rows || []);
    });
    return () => { stale = true; };
  }, [range, getCompletedTasksRange, refreshKey, timeFilter]);

  // State tìm kiếm từ khóa
  const [searchQuery, setSearchQuery] = useState('');

  // Tách openTasks và completedTasks cho groupKanbanColumns
  const openTasks = useMemo(() => {
    const baseList = timeFilter === 'late' ? pendingTasks : [...pendingTasks, ...skippedTasks];
    if (!searchQuery.trim()) return baseList;
    return baseList.filter((t) => matchTaskSearch(t, searchQuery, subtasksByParent.get(t.id) || []));
  }, [pendingTasks, skippedTasks, timeFilter, searchQuery, subtasksByParent]);

  const completedList = useMemo(() => {
    if (timeFilter === 'late') return [];
    if (!searchQuery.trim()) return completedRangeTasks;
    return completedRangeTasks.filter((t) => matchTaskSearch(t, searchQuery, subtasksByParent.get(t.id) || []));
  }, [completedRangeTasks, timeFilter, searchQuery, subtasksByParent]);

  // Danh sách toàn bộ task trong tầm hiển thị của Kanban (hỗ trợ HTML5 drag-and-drop an toàn)
  const allTasks = useMemo(() => [...openTasks, ...completedList], [openTasks, completedList]);

  // Đếm số lượng task real-time cho 4 pills lọc thời gian
  const filterCounts = useMemo(() => {
    return calculateKanbanCounts({
      pendingTasks,
      skippedTasks,
      completedToday: taskModel.completedToday || [],
      today,
      searchQuery,
      subtasksByParent,
    });
  }, [pendingTasks, skippedTasks, taskModel.completedToday, today, searchQuery, subtasksByParent]);

  // Chia cột theo hàm chuẩn kanbanUtils
  const groupedCols = useMemo(() => {
    return groupKanbanColumns(openTasks, completedList, range);
  }, [openTasks, completedList, range]);

  // Mảng 4 cột để render giao diện
  const columns = useMemo(() => {
    return [
      { key: 'todo', title: 'Cần làm', tasks: groupedCols.todo || [] },
      { key: 'doing', title: 'Đang làm', tasks: groupedCols.doing || [] },
      { key: 'done', title: 'Hoàn thành', tasks: groupedCols.done || [] },
      { key: 'skip', title: 'Bỏ qua', tasks: groupedCols.skip || [] },
    ];
  }, [groupedCols]);

  const totalFiltered = useMemo(() => columns.reduce((acc, c) => acc + c.tasks.length, 0), [columns]);

  // Tiến độ subtasks
  const subtaskProgress = useMemo(() => {
    return subtaskProgressByParent(tasks);
  }, [tasks]);

  // Xử lý chuyển cột
  const handleMoveTo = useCallback(
    async (task, targetCol) => {
      if (targetCol === 'done') {
        await completeTask(task.id);
      } else if (task.completed || task.status === 'completed' || task.status === 'done') {
        // Một lần ghi: uncompleteTask nhận luôn status đích (todo | doing | skip)
        await uncompleteTask(task.id, targetCol);
      } else {
        await updateTask(task.id, { status: targetCol });
      }
    },
    [completeTask, uncompleteTask, updateTask]
  );

  // Kéo thả HTML5
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', String(taskId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverCol(null);
  };

  const handleDrop = async (e, targetColKey) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!draggedTaskId) return;
    const task = allTasks.find((t) => t.id === draggedTaskId);
    if (!task) return;
    await handleMoveTo(task, targetColKey);
    setDraggedTaskId(null);
  };

  // Submit tạo việc nhanh ở đầu cột
  const handleQuickAddSubmit = async (colKey) => {
    const raw = quickAddTexts[colKey]?.trim();
    if (!raw) {
      setActiveAddingCol(null);
      return;
    }
    const parsed = parseTaskQuickText(raw, today);
    if (!parsed.title) return;

    const initialStatus = colKey === 'doing' ? 'doing' : colKey === 'skip' ? 'skip' : colKey === 'done' ? 'done' : 'todo';
    const isDoneCol = initialStatus === 'done';

    const created = await addTask({
      title: parsed.title,
      dueDate: parsed.due_date,
      dueTime: parsed.due_time,
      priority: parsed.priority,
      status: initialStatus,
      completed: isDoneCol,
      completedAt: isDoneCol ? new Date().toISOString() : null,
    });

    if (created?.id && parsed.tags?.length > 0 && linkTaskTag) {
      for (const tagStr of parsed.tags) {
        let tagObj = (allTags || []).find((tg) => tg.name.toLowerCase() === tagStr.toLowerCase());
        if (!tagObj && addTag) {
          tagObj = await addTag(tagStr);
        }
        if (tagObj?.id) {
          await linkTaskTag(created.id, tagObj);
        }
      }
    }

    setQuickAddTexts((prev) => ({ ...prev, [colKey]: '' }));
    setActiveAddingCol(null);
  };

  // Màu sắc cho 4 cột
  const colColors = {
    todo: { dot: '#60A5FA', tint: 'rgba(96,165,250,.05)', title: 'Cần làm' },
    doing: { dot: '#FBBF24', tint: 'rgba(251,191,36,.04)', title: 'Đang làm' },
    done: { dot: '#34D399', tint: 'rgba(52,211,153,.04)', title: 'Hoàn thành' },
    skip: { dot: '#94A3B8', tint: 'rgba(148,163,184,.03)', title: 'Bỏ qua' },
  };

  return (
    <div className="tasks-workspace">
      {ConfirmModal}

      {/* Popovers nổi tại chỗ */}
      {activePopover?.type === 'status' && (
        <StatusPopover
          currentStatus={activePopover.currentStatus}
          onSelect={(st) => handleMoveTo({ id: activePopover.taskId, status: activePopover.currentStatus }, st)}
          onClose={() => setActivePopover(null)}
          style={{ position: 'fixed', top: `${activePopover.y}px`, left: `${activePopover.x}px` }}
        />
      )}
      {activePopover?.type === 'priority' && (
        <PriorityPopover
          currentPriority={activePopover.currentPriority}
          onSelect={(pr) => updateTask(activePopover.taskId, { priority: pr })}
          onClose={() => setActivePopover(null)}
          style={{ position: 'fixed', top: `${activePopover.y}px`, left: `${activePopover.x}px` }}
        />
      )}
      {activePopover?.type === 'date' && (
        <TaskDatePickerPopover
          initialDate={activePopover.currentDate}
          initialTime={activePopover.currentTime}
          onSave={(d, t) => updateTask(activePopover.taskId, { due_date: d, due_time: t })}
          onClose={() => setActivePopover(null)}
          style={{ position: 'fixed', top: `${activePopover.y}px`, left: `${activePopover.x}px` }}
        />
      )}

      {/* Thanh Filter & Search Bar chuẩn mockup */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '14px',
          padding: '0 2px',
        }}
      >
        {/* Bộ lọc thời gian chuẩn 4 pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'today', label: 'Hôm nay' },
            { id: '7d', label: '7 ngày tới' },
            { id: 'late', label: 'Quá hạn' },
          ].map((f) => {
            const isActive = timeFilter === f.id;
            const cnt = filterCounts[f.id] ?? 0;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setTimeFilter(f.id)}
                style={{
                  height: '30px',
                  padding: '0 12px',
                  borderRadius: '999px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: isActive ? '1px solid var(--tk-accent, #5EF2C2)' : '1px solid var(--tk-border, rgba(255,255,255,0.08))',
                  background: isActive ? 'rgba(94, 242, 194, 0.12)' : 'var(--tk-card-bg, rgba(14,19,36,0.6))',
                  color: isActive ? 'var(--tk-accent, #5EF2C2)' : 'var(--tk-text-sub, #8A93AD)',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{f.label}</span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    opacity: 0.75,
                  }}
                >
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Ô tìm kiếm từ khóa real-time + hiển thị số kết quả */}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {searchQuery && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 500,
                fontSize: '11.5px',
                color: 'var(--tk-text-sub, #8A93AD)',
                whiteSpace: 'nowrap',
              }}
            >
              {totalFiltered} kết quả
            </span>
          )}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: '260px',
            }}
          >
            <span style={{ position: 'absolute', left: '10px', color: 'var(--tk-text-mute, #5B6480)', display: 'grid', placeItems: 'center' }}>
              <AppIcon name="search" size={13} />
            </span>
            <input
              type="text"
              placeholder="Tìm việc, #nhãn, mô tả..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                padding: '0 28px 0 30px',
                borderRadius: '999px',
                border: '1px solid var(--tk-border, rgba(255,255,255,0.08))',
                background: 'var(--tk-card-bg, rgba(14,19,36,0.6))',
                color: 'var(--tk-text-main, #E8ECF7)',
                fontSize: '12.5px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--tk-text-mute, #5B6480)',
                  cursor: 'pointer',
                  padding: '2px',
                  fontSize: '12px',
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bảng Kanban 4 cột */}
      <div className="tk-kanban-board">
        {columns.map((col) => {
          const isCollapsed = collapsedCols.has(col.key);
          const colInfo = colColors[col.key] || colColors.todo;
          const isOver = dragOverCol === col.key;
          const isAdding = activeAddingCol === col.key;
          const quickText = quickAddTexts[col.key] || '';
          const parsedQuick = isAdding ? parseTaskQuickText(quickText, today) : null;

          if (isCollapsed) {
            return (
              <div
                key={col.key}
                className="tk-kanban-col tk-kanban-col--collapsed"
                onClick={() => toggleCollapseCol(col.key)}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => handleDrop(e, col.key)}
                title={`Mở cột ${colInfo.title}`}
              >
                <span className="tk-col-header__dot" style={{ background: colInfo.dot }} />
                <span style={{ writingMode: 'vertical-rl', fontSize: '13.5px', fontWeight: 600, color: 'var(--tk-text-sub)' }}>
                  {colInfo.title}
                </span>
                <span className="tk-col-header__count">{col.tasks.length}</span>
              </div>
            );
          }

          return (
            <div
              key={col.key}
              className={`tk-kanban-col ${isOver ? 'tk-kanban-col--over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Cột Header */}
              <div className="tk-col-header">
                <span className="tk-col-header__dot" style={{ background: colInfo.dot }} />
                <span className="tk-col-header__title">{colInfo.title}</span>
                <span className="tk-col-header__count">{col.tasks.length}</span>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveAddingCol(isAdding ? null : col.key)}
                    title="Thêm việc nhanh"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tk-text-sub)', padding: '4px', borderRadius: '6px' }}
                  >
                    <AppIcon name="plus" size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCollapseCol(col.key)}
                    title="Thu gọn cột"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tk-text-mute)', padding: '4px', borderRadius: '6px' }}
                  >
                    <AppIcon name="caretLeft" size={14} />
                  </button>
                </div>
              </div>

              {/* Danh sách thẻ trong cột */}
              <div className="tk-col-body">
                {/* Form thêm việc nhanh đầu cột (NLP Parser) */}
                {isAdding && (
                  <div className="tk-inline-add">
                    <input
                      autoFocus
                      type="text"
                      value={quickText}
                      onChange={(e) => setQuickAddTexts((prev) => ({ ...prev, [col.key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleQuickAddSubmit(col.key);
                        if (e.key === 'Escape') setActiveAddingCol(null);
                      }}
                      placeholder="Tên việc… thử “mai 9h !cao #UI”"
                    />
                    {/* Live chips preview */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: '20px' }}>
                      {parsedQuick?.chips.map((chip, idx) => (
                        <span
                          key={idx}
                          style={{
                            height: '20px',
                            padding: '0 6px',
                            borderRadius: '4px',
                            background: 'rgba(94, 242, 194, 0.1)',
                            color: 'var(--tk-accent)',
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <AppIcon name={chip.ic.includes('calendar') ? 'calendar' : chip.ic.includes('hash') ? 'tag' : 'flag'} size={11} />
                          {chip.n}
                        </span>
                      ))}
                      {!parsedQuick?.chips.length && (
                        <span style={{ fontSize: '11px', color: 'var(--tk-text-mute)' }}>
                          mai · t2 · 9h · !cao · #nhãn
                        </span>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: '10.5px', color: 'var(--tk-text-mute)' }}>
                        ↵ thêm · esc
                      </span>
                    </div>
                  </div>
                )}

                {/* Các thẻ task trong cột */}
                {col.tasks.map((task) => {
                  const isDone = task.status === 'completed' || task.status === 'done';
                  const isSkip = task.status === 'skip';
                  const isOverdue = !isDone && !isSkip && task.due_date && task.due_date < today;
                  const isToday = !isDone && !isSkip && task.due_date === today;
                  const isFuture = !isDone && !isSkip && task.due_date && task.due_date > today;

                  const statusKey = isDone
                    ? 'done'
                    : isSkip
                    ? 'skip'
                    : isOverdue
                    ? 'late'
                    : isToday
                    ? 'today'
                    : isFuture
                    ? 'soon'
                    : 'none';

                  const stStyle = CARD_STATUS_STYLES[statusKey] || CARD_STATUS_STYLES.none;

                  // Tính số ngày trễ nếu quá hạn
                  const daysLate = isOverdue && task.due_date
                    ? Math.max(1, Math.round((new Date(`${today}T00:00:00`) - new Date(`${task.due_date}T00:00:00`)) / 864e5))
                    : 0;

                  // Nội dung badge ngày hạn
                  const dueBadgeText = isDone
                    ? `Hoàn thành${task.completed_at ? ' · ' + formatDate(toDateStr(new Date(task.completed_at))) : ''}`
                    : isSkip
                    ? `Bỏ qua${task.due_date ? ' · ' + formatDate(task.due_date) : ''}`
                    : isOverdue
                    ? `Quá hạn · ${formatDate(task.due_date)}${task.due_time ? ' · ' + task.due_time.slice(0, 5) : ''}`
                    : isToday
                    ? `Hôm nay${task.due_time ? ' · ' + task.due_time.slice(0, 5) : ''}`
                    : task.due_date
                    ? `${formatDate(task.due_date)}${task.due_time ? ' · ' + task.due_time.slice(0, 5) : ''}`
                    : 'Đặt hạn';

                  const subs = tasks.filter((t) => t.parent_task_id === task.id);
                  const isExpandedSubs = expandedSubtaskIds.has(task.id);
                  const progress = subtaskProgress.get(task.id);

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onSelectTask?.(task)}
                      className="tk-card"
                      style={{
                        background: `linear-gradient(100deg, ${stStyle.tint}, transparent 65%), var(--tk-card-bg)`,
                      }}
                    >
                      {/* Dải viền phát quang 2.5px bên trái */}
                      <span className="tk-card__glow-bar" style={{ background: stStyle.glow }} />

                      {/* Hàng badge trên cùng */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                        {/* 1. Badge ngày hạn (Click đổi nhanh) */}
                        <span
                          className="tk-badge-pill"
                          onClick={(e) => {
                            if (isDone) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActivePopover({
                              type: 'date',
                              taskId: task.id,
                              currentDate: task.due_date,
                              currentTime: task.due_time,
                              x: rect.left,
                              y: rect.bottom + 4,
                            });
                          }}
                          style={{
                            background: stStyle.badgeBg,
                            border: `1px ${stStyle.borderDashed ? 'dashed' : 'solid'} ${stStyle.badgeBd}`,
                            color: stStyle.badgeFg,
                          }}
                        >
                          <AppIcon name={stStyle.badgeIcon} size={11} />
                          {dueBadgeText}
                        </span>

                        {/* 2. Mức ưu tiên (Click đổi nhanh hoặc nút 22x22px nét đứt) */}
                        {task.priority > 0 && !isDone && (
                          <span
                            className="tk-badge-pill"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setActivePopover({
                                type: 'priority',
                                taskId: task.id,
                                currentPriority: task.priority,
                                x: rect.left,
                                y: rect.bottom + 4,
                              });
                            }}
                            style={{
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid rgba(255, 255, 255, 0.09)',
                              color: PRIORITY_LABELS[task.priority]?.color || 'var(--tk-text-sub)',
                            }}
                          >
                            <AppIcon name="flag" size={11} />
                            {PRIORITY_LABELS[task.priority]?.label || 'Ưu tiên'}
                          </span>
                        )}

                        {!task.priority && !isDone && !isSkip && (
                          <button
                            type="button"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setActivePopover({
                                type: 'priority',
                                taskId: task.id,
                                currentPriority: 0,
                                x: rect.left,
                                y: rect.bottom + 4,
                              });
                            }}
                            title="Đặt ưu tiên"
                            style={{
                              width: '22px',
                              height: '22px',
                              boxSizing: 'border-box',
                              borderRadius: '6px',
                              display: 'grid',
                              placeItems: 'center',
                              border: '1px dashed rgba(255, 255, 255, 0.18)',
                              color: 'var(--tk-text-mute, #5B6480)',
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <AppIcon name="flag" size={12} />
                          </button>
                        )}

                        {/* 3. Lặp lại (nếu có chu kỳ) */}
                        {task.recurrence_rule && (
                          <span
                            className="tk-badge-pill"
                            title={`Lặp lại: ${describeRecurrence(task.recurrence_rule)}`}
                            style={{
                              background: 'rgba(94, 242, 194, 0.08)',
                              border: '1px solid rgba(94, 242, 194, 0.25)',
                              color: 'var(--tk-accent, #5EF2C2)',
                            }}
                          >
                            <AppIcon name="repeat" size={11} />
                            <span>{describeRecurrence(task.recurrence_rule)}</span>
                          </span>
                        )}

                        {/* 4. Nhãn quá hạn góc phải (nếu trễ) */}
                        {statusKey === 'late' && daysLate > 0 && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontWeight: 500,
                              fontSize: '11px',
                              color: '#FF8A98',
                            }}
                          >
                            trễ {daysLate} ngày
                          </span>
                        )}
                      </div>

                      {/* Tiêu đề Task & Icon trạng thái click đổi nhanh */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActivePopover({
                              type: 'status',
                              taskId: task.id,
                              currentStatus: task.status,
                              x: rect.left,
                              y: rect.bottom + 4,
                            });
                          }}
                          title="Đổi trạng thái"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: stStyle.glow,
                            padding: '2px 0 0 0',
                          }}
                        >
                          <AppIcon name={isDone ? 'checkCircle' : 'circle'} size={16} />
                        </button>
                        <span
                          style={{
                            flex: 1,
                            fontSize: '13.5px',
                            fontWeight: 600,
                            lineHeight: 1.4,
                            color: isDone ? '#6EE7B7' : 'var(--tk-text-main, #E8ECF7)',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {task.title}
                        </span>
                      </div>

                      {/* Trích đoạn mô tả nếu có */}
                      {task.description && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--tk-text-sub)',
                            lineHeight: 1.45,
                            marginLeft: '24px',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {task.description}
                        </div>
                      )}

                      {/* Subtasks expand & tags */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: '24px' }}>
                        {progress && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedSubtaskIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(task.id)) next.delete(task.id);
                                else next.add(task.id);
                                return next;
                              });
                            }}
                            style={{
                              height: '24px',
                              padding: '0 7px',
                              boxSizing: 'border-box',
                              borderRadius: '7px',
                              border: '1px solid var(--tk-border, rgba(255, 255, 255, 0.09))',
                              background: 'var(--tk-border-soft, rgba(255, 255, 255, 0.04))',
                              color: 'var(--tk-text-main, #C4CCE0)',
                              fontSize: '11.5px',
                              fontFamily: "'JetBrains Mono', monospace",
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <AppIcon name="listChecks" size={13} />
                            <span>{progress.done}/{progress.total}</span>
                            <span
                              style={{
                                width: '22px',
                                height: '3px',
                                borderRadius: '2px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                overflow: 'hidden',
                                display: 'inline-block',
                              }}
                            >
                              <span
                                style={{
                                  display: 'block',
                                  height: '100%',
                                  width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                                  background: '#34D399',
                                  transition: 'width 0.2s ease',
                                }}
                              />
                            </span>
                            <AppIcon name={isExpandedSubs ? 'caretUp' : 'caretDown'} size={11} style={{ color: 'var(--tk-text-mute, #8A93AD)' }} />
                          </button>
                        )}

                        {(task._tags || []).map((tg) => (
                          <span key={tg.id} style={{ fontSize: '11.5px', color: 'var(--tk-accent)', fontWeight: 500 }}>
                            #{tg.name}
                          </span>
                        ))}
                      </div>

                      {/* Danh sách subtasks mở rộng */}
                      {isExpandedSubs && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            marginLeft: '24px',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--tk-border-soft)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          {subs.map((st) => (
                            <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => (st.completed ? uncompleteTask(st.id) : completeTask(st.id))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: st.completed ? 'var(--tk-text-done)' : 'var(--tk-text-mute)' }}
                              >
                                <AppIcon name={st.completed ? 'checkSquare' : 'square'} size={13} />
                              </button>
                              <span style={{ fontSize: '12px', color: st.completed ? 'var(--tk-text-mute)' : 'var(--tk-text-main)', textDecoration: st.completed ? 'line-through' : 'none' }}>
                                {st.title}
                              </span>
                            </div>
                          ))}
                          <input
                            type="text"
                            placeholder="+ Thêm việc con, Enter..."
                            value={inlineSubInputs[task.id] || ''}
                            onChange={(e) => setInlineSubInputs((prev) => ({ ...prev, [task.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = (inlineSubInputs[task.id] || '').trim();
                                if (val) {
                                  addTask?.({ title: val, dueDate: task.due_date, parentTaskId: task.id });
                                  setInlineSubInputs((prev) => ({ ...prev, [task.id]: '' }));
                                }
                              }
                            }}
                            style={{
                              height: '24px',
                              borderRadius: '4px',
                              border: '1px solid var(--tk-border)',
                              background: 'transparent',
                              padding: '0 6px',
                              fontSize: '11.5px',
                              color: 'var(--tk-text-main)',
                              outline: 'none',
                              marginTop: '2px',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {col.tasks.length === 0 && !isAdding && (
                  <div style={{ height: '80px', display: 'grid', placeItems: 'center', border: '1px dashed var(--tk-border)', borderRadius: '12px', color: 'var(--tk-text-mute)', fontSize: '12px' }}>
                    Thả thẻ vào đây
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

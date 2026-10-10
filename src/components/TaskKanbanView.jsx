import { useState, useMemo, useCallback, useEffect } from 'react';
import AppIcon from './AppIcon';
import { useConfirm } from './ConfirmModal';
import { toDateStr, formatDate } from '../utils/dateUtils';
import { getKanbanRange, groupKanbanColumns, matchTaskSearch, calculateKanbanCounts } from '../utils/kanbanUtils';
import { subtaskProgressByParent } from '../utils/subtaskUtils';
import { parseTaskQuickText, PRIORITY_LABELS, shiftDateDays } from '../utils/taskNlpParser';
import { describeRecurrence } from '../utils/taskFields';
import { useTags } from '../hooks/useTags';
import { StatusPopover, PriorityPopover, TaskDatePickerPopover, DateRangePopover } from './TaskFloatingPopovers';
import '../styles/kanban.css';
import '../styles/tasks-aurora.css';

// Màu theo tình trạng thời gian lấy từ token CSS (--tk-ks-*) để bản tối/sáng tự đổi.
const ksVars = (k) => ({
  glow: `var(--tk-ks-${k}-glow)`,
  tint: `var(--tk-ks-${k}-tint)`,
  badgeFg: `var(--tk-ks-${k}-fg)`,
  badgeBg: `var(--tk-ks-${k}-bg)`,
  badgeBd: `var(--tk-ks-${k}-bd)`,
});
const CARD_STATUS_STYLES = {
  late: { ...ksVars('late'), badgeIcon: 'warning' },
  today: { ...ksVars('today'), badgeIcon: 'clock' },
  soon: { ...ksVars('soon'), badgeIcon: 'calendar' },
  none: { ...ksVars('none'), badgeIcon: 'calendar', borderDashed: true },
  done: { ...ksVars('done'), badgeIcon: 'check' },
  skip: { ...ksVars('skip'), badgeIcon: 'minus' },
};

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'today', label: 'Hôm nay' },
  { id: '7d', label: '7 ngày tới' },
  { id: 'late', label: 'Quá hạn' },
];
const shortDM = (v) => `${Number(v.slice(8, 10))}/${Number(v.slice(5, 7))}`;
const MOBILE_MQ = '(max-width: 640px)';

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

  // State bộ lọc thời gian: 'all' | 'today' | '7d' | 'late' | 'custom' (Chọn ngày)
  const [timeFilter, setTimeFilter] = useState('all');
  const [customRange, setCustomRange] = useState(null); // { customFrom, customTo }
  const [rangePop, setRangePop] = useState(null); // { x, y }

  // Mobile: hiện từng cột, chuyển bằng tab trạng thái hoặc vuốt ngang
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.(MOBILE_MQ).matches ?? false);
  const [mobileCol, setMobileCol] = useState('todo');
  const [touchX, setTouchX] = useState(null);
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE_MQ);
    if (!mq) return;
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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
    () => getKanbanRange(timeFilter, today, customRange),
    [timeFilter, today, customRange]
  );

  // Việc xong 30 ngày gần nhất: nguồn của cột Hoàn thành khi xem 'Tất cả' và của số đếm.
  // ponytail: 30 ngày, xem cũ hơn bằng 'Chọn ngày'
  const [recentDone, setRecentDone] = useState([]);
  useEffect(() => {
    if (!getCompletedTasksRange) return;
    let stale = false;
    getCompletedTasksRange(shiftDateDays(-30, today), today).then((rows) => {
      if (!stale) setRecentDone(rows || []);
    });
    return () => { stale = true; };
  }, [getCompletedTasksRange, refreshKey, today]);

  useEffect(() => {
    if (!getCompletedTasksRange || timeFilter === 'late' || timeFilter === 'all') return;
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

  // Việc xong = bản fetch + việc vừa xong trong state (để thẻ vừa kéo sang Hoàn thành không biến mất),
  // trừ việc đã mở lại (nằm trong pending/skipped).
  const doneSource = useMemo(() => {
    const openIds = new Set([...pendingTasks, ...skippedTasks].map((t) => t.id));
    const map = new Map();
    for (const t of timeFilter === 'all' ? recentDone : completedRangeTasks) {
      if (!openIds.has(t.id)) map.set(t.id, t);
    }
    for (const t of taskModel.completedToday || []) map.set(t.id, t);
    return [...map.values()];
  }, [timeFilter, recentDone, completedRangeTasks, pendingTasks, skippedTasks, taskModel.completedToday]);

  const completedList = useMemo(() => {
    if (timeFilter === 'late') return [];
    if (!searchQuery.trim()) return doneSource;
    return doneSource.filter((t) => matchTaskSearch(t, searchQuery, subtasksByParent.get(t.id) || []));
  }, [doneSource, timeFilter, searchQuery, subtasksByParent]);

  // Danh sách toàn bộ task trong tầm hiển thị của Kanban (hỗ trợ HTML5 drag-and-drop an toàn)
  const allTasks = useMemo(() => [...openTasks, ...completedList], [openTasks, completedList]);

  // Đếm số lượng task real-time cho 4 pills lọc thời gian
  const filterCounts = useMemo(() => {
    return calculateKanbanCounts({
      pendingTasks,
      skippedTasks,
      completedToday: taskModel.completedToday || [],
      completedRecent: (() => {
        const map = new Map(recentDone.map((t) => [t.id, t]));
        for (const t of taskModel.completedToday || []) map.set(t.id, t);
        const openIds = new Set([...pendingTasks, ...skippedTasks].map((t) => t.id));
        return [...map.values()].filter((t) => !openIds.has(t.id));
      })(),
      today,
      searchQuery,
      subtasksByParent,
    });
  }, [pendingTasks, skippedTasks, taskModel.completedToday, recentDone, today, searchQuery, subtasksByParent]);

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
    todo: { dot: 'var(--tk-st-todo)', title: 'Cần làm' },
    doing: { dot: 'var(--tk-st-doing)', title: 'Đang làm' },
    done: { dot: 'var(--tk-st-done)', title: 'Hoàn thành' },
    skip: { dot: 'var(--tk-st-skip)', title: 'Bỏ qua' },
  };

  return (
    <div className="tk-kanban-wrap">
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

      {rangePop && (
        <DateRangePopover
          initialFrom={customRange?.customFrom}
          initialTo={customRange?.customTo}
          onApply={(from, to) => {
            setCustomRange({ customFrom: from, customTo: to });
            setTimeFilter('custom');
          }}
          onClose={() => setRangePop(null)}
          style={{ position: 'fixed', top: `${rangePop.y}px`, left: `${rangePop.x}px` }}
        />
      )}

      {/* Thanh lọc & tìm kiếm */}
      <div className="tk-filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTimeFilter(f.id)}
            className={`tk-filter-pill${timeFilter === f.id ? ' tk-filter-pill--active' : ''}`}
          >
            <span>{f.label}</span>
            <span className="tk-filter-pill__count">{filterCounts[f.id] ?? 0}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setRangePop({ x: r.left, y: r.bottom + 6 });
          }}
          className={`tk-filter-pill${timeFilter === 'custom' ? ' tk-filter-pill--active' : ''}`}
        >
          <AppIcon name="calendar" size={13} />
          <span>
            {timeFilter === 'custom' && customRange
              ? customRange.customFrom === customRange.customTo
                ? shortDM(customRange.customFrom)
                : `${shortDM(customRange.customFrom)} – ${shortDM(customRange.customTo)}`
              : 'Chọn ngày'}
          </span>
          {timeFilter === 'custom' && (
            <span
              role="button"
              aria-label="Bỏ lọc ngày"
              onClick={(e) => {
                e.stopPropagation();
                setTimeFilter('all');
                setCustomRange(null);
              }}
              style={{ display: 'inline-grid', placeItems: 'center' }}
            >
              <AppIcon name="x" size={12} />
            </span>
          )}
        </button>

        <div className="tk-search-box">
          <AppIcon name="search" size={13} style={{ color: 'var(--tk-text-mute)' }} />
          <input
            type="text"
            placeholder="Tìm việc, #nhãn, mô tả..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery(''); }}
          />
          {searchQuery && (
            <>
              <span className="tk-filter-pill__count" style={{ color: 'var(--tk-text-sub)', whiteSpace: 'nowrap' }}>
                {totalFiltered} kết quả
              </span>
              <button type="button" className="tk-icon-btn" onClick={() => setSearchQuery('')} aria-label="Xóa tìm kiếm">
                <AppIcon name="x" size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile: tab trạng thái thay cho 4 cột (ẩn trên desktop bằng CSS) */}
      <div className="tk-kanban-tabs" role="tablist">
        {columns.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={mobileCol === c.key}
            onClick={() => setMobileCol(c.key)}
            className={`tk-kanban-tab${mobileCol === c.key ? ' tk-kanban-tab--active' : ''}`}
            style={{ '--tab-c': colColors[c.key].dot }}
          >
            <span className="tk-col-header__dot" style={{ background: colColors[c.key].dot }} />
            {colColors[c.key].title}
            <span className="tk-filter-pill__count">{c.tasks.length}</span>
          </button>
        ))}
      </div>

      {/* Bảng Kanban 4 cột */}
      <div
        className="tk-kanban-board"
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          setTouchX(null);
          if (Math.abs(dx) < 60) return;
          const keys = columns.map((c) => c.key);
          const i = Math.max(0, Math.min(keys.length - 1, keys.indexOf(mobileCol) + (dx < 0 ? 1 : -1)));
          setMobileCol(keys[i]);
        }}
      >
        {columns.map((col) => {
          const isCollapsed = !isMobile && collapsedCols.has(col.key);
          if (isMobile && col.key !== mobileCol) return null;
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
                            background: 'var(--tk-accent-soft)',
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
                              background: 'var(--tk-border-soft)',
                              border: '1px solid var(--tk-border)',
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
                              border: '1px dashed var(--tk-border-strong)',
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
                              background: 'var(--tk-accent-soft)',
                              border: '1px solid var(--tk-accent-border)',
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
                              color: 'var(--tk-ks-late-fg)',
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
                            color: isDone ? 'var(--tk-text-done)' : 'var(--tk-text-main)',
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
                                background: 'var(--tk-border)',
                                overflow: 'hidden',
                                display: 'inline-block',
                              }}
                            >
                              <span
                                style={{
                                  display: 'block',
                                  height: '100%',
                                  width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                                  background: 'var(--tk-st-done)',
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
                            background: 'var(--tk-border-soft)',
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

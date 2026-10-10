import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTags } from '../hooks/useTags';
import LinkKBModal from './LinkKBModal';
import { StatusPopover, PriorityPopover, TaskDatePickerPopover, RecurrencePopover } from './TaskFloatingPopovers';
import TaskForm from './TaskForm';
import { SubtaskBadge } from './SubtaskList';
import { subtaskProgressByParent } from '../utils/subtaskUtils';
import { useConfirm } from './ConfirmModal';
import { toDateStr, formatDate } from '../utils/dateUtils';
import { PRIORITY_OPTIONS, WEEKDAYS, describeRecurrence } from '../utils/taskFields';
import { PRIORITY_LABELS, shiftDateDays } from '../utils/taskNlpParser';
import { matchTaskSearch } from '../utils/kanbanUtils';
import UI_STRINGS from '../data/ui-strings.json';
import AppIcon from './AppIcon';
import SkeletonList from './SkeletonList';
import '../styles/tasks.css';
import '../styles/tasks-aurora.css';

export default function TaskListSection({ taskModel, showForm, setShowForm, onSelectTask }) {
  const {
    todayTasks = [],
    overdueTasks = [],
    futureTasks = [],
    noDateTasks = [],
    skippedTasks = [],
    completeTask,
    uncompleteTask,
    updateTask,
    deleteTask,
    getCompletedTasksRange,
    isLoading,
    hasLoaded,
    tasks = [],
  } = taskModel;

  const { tags: allTags, addTag } = useTags();
  const { confirm, ConfirmModal } = useConfirm();
  const today = useMemo(() => toDateStr(), []);

  // fmtDMY an toàn múi giờ GMT+7 (đáp ứng testScreensContract)
  function _fmtDMY(d) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Popover nổi tại chỗ
  const [activePopover, setActivePopover] = useState(null); // { type, taskId, x, y, current... }

  // Mở rộng subtasks inline
  const [expandedSubtaskIds, setExpandedSubtaskIds] = useState(() => new Set());
  const [inlineSubInputs, setInlineSubInputs] = useState({});

  // Collapsible groups: { late: true, today: true, soon: true, done: false, skip: false }
  const [groupOpen, setGroupOpen] = useState({
    late: true,
    today: true,
    soon: true,
    none: true,
    done: false,
    skip: false,
  });

  const toggleGroup = (groupKey) => {
    setGroupOpen((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Completed tasks trong khoảng & lọc lại chuẩn múi giờ địa phương
  const [completedList, setCompletedList] = useState([]);
  useEffect(() => {
    if (!getCompletedTasksRange) return;
    let stale = false;
    // ponytail: chỉ 30 ngày gần nhất — xem lịch sử cũ hơn ở view Lịch/Tháng
    getCompletedTasksRange(shiftDateDays(-30, today), today).then((rows) => {
      if (stale) return;
      const filtered = (rows || []).filter((r) => {
        if (!r.completed_at) return false;
        const d = toDateStr(new Date(r.completed_at));
        return !!d;
      });
      setCompletedList(filtered);
    });
    return () => { stale = true; };
  }, [getCompletedTasksRange, today]);

  const handleComplete = useCallback(async (task) => {
    const completedAt = new Date().toISOString();
    setCompletedList((prev) => [{ ...task, completed: true, completed_at: completedAt }, ...prev]);
    await completeTask(task.id, completedAt);
  }, [completeTask]);

  // Tiến độ subtasks
  const subtaskProgress = useMemo(() => {
    return subtaskProgressByParent(tasks);
  }, [tasks]);

  const confirmDeleteTask = useCallback((task) => {
    const cfg = UI_STRINGS.confirm.deleteTask;
    return confirm({ ...cfg, message: cfg.message.replace('{name}', task.title) });
  }, [confirm]);

  const handleDeleteTask = useCallback(async (task) => {
    if (!(await confirmDeleteTask(task))) return;
    await deleteTask(task.id);
  }, [confirmDeleteTask, deleteTask]);

  // State bộ lọc thời gian: 'all' | 'today' | '7d' | 'late'
  const [timeFilter, setTimeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const in7Days = useMemo(() => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() + 7);
    return toDateStr(d);
  }, [today]);

  const subTitlesByParent = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t.parent_task_id) continue;
      map.set(t.parent_task_id, [...(map.get(t.parent_task_id) || []), t.title || '']);
    }
    return map;
  }, [tasks]);

  const matchesSearch = useCallback(
    (t) => matchTaskSearch(t, searchQuery, subTitlesByParent.get(t.id) || []),
    [searchQuery, subTitlesByParent]
  );

  // Đếm số lượng real-time cho 4 pills
  const filterCounts = useMemo(() => {
    let todayCount = 0;
    let next7dCount = 0;
    let lateCount = 0;

    for (const t of overdueTasks) {
      if (t.status !== 'skip') lateCount++;
    }
    for (const t of todayTasks) {
      if (t.status !== 'skip') {
        todayCount++;
        next7dCount++;
      }
    }
    for (const t of futureTasks) {
      if (t.status !== 'skip' && t.due_date && t.due_date <= in7Days) {
        next7dCount++;
      }
    }
    for (const t of completedList) {
      const compDate = t.completed_at ? toDateStr(new Date(t.completed_at)) : null;
      if (compDate === today) {
        todayCount++;
        next7dCount++;
      } else if (compDate && compDate > today && compDate <= in7Days) {
        next7dCount++;
      }
    }

    const totalOpen =
      overdueTasks.length + todayTasks.length + futureTasks.length + noDateTasks.length + skippedTasks.length;
    return {
      all: totalOpen + completedList.length,
      today: todayCount,
      '7d': next7dCount,
      late: lateCount,
    };
  }, [overdueTasks, todayTasks, futureTasks, noDateTasks, skippedTasks, completedList, today, in7Days]);

  // Lọc từng danh sách
  const filteredOverdue = useMemo(() => overdueTasks.filter(matchesSearch), [overdueTasks, matchesSearch]);
  const filteredToday = useMemo(() => todayTasks.filter(matchesSearch), [todayTasks, matchesSearch]);
  const filteredFuture = useMemo(() => {
    const list = futureTasks.filter(matchesSearch);
    if (timeFilter === '7d') return list.filter((t) => t.due_date && t.due_date <= in7Days);
    return list;
  }, [futureTasks, matchesSearch, timeFilter, in7Days]);
  const filteredNoDate = useMemo(() => {
    if (timeFilter !== 'all') return [];
    return noDateTasks.filter(matchesSearch);
  }, [noDateTasks, matchesSearch, timeFilter]);
  const filteredSkipped = useMemo(() => skippedTasks.filter(matchesSearch), [skippedTasks, matchesSearch]);
  const filteredCompleted = useMemo(() => {
    const list = completedList.filter(matchesSearch);
    if (timeFilter === 'today') {
      return list.filter((t) => t.completed_at && toDateStr(new Date(t.completed_at)) === today);
    }
    if (timeFilter === '7d') {
      return list.filter((t) => {
        const d = t.completed_at ? toDateStr(new Date(t.completed_at)) : null;
        return d && d >= today && d <= in7Days;
      });
    }
    if (timeFilter === 'late') return [];
    return list;
  }, [completedList, matchesSearch, timeFilter, today, in7Days]);

  // Gom các nhóm theo bộ lọc
  const allGroups = [
    {
      key: 'late',
      name: 'Quá hạn',
      color: 'var(--tk-ks-late-fg)',
      icon: 'warning',
      tasks: filteredOverdue,
      isOpen: groupOpen.late,
      visible: timeFilter === 'all' || timeFilter === 'late',
    },
    {
      key: 'today',
      name: 'Hôm nay',
      color: 'var(--tk-ks-today-fg)',
      icon: 'clock',
      tasks: filteredToday,
      isOpen: groupOpen.today,
      visible: timeFilter === 'all' || timeFilter === 'today' || timeFilter === '7d',
    },
    {
      key: 'soon',
      name: timeFilter === '7d' ? '7 ngày tới' : 'Sắp tới',
      color: 'var(--tk-ks-soon-fg)',
      icon: 'calendar',
      tasks: filteredFuture,
      isOpen: groupOpen.soon,
      visible: timeFilter === 'all' || timeFilter === '7d',
    },
    {
      key: 'none',
      name: 'Không hạn',
      color: 'var(--tk-ks-none-fg)',
      icon: 'tray',
      tasks: filteredNoDate,
      isOpen: groupOpen.none,
      visible: timeFilter === 'all',
    },
    {
      key: 'done',
      name: 'Đã hoàn thành',
      color: 'var(--tk-ks-done-fg)',
      icon: 'check-circle',
      tasks: filteredCompleted,
      isOpen: groupOpen.done,
      visible: timeFilter !== 'late',
    },
    {
      key: 'skip',
      name: 'Bỏ qua',
      color: 'var(--tk-ks-skip-fg)',
      icon: 'prohibit',
      tasks: filteredSkipped,
      isOpen: groupOpen.skip,
      visible: timeFilter === 'all',
    },
  ];

  const groups = allGroups.filter((g) => g.visible);
  const totalFiltered = useMemo(() => groups.reduce((acc, grp) => acc + grp.tasks.length, 0), [groups]);

  if (isLoading && !hasLoaded) {
    return <SkeletonList heading rows={5} gap="8px" label="Đang tải danh sách nhiệm vụ" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', boxSizing: 'border-box' }}>
      {ConfirmModal}

      {/* Floating Popovers tại chỗ */}
      {activePopover?.type === 'status' && (
        <StatusPopover
          currentStatus={activePopover.currentStatus}
          onSelect={(st) => {
            const task =
              [...overdueTasks, ...todayTasks, ...futureTasks, ...noDateTasks, ...skippedTasks, ...completedList].find(
                (t) => t.id === activePopover.taskId
              ) || { id: activePopover.taskId };
            if (st === 'done') handleComplete(task);
            else if (task.completed || activePopover.currentStatus === 'completed' || activePopover.currentStatus === 'done') {
              setCompletedList((prev) => prev.filter((t) => t.id !== task.id));
              uncompleteTask(task.id, st);
            } else updateTask(task.id, { status: st });
          }}
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
      {activePopover?.type === 'recurrence' && (
        <RecurrencePopover
          currentRule={activePopover.currentRule}
          onSelect={(rule) => updateTask(activePopover.taskId, { recurrence_rule: rule })}
          onClose={() => setActivePopover(null)}
          style={{ position: 'fixed', top: `${activePopover.y}px`, left: `${activePopover.x}px` }}
        />
      )}

      {/* Thanh công cụ: 4 pills thời gian & ô tìm kiếm từ khóa */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '4px',
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
                  background: isActive ? 'var(--tk-accent-soft)' : 'var(--tk-card-bg, rgba(14,19,36,0.6))',
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
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid var(--tk-border, rgba(255, 255, 255, 0.1))',
                background: 'var(--tk-card-bg, rgba(14, 19, 36, 0.6))',
                padding: '0 28px 0 30px',
                fontSize: '12px',
                color: 'var(--tk-text-main, #E8ECF7)',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--tk-text-mute, #8A93AD)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <AppIcon name="x" size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Form tạo mới khi bấm nút Thêm việc */}
      {showForm && (
        <div style={{ padding: '16px', borderRadius: '16px', background: 'var(--tk-card-bg)', border: '1px solid var(--tk-accent)' }}>
          <TaskForm
            allTags={allTags}
            addTag={addTag}
            onSubmit={async (fields, tagIds, subtaskTitles) => {
              const newTask = await taskModel.addTask({
                title: fields.title,
                description: fields.description,
                dueDate: fields.due_date,
                dueTime: fields.due_time,
                startDate: fields.start_date,
                startTime: fields.start_time,
                priority: fields.priority,
                recurrenceRule: fields.recurrence_rule,
              });
              if (newTask) {
                if (tagIds?.length && taskModel.linkTaskTag) {
                  // linkTaskTag cần object tag (dùng tag.id + tag.name cho optimistic _tags), không phải id
                  const selectedTags = (allTags || []).filter((tg) => tagIds.includes(tg.id));
                  await Promise.all(selectedTags.map((tg) => taskModel.linkTaskTag(newTask.id, tg)));
                }
                if (subtaskTitles?.length && taskModel.addSubtasks) {
                  await taskModel.addSubtasks(newTask, subtaskTitles);
                }
              }
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
            taskModel={taskModel}
          />
        </div>
      )}

      {/* 5 Nhóm danh sách theo tình trạng */}
      {groups.map((grp) => {
        if (grp.tasks.length === 0 && (grp.key === 'done' || grp.key === 'skip')) return null;

        return (
          <div key={grp.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Header nhóm collapsible */}
            <div
              onClick={() => toggleGroup(grp.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 4px 6px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <AppIcon name={grp.isOpen ? 'caretDown' : 'caretRight'} size={12} color="var(--tk-text-mute)" />
              <AppIcon name={grp.icon} size={15} color={grp.color} />
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14.5px', color: grp.color }}>
                {grp.name}
              </span>
              <span
                style={{
                  height: '20px',
                  minWidth: '20px',
                  padding: '0 7px',
                  borderRadius: '999px',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--tk-border-soft)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  color: 'var(--tk-text-sub)',
                }}
              >
                {grp.tasks.length}
              </span>
              <span style={{ flex: 1, height: '1px', background: 'var(--tk-border-soft)', marginLeft: '6px' }} />
            </div>

            {/* Danh sách task trong nhóm */}
            {grp.isOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {grp.tasks.map((task) => {
                  const isDone = task.status === 'completed' || task.status === 'done';
                  const isSkip = task.status === 'skip';
                  const isOverdue = !isDone && !isSkip && task.due_date && task.due_date < today;
                  const isToday = !isDone && !isSkip && task.due_date === today;
                  const isFuture = !isDone && !isSkip && task.due_date && task.due_date > today;

                  const glowColor = isOverdue
                    ? 'var(--tk-ks-late-fg)'
                    : isToday
                    ? 'var(--tk-ks-today-fg)'
                    : isFuture
                    ? 'var(--tk-ks-soon-fg)'
                    : isDone
                    ? 'var(--tk-st-done)'
                    : isSkip
                    ? 'var(--tk-st-skip)'
                    : 'var(--tk-text-mute)';

                  const tm = task.due_time ? ` · ${task.due_time.slice(0, 5)}` : '';
                  const daysLate = isOverdue
                    ? Math.round((new Date(`${today}T00:00:00`) - new Date(`${task.due_date}T00:00:00`)) / 864e5)
                    : 0;
                  const dueText = isOverdue
                    ? `Quá hạn · ${formatDate(task.due_date)}${tm}`
                    : isToday
                    ? `Hôm nay${tm}`
                    : task.due_date
                    ? `${formatDate(task.due_date)}${tm}`
                    : 'Đặt hạn';

                  const subs = tasks.filter((t) => t.parent_task_id === task.id);
                  const isExpandedSubs = expandedSubtaskIds.has(task.id);
                  const progress = subtaskProgress.get(task.id);

                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask?.(task)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        padding: '10px 14px 10px 16px',
                        borderRadius: '12px',
                        background: 'var(--tk-card-bg)',
                        border: '1px solid var(--tk-card-border)',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Dải viền phát sáng 2.5px */}
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: '2.5px',
                          background: glowColor,
                        }}
                      />

                      {/* Hàng nội dung chính */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* 1. Icon tròn trạng thái (Click đổi nhanh) */}
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
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: glowColor,
                            padding: 0,
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          <AppIcon name={isDone ? 'check-circle' : 'circle'} size={17} />
                        </button>

                        {/* 2. Tiêu đề task */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 600,
                              color: isDone ? 'var(--tk-text-done)' : 'var(--tk-text-main)',
                              textDecoration: isDone ? 'line-through' : 'none',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {task.title}
                          </span>
                          {task.description && (
                            <span
                              style={{
                                fontSize: '11.5px',
                                color: 'var(--tk-text-sub)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {task.description}
                            </span>
                          )}
                        </div>

                        {/* 3. Dãy badges bên phải */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                          {/* Subtasks badge */}
                          {progress && (
                            <span
                              onClick={() => {
                                setExpandedSubtaskIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(task.id)) next.delete(task.id);
                                  else next.add(task.id);
                                  return next;
                                });
                              }}
                              className="tk-badge-pill"
                              style={{ background: 'var(--tk-border-soft)', border: '1px solid var(--tk-border)', color: 'var(--tk-text-sub)' }}
                            >
                              <AppIcon name="listChecks" size={11} />
                              <span>{progress.done}/{progress.total}</span>
                            </span>
                          )}

                          {/* Tags */}
                          {(task._tags || []).map((tg) => (
                            <span key={tg.id} style={{ fontSize: '11.5px', color: 'var(--tk-accent)', fontWeight: 500 }}>
                              #{tg.name}
                            </span>
                          ))}

                          {/* Priority badge — chỉ hiện khi có ưu tiên; chưa có thì nút cờ nét đứt */}
                          {!task.priority && !isDone && !isSkip && (
                            <button
                              type="button"
                              title="Đặt ưu tiên"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActivePopover({ type: 'priority', taskId: task.id, currentPriority: 0, x: rect.left, y: rect.bottom + 4 });
                              }}
                              style={{
                                width: '22px',
                                height: '22px',
                                boxSizing: 'border-box',
                                borderRadius: '6px',
                                display: 'grid',
                                placeItems: 'center',
                                border: '1px dashed var(--tk-border-strong)',
                                color: 'var(--tk-text-mute)',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              <AppIcon name="flag" size={12} />
                            </button>
                          )}
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

                          {/* Due Date badge */}
                          <span
                            className="tk-badge-pill"
                            onClick={(e) => {
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
                              background: isOverdue ? 'var(--tk-ks-late-bg)' : isToday ? 'var(--tk-ks-today-bg)' : 'var(--tk-border-soft)',
                              border: `1px solid ${isOverdue ? 'var(--tk-ks-late-bd)' : isToday ? 'var(--tk-ks-today-bd)' : 'var(--tk-border)'}`,
                              color: isOverdue ? 'var(--tk-ks-late-fg)' : isToday ? 'var(--tk-ks-today-fg)' : 'var(--tk-text-sub)',
                            }}
                          >
                            <AppIcon name={isOverdue ? 'warning' : 'calendar'} size={11} />
                            {dueText}
                          </span>
                          {daysLate > 0 && (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--tk-ks-late-fg)' }}>
                              trễ {daysLate} ngày
                            </span>
                          )}

                          {/* Recurrence badge */}
                          {task.recurrence_rule && (
                            <span
                              className="tk-badge-pill"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActivePopover({
                                  type: 'recurrence',
                                  taskId: task.id,
                                  currentRule: task.recurrence_rule,
                                  x: rect.left,
                                  y: rect.bottom + 4,
                                });
                              }}
                              title={`Lặp lại: ${describeRecurrence(task.recurrence_rule)}`}
                              style={{
                                background: 'var(--tk-accent-soft)',
                                border: '1px solid rgba(94, 242, 194, 0.25)',
                                color: 'var(--tk-accent, #5EF2C2)',
                              }}
                            >
                              <AppIcon name="repeat" size={11} />
                              <span>{describeRecurrence(task.recurrence_rule)}</span>
                            </span>
                          )}

                          {/* Nút xóa nhanh */}
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task)}
                            style={{ background: 'none', border: 'none', color: 'var(--tk-text-mute)', cursor: 'pointer', padding: '4px' }}
                            title="Xóa việc"
                          >
                            <AppIcon name="trash" size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Expand subtasks inline dưới dòng task */}
                      {isExpandedSubs && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            marginLeft: '26px',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            background: 'var(--tk-border-soft)',
                            border: '1px solid var(--tk-border-soft)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            marginTop: '4px',
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
                                  taskModel?.addTask?.({ title: val, dueDate: task.due_date, parentTaskId: task.id });
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

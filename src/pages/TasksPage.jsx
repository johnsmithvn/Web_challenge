import { useState, lazy, Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import TaskListSection from '../components/TaskListSection';
import { useUserTasks } from '../hooks/useUserTasks';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTags } from '../hooks/useTags';
import TaskDetailDrawer from '../components/TaskDetailDrawer';
import TaskSubtaskModal from '../components/TaskSubtaskModal';
import TaskFilterBar from '../components/TaskFilterBar';
import TaskTodayStrip from '../components/TaskTodayStrip';
import TaskQuickAdd from '../components/TaskQuickAdd';
import TaskSkyBackground from '../components/TaskSkyBackground';
import { ElfStreakTree } from '../components/TaskElfDecor';
import { frameKey, celebrate } from '../utils/taskFlyersElf';
import { TaskDayPopover } from '../components/TaskFloatingPopovers';
import CalendarNavHead, { TaskViewSwitcher, MobileViewMenu } from '../components/CalendarToolbar';
import AppIcon from '../components/AppIcon';
import { toDateStr } from '../utils/dateUtils';
import { rescheduleTaskPatch } from '../utils/calendarTimeUtils';
import { calculateKanbanCounts, computeDoneStreak, getKanbanRange, matchTaskSearch } from '../utils/kanbanUtils';
import { parseTaskQuickText, shiftDateDays } from '../utils/taskNlpParser';
import { sortSubtasks } from '../utils/subtaskUtils';
import { solarToLunar, getCanChiYear, getCanChiDay, getNextGoodHour } from '../utils/lunarUtils';
import '../styles/tasks.css';
import '../styles/tasks-aurora.css';
import '../styles/tasks-elf.css';

const MonthCalendar = lazy(() => import('../components/MonthCalendar'));
const WeekCalendar = lazy(() => import('../components/WeekCalendar'));
const CalendarAgendaView = lazy(() => import('../components/CalendarAgendaView'));
const CalendarDayView = lazy(() => import('../components/CalendarDayView'));
const CalendarWidgetPanel = lazy(() => import('../components/CalendarWidgetPanel'));
const TaskKanbanView = lazy(() => import('../components/TaskKanbanView'));

const MOBILE_MQ = '(max-width: 768px)';
const DFULL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const DLOW = ['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'];

/**
 * TasksPage (/tasks) — bố cục theo mockup "Nhiệm vụ · Kanban tối & sáng":
 *   Desktop: header (tiêu đề + âm lịch + giờ tốt | 6 chế độ xem | Lịch & sự kiện) → dải "Hôm nay"
 *            → thanh lọc → nội dung; panel tiện ích & ngăn chi tiết nổi bên phải.
 *   Mobile : dòng ngày (bấm mở tiện ích) → menu chế độ xem + tìm + tiện ích → thanh lọc (Danh sách,
 *            Kanban) → nội dung; nút + mở sheet "Việc mới".
 */
export default function TasksPage() {
  const { user } = useAuth();
  const { taskStyle, theme } = useTheme();
  const elf = taskStyle === 'elf';
  const taskModel = useUserTasks();
  const { tags: allTags, addTag } = useTags();
  const {
    tasks,
    pendingTasks,
    skippedTasks,
    completedToday,
    getCompletedTasksRange,
    updateTask,
    addTask,
    linkTaskTag,
  } = taskModel;

  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.(MOBILE_MQ).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE_MQ);
    if (!mq) return undefined;
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Chế độ xem: 'kanban' | 'list' | 'agenda' | 'day' | 'week' | 'month'
  const [activeView, setActiveView] = useState(() => {
    // Mobile: mặc định Danh sách, không có view Tuần (quá chật) → chuyển sang Ngày
    const mobile = window.matchMedia?.(MOBILE_MQ).matches;
    const saved = localStorage.getItem('lh_tasks_active_view');
    if (mobile && saved === 'week') return 'day';
    return saved || (mobile ? 'list' : 'kanban');
  });
  const handleSetActiveView = useCallback((v) => {
    setActiveView(v);
    localStorage.setItem('lh_tasks_active_view', v);
  }, []);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [startOnSunday, setStartOnSunday] = useState(() => {
    const saved = localStorage.getItem('lh_cal_start_sun');
    return saved !== null ? saved === 'true' : true;
  });

  // Panel tiện ích (Lịch vạn niên & sự kiện): desktop rộng mở sẵn nếu chưa lưu; mobile luôn đóng khi vào
  const [isWidgetOpen, setIsWidgetOpen] = useState(() => {
    if (window.matchMedia?.(MOBILE_MQ).matches) return false;
    const saved = localStorage.getItem('lh_cal_widget_open');
    if (saved !== null) return saved === 'true';
    return window.innerWidth >= 1280;
  });
  const handleToggleWidget = useCallback(() => {
    setIsWidgetOpen((prev) => {
      const next = !prev;
      if (!window.matchMedia?.(MOBILE_MQ).matches) localStorage.setItem('lh_cal_widget_open', String(next));
      return next;
    });
  }, []);

  // Bật/tắt các loại ngày lễ (Việt Nam, Âm lịch, Quốc tế, Nhật Bản, Dev, Kỷ niệm)
  const [holidayToggles, setHolidayToggles] = useState(() => {
    const saved = localStorage.getItem('lh_cal_holiday_toggles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.international === undefined) parsed.international = true;
        if (parsed.custom === undefined) parsed.custom = true;
        return parsed;
      } catch {
        // dùng mặc định
      }
    }
    return { solar: true, lunar: true, international: true, japan: false, fun: true, custom: true };
  });
  const handleToggleHolidayType = useCallback((type) => {
    setHolidayToggles((prev) => {
      const next = { ...prev, [type]: !prev[type] };
      localStorage.setItem('lh_cal_holiday_toggles', JSON.stringify(next));
      return next;
    });
  }, []);

  // Ngày kỷ niệm cá nhân (lưu offline vào localStorage)
  const [customAnniversaries, setCustomAnniversaries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lh_custom_anniversaries') || '[]');
    } catch {
      return [];
    }
  });
  const handleAddCustomAnniversary = useCallback((item) => {
    setCustomAnniversaries((prev) => {
      const next = [item, ...prev];
      localStorage.setItem('lh_custom_anniversaries', JSON.stringify(next));
      return next;
    });
  }, []);
  const handleDeleteCustomAnniversary = useCallback((id) => {
    setCustomAnniversaries((prev) => {
      const next = prev.filter((it) => it.id !== id);
      localStorage.setItem('lh_custom_anniversaries', JSON.stringify(next));
      return next;
    });
  }, []);

  // Ngăn chi tiết & hộp việc con
  const [selectedTask, setSelectedTask] = useState(null);
  const [subView, setSubView] = useState(null); // { parentId, subId }

  // Các view Lịch tự tải task đã xong theo khoảng ngày → tăng key sau mỗi thao tác để tải lại
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  // Số liệu Tuần/Tháng báo lên cho phụ đề hàng điều hướng: { view, text }
  const [calStats, setCalStats] = useState(null);
  const refreshCalendars = useCallback(() => setCalendarRefreshKey((k) => k + 1), []);

  const handleRescheduleTask = useCallback(async (taskId, dateStr, timeStr) => {
    const task = tasks.find((t) => String(t.id) === String(taskId));
    if (!task || task.completed) return;
    const patch = rescheduleTaskPatch(task, dateStr, timeStr);
    if (!patch) return;
    await updateTask(task.id, patch);
    refreshCalendars();
  }, [tasks, updateTask, refreshCalendars]);

  const handleCloseSelectedModal = useCallback(() => {
    setSelectedTask(null);
    refreshCalendars();
  }, [refreshCalendars]);

  // Tạo việc: sheet "Việc mới" (gõ nhanh) → "Chi tiết" mở ngăn chi tiết ở chế độ tạo mới (bản nháp)
  const [draft, setDraft] = useState(null); // { key, status, title, due_date, due_time, priority, tags }
  const [quickAdd, setQuickAdd] = useState(null); // { status }

  // Mở 1 việc thì bỏ bản nháp đang soạn (như mockup)
  const handleSelectTaskFromCalendar = useCallback((task) => {
    setDraft(null);
    setSelectedTask(task);
  }, []);

  // parsed = kết quả parseTaskQuickText của chữ đã gõ (điền sẵn tên, hạn, giờ, ưu tiên, nhãn)
  const openDraft = useCallback((status = 'todo', parsed = null) => {
    setQuickAdd(null);
    setSelectedTask(null);
    setDraft({ key: Date.now(), status, ...(parsed || {}) });
  }, []);
  const closeDraft = useCallback(() => {
    setDraft(null);
    refreshCalendars();
  }, [refreshCalendars]);

  // Popover "Ngày" (nút + / "+N nữa" ở Tháng, Thêm việc ở Lịch biểu, bấm lưới giờ ở Ngày/Tuần)
  const [dayPop, setDayPop] = useState(null); // { dateStr, time, holidays, x, y }
  const openDayPop = useCallback((dateStr, e, holidays = [], time = null) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    // Bấm lưới giờ: neo tại điểm bấm; bấm nút: neo ngay dưới nút
    setDayPop({ dateStr, time, holidays, x: time ? e.clientX : r.left, y: time ? e.clientY : r.bottom + 6 });
  }, []);

  const today = toDateStr();

  // Gõ nhanh "mai 9h !cao #UI" → tạo việc + gắn nhãn (sheet Việc mới, ô thêm đầu cột Kanban, popover Ngày).
  // day = { date, time } khi gõ trong popover Ngày: "9h"/"mai" tính theo ngày đó, không ghi hạn thì lấy ngày/giờ đó.
  const createFromQuickText = useCallback(async (raw, status = 'todo', day = null) => {
    const p = parseTaskQuickText(raw, day?.date || toDateStr());
    if (!p.title) return null;
    const done = status === 'done';
    const created = await addTask({
      title: p.title,
      dueDate: p.due_date || day?.date || null,
      dueTime: p.due_time || (p.due_date ? null : day?.time) || null,
      priority: p.priority,
      status,
      completed: done,
      completedAt: done ? new Date().toISOString() : null,
    });
    if (created?.id && p.tags.length && linkTaskTag && addTag) {
      for (const name of p.tags) {
        const tag = (allTags || []).find((t) => t.name.toLowerCase() === name.toLowerCase()) || (await addTag(name));
        if (tag?.id) await linkTaskTag(created.id, tag);
      }
    }
    refreshCalendars();
    return created;
  }, [addTask, linkTaskTag, addTag, allTags, refreshCalendars]);

  // ── Lọc & tìm kiếm dùng chung (Danh sách, Kanban; desktop cả các view Lịch) ──
  const [timeFilter, setTimeFilter] = useState('all');
  const [customRange, setCustomRange] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Việc xong 30 ngày gần nhất: số đếm "Tất cả" + cột Hoàn thành của Kanban
  const [recentDone, setRecentDone] = useState([]);
  useEffect(() => {
    if (!getCompletedTasksRange || !user) return undefined;
    let stale = false;
    getCompletedTasksRange(shiftDateDays(-30, today), today).then((rows) => {
      if (!stale) setRecentDone(rows || []);
    });
    return () => { stale = true; };
  }, [getCompletedTasksRange, user, today, calendarRefreshKey]);

  // Rừng tiên — chuỗi ngày làm xong hết việc (cây góc trái dưới): việc có hạn 60 ngày qua theo ngày kế hoạch
  const [planDone, setPlanDone] = useState([]);
  useEffect(() => {
    if (!elf || !getCompletedTasksRange || !user) return undefined;
    let stale = false;
    getCompletedTasksRange(shiftDateDays(-60, today), today, { byPlan: true }).then((rows) => {
      if (!stale) setPlanDone(rows || []);
    });
    return () => { stale = true; };
  }, [elf, getCompletedTasksRange, user, today, calendarRefreshKey]);
  const streak = useMemo(() => {
    const all = new Map();
    for (const t of [...planDone, ...tasks]) {
      if (t.parent_task_id || t.status === 'skip') continue;
      all.set(t.id, { due_date: t.due_date, done: !!t.completed });
    }
    return computeDoneStreak([...all.values()], today);
  }, [planDone, tasks, today]);

  // Rừng tiên — vừa đánh dấu xong 1 việc thì đom đóm bay lên; xong hết việc hôm nay thì ăn mừng lớn
  const openIdsRef = useRef(null);
  useEffect(() => {
    const top = tasks.filter((t) => !t.parent_task_id);
    const prevOpen = openIdsRef.current;
    openIdsRef.current = new Set(top.filter((t) => !t.completed).map((t) => t.id));
    if (!elf || !prevOpen) return;
    const justDone = top.some((t) => t.completed && prevOpen.has(t.id));
    if (!justDone) return;
    const dueToday = top.filter((t) => t.due_date === today && t.status !== 'skip');
    celebrate(frameKey(theme, isMobile), dueToday.length > 0 && dueToday.every((t) => t.completed));
  }, [tasks, elf, theme, isMobile, today]);

  // Ngắm cảnh: ẩn toàn bộ giao diện để xem nền; thoát ra thì hiện lại dần
  const [scene, setScene] = useState('off'); // 'off' | 'on' | 'back'
  useEffect(() => {
    if (scene !== 'back') return undefined;
    const t = setTimeout(() => setScene('off'), 500);
    return () => clearTimeout(t);
  }, [scene]);
  const toggleScene = () => setScene((v) => (v === 'on' ? 'back' : 'on'));

  const subtasksByParent = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t.parent_task_id) continue;
      map.set(t.parent_task_id, [...(map.get(t.parent_task_id) || []), t.title || '']);
    }
    return map;
  }, [tasks]);

  const filterCounts = useMemo(() => {
    const openIds = new Set([...pendingTasks, ...skippedTasks].map((t) => t.id));
    const done = new Map(recentDone.map((t) => [t.id, t]));
    for (const t of completedToday || []) done.set(t.id, t);
    return calculateKanbanCounts({
      pendingTasks,
      skippedTasks,
      completedToday: completedToday || [],
      completedRecent: [...done.values()].filter((t) => !openIds.has(t.id)),
      today,
      searchQuery,
      subtasksByParent,
    });
  }, [pendingTasks, skippedTasks, completedToday, recentDone, today, searchQuery, subtasksByParent]);

  // Desktop: các view Lịch cũng theo bộ lọc + tìm kiếm; mobile bỏ qua bộ lọc thời gian ở view Lịch (mockup)
  const calendarPending = useMemo(() => {
    if (isMobile) return pendingTasks;
    const range = getKanbanRange(timeFilter, today, customRange);
    return pendingTasks.filter((t) => {
      if (!matchTaskSearch(t, searchQuery, subtasksByParent.get(t.id) || [])) return false;
      if (!range) return true;
      return !!t.due_date && t.due_date >= range.from && t.due_date <= range.to;
    });
  }, [isMobile, pendingTasks, timeFilter, today, customRange, searchQuery, subtasksByParent]);

  const searchResultCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    return [...pendingTasks, ...skippedTasks].filter((t) => matchTaskSearch(t, searchQuery, subtasksByParent.get(t.id) || [])).length;
  }, [pendingTasks, skippedTasks, searchQuery, subtasksByParent]);

  // ── Header: "Chiều thứ Bảy, 10/10" + âm lịch + giờ tốt kế tiếp (cập nhật mỗi phút) ──
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const hourNow = now.getHours();
  const dayPart = hourNow < 11 ? 'Sáng' : hourNow < 13 ? 'Trưa' : hourNow < 18 ? 'Chiều' : 'Tối';
  const lunarNow = solarToLunar(now.getDate(), now.getMonth() + 1, now.getFullYear());
  const lunarText = (d, l) => `Âm ${l.day}/${l.month} ${getCanChiYear(l.year)}, ngày ${getCanChiDay(d.getDate(), d.getMonth() + 1, d.getFullYear()).full}`;
  const goodHour = getNextGoodHour(now);
  const goodHourLabel = !goodHour
    ? null
    : goodHour.isNow
    ? `Đang giờ tốt: ${goodHour.name} ${goodHour.range.replace('-', '–')}`
    : `Giờ tốt kế tiếp: ${goodHour.name} ${goodHour.range.replace('-', '–')}`;

  const viewDate = currentDate || now;
  const viewLunar = solarToLunar(viewDate.getDate(), viewDate.getMonth() + 1, viewDate.getFullYear());
  const viewIsToday = toDateStr(viewDate) === today;
  const shiftViewDay = (n) => setCurrentDate((d) => {
    const next = new Date(d || new Date());
    next.setDate(next.getDate() + n);
    return next;
  });

  // Sự kiện → việc: bỏ emoji đầu tên; đã có việc cùng tên + cùng ngày thì coi như đã thêm.
  const eventTaskTitle = (ev) => (ev.title || '').replace(/^[^a-zA-Z0-9À-ỹ]+/u, '').trim() || ev.title;
  const isEventTaskAdded = (ev) => {
    const title = eventTaskTitle(ev);
    const due = toDateStr(ev.targetDate || new Date());
    return tasks.some((t) => t.title === title && t.due_date === due);
  };

  // Hộp việc con mở từ thẻ (Kanban/Danh sách): danh sách lấy từ state
  const subList = useMemo(() => {
    if (!subView) return [];
    return sortSubtasks(tasks.filter((t) => t.parent_task_id === subView.parentId));
  }, [subView, tasks]);
  const subIndex = subView ? subList.findIndex((s) => s.id === subView.subId) : -1;
  const subParent = subView ? tasks.find((t) => t.id === subView.parentId) : null;
  const handleOpenSubtask = useCallback((parent, sub) => setSubView({ parentId: parent.id, subId: sub.id }), []);

  const isListLike = activeView === 'list' || activeView === 'kanban';
  const isCalendarView = !isListLike;
  const selectedId = selectedTask?.id;

  const filterProps = { timeFilter, customRange, searchQuery };
  const filterBar = (isListLike || !isMobile) && (
    <TaskFilterBar
      filter={timeFilter}
      onFilter={setTimeFilter}
      range={customRange}
      onRange={setCustomRange}
      search={searchQuery}
      onSearch={setSearchQuery}
      counts={filterCounts}
      resultCount={searchResultCount}
    />
  );

  const calendarView = (
    <Suspense fallback={<div className="tk-loading">Đang tải…</div>}>
      {activeView === 'agenda' && (
        <CalendarAgendaView
          onRescheduleTask={handleRescheduleTask}
          updateTask={async (id, patch) => { await updateTask(id, patch); refreshCalendars(); }}
          pendingTasks={calendarPending}
          allTasks={tasks}
          onMoveAllLateToToday={async (late) => {
            await Promise.all(late.map((t) => updateTask(t.id, { due_date: toDateStr() })));
            refreshCalendars();
          }}
          getCompletedTasksRange={getCompletedTasksRange}
          onSelectTask={handleSelectTaskFromCalendar}
          onOpenDay={openDayPop}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          isMobile={isMobile}
          holidayToggles={holidayToggles}
          customAnniversaries={customAnniversaries}
          refreshKey={calendarRefreshKey}
        />
      )}
      {activeView === 'day' && (
        <CalendarDayView
          onRescheduleTask={handleRescheduleTask}
          isMobile={isMobile}
          pendingTasks={calendarPending}
          getCompletedTasksRange={getCompletedTasksRange}
          onSelectTask={handleSelectTaskFromCalendar}
          onOpenDay={openDayPop}
          currentDate={currentDate}
          holidayToggles={holidayToggles}
          customAnniversaries={customAnniversaries}
          refreshKey={calendarRefreshKey}
        />
      )}
      {activeView === 'week' && (
        <WeekCalendar
          onRescheduleTask={handleRescheduleTask}
          pendingTasks={calendarPending}
          getCompletedTasksRange={getCompletedTasksRange}
          onSelectTask={handleSelectTaskFromCalendar}
          onOpenDay={openDayPop}
          currentDate={currentDate}
          startOnSunday={startOnSunday}
          holidayToggles={holidayToggles}
          customAnniversaries={customAnniversaries}
          refreshKey={calendarRefreshKey}
          onStats={setCalStats}
        />
      )}
      {activeView === 'month' && (
        <MonthCalendar
          onRescheduleTask={handleRescheduleTask}
          getCompletedTasksRange={getCompletedTasksRange}
          pendingTasks={calendarPending}
          onSelectTask={handleSelectTaskFromCalendar}
          onOpenDay={openDayPop}
          isMobile={isMobile}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          startOnSunday={startOnSunday}
          holidayToggles={holidayToggles}
          customAnniversaries={customAnniversaries}
          refreshKey={calendarRefreshKey}
          onStats={setCalStats}
        />
      )}
    </Suspense>
  );

  return (
    <div
      className={[
        'tasks-workspace',
        `tasks-workspace--${activeView}`,
        elf ? 'tk-elf' : '',
        scene === 'on' ? 'is-scene' : scene === 'back' ? 'is-scene-back' : '',
        isWidgetOpen ? 'has-util' : '',
        selectedTask || draft ? 'has-peek' : '',
      ].filter(Boolean).join(' ')}
      data-frame={elf ? frameKey(theme, isMobile) : undefined}
    >
      <TaskSkyBackground isMobile={isMobile} />
      <button
        type="button"
        className={`tk-scene-btn${isMobile ? ' is-m' : ''}`}
        title={scene === 'on' ? 'Hiện giao diện' : isMobile ? (elf ? 'Ngắm rừng' : 'Ngắm cảnh') : 'Ẩn/hiện giao diện'}
        onClick={toggleScene}
      >
        <AppIcon name={scene === 'on' ? 'eyeOff' : 'eye'} size={isMobile ? 19 : 12} />
        {!isMobile && (scene === 'on' ? 'Hiện giao diện' : elf ? 'Ngắm rừng' : 'Ngắm cảnh')}
      </button>
      {elf && !isMobile && <ElfStreakTree streak={streak} />}

      {/* ── Header desktop ── */}
      <header className="tk-header tk-desktop-only">
        <div className="tk-header__info">
          <h1 className="tk-header__title">
            {dayPart} {DLOW[now.getDay()]}, {now.getDate()}/{now.getMonth() + 1}
          </h1>
          <div className="tk-header__chips">
            <span className="tk-chip">
              <AppIcon name="moon" size={13} style={{ color: 'var(--tk-chip-moon)' }} />
              {lunarText(now, lunarNow)}
            </span>
            {goodHourLabel && (
              <span className="tk-chip">
                <AppIcon name="sunHorizon" size={13} style={{ color: 'var(--tk-chip-sun)' }} />
                {goodHourLabel}
              </span>
            )}
          </div>
        </div>
        <TaskViewSwitcher activeView={activeView} setActiveView={handleSetActiveView} setCurrentDate={setCurrentDate} />
        {user && (
          <button type="button" className="tk-new-btn" onClick={() => openDraft('todo')} title="Tạo việc mới với đầy đủ chi tiết" aria-label="Việc mới">
            <AppIcon name="plus" size={14} weight="bold" />
            <span className="tk-new-btn__label">Việc mới</span>
          </button>
        )}
        <button
          type="button"
          className={`tk-util-btn${isWidgetOpen ? ' is-on' : ''}`}
          onClick={handleToggleWidget}
          title="Lịch vạn niên và sự kiện"
          aria-label="Lịch và sự kiện"
        >
          <AppIcon name="moonStars" size={16} />
          <span className="tk-new-btn__label">Lịch &amp; sự kiện</span>
        </button>
      </header>

      {/* ── Header mobile ── */}
      <div className="tk-mhead tk-mobile-only">
        {activeView === 'day' ? (
          <div className="tk-mhead__day">
            <button type="button" className="tk-mhead__date" onClick={handleToggleWidget}>
              <span className="tk-mhead__date-title">
                {DFULL[viewDate.getDay()]} {viewDate.getDate()}/{viewDate.getMonth() + 1}/{viewDate.getFullYear()}
              </span>
              <span className="tk-mhead__date-lunar">
                <AppIcon name="moon" size={13} style={{ color: 'var(--tk-accent)', flex: 'none' }} />
                <span>
                  {lunarText(viewDate, viewLunar)}
                </span>
              </span>
            </button>
            {!viewIsToday && (
              <button type="button" className="tk-mhead__today" onClick={() => setCurrentDate(new Date())}>
                Hôm nay
              </button>
            )}
            <button type="button" className="tk-mhead__arrow" onClick={() => shiftViewDay(-1)} aria-label="Ngày trước">
              <AppIcon name="caretLeft" size={17} />
            </button>
            <button type="button" className="tk-mhead__arrow" onClick={() => shiftViewDay(1)} aria-label="Ngày sau">
              <AppIcon name="caretRight" size={17} />
            </button>
          </div>
        ) : (
          <button type="button" className="tk-mhead__date" onClick={handleToggleWidget}>
            <span className="tk-mhead__date-title">
              {DFULL[now.getDay()]} {now.getDate()}/{now.getMonth() + 1}/{now.getFullYear()}
            </span>
            <span className="tk-mhead__date-lunar">
              <AppIcon name="moon" size={13} style={{ color: 'var(--tk-accent)', flex: 'none' }} />
              <span>
                {lunarText(now, lunarNow)}
              </span>
            </span>
          </button>
        )}
        <div className="tk-mhead__bar">
          <MobileViewMenu activeView={activeView} setActiveView={handleSetActiveView} />
          <span className="tk-mhead__spacer" />
          <button
            type="button"
            className={`tk-mhead__icon${mobileSearchOpen || searchQuery ? ' is-on' : ''}`}
            onClick={() => setMobileSearchOpen((o) => !o)}
            aria-label="Tìm kiếm"
          >
            <AppIcon name="search" size={20} />
          </button>
          <button type="button" className="tk-mhead__icon" onClick={handleToggleWidget} aria-label="Lịch vạn niên và sự kiện">
            <AppIcon name="moonStars" size={20} />
          </button>
        </div>
        {(mobileSearchOpen || searchQuery) && (
          <label className="tk-msearch">
            <AppIcon name="search" size={16} style={{ color: 'var(--tk-text-sub)', flex: 'none' }} />
            <input
              autoFocus
              value={searchQuery}
              placeholder="Tìm việc, mô tả, #nhãn"
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  setMobileSearchOpen(false);
                }
              }}
            />
            {searchQuery.trim() && <span className="tk-msearch__count">{searchResultCount} kết quả</span>}
            <button
              type="button"
              className="tk-msearch__close"
              aria-label="Đóng tìm kiếm"
              onClick={() => {
                setSearchQuery('');
                setMobileSearchOpen(false);
              }}
            >
              <AppIcon name="x" size={14} />
            </button>
          </label>
        )}
      </div>

      {/* ── Nội dung ── */}
      <div className="tk-main">
        {user && <TaskTodayStrip tasks={pendingTasks} today={today} onOpen={handleSelectTaskFromCalendar} />}
        {filterBar}

        <div className="tk-content">
          {activeView === 'list' && (
            <TaskListSection
              taskModel={taskModel}
              onSelectTask={handleSelectTaskFromCalendar}
              onOpenSubtask={handleOpenSubtask}
              selectedId={selectedId}
              isMobile={isMobile}
              {...filterProps}
            />
          )}

          {activeView === 'kanban' && (user ? (
            <Suspense fallback={<div className="tk-loading">Đang tải…</div>}>
              <TaskKanbanView
                taskModel={taskModel}
                onSelectTask={handleSelectTaskFromCalendar}
                onOpenSubtask={handleOpenSubtask}
                onQuickText={createFromQuickText}
                onQuickAdd={(status) => setQuickAdd({ status })}
                onOpenFullForm={openDraft}
                refreshKey={calendarRefreshKey}
                recentDone={recentDone}
                selectedId={selectedId}
                isMobile={isMobile}
                {...filterProps}
              />
            </Suspense>
          ) : (
            <div className="tk-empty-state">Đăng nhập để xem bảng Kanban.</div>
          ))}

          {isCalendarView && (user ? (
            <section className={`tk-cal-panel tk-cal-panel--${activeView}`}>
              {/* Lịch biểu tự vẽ hàng điều hướng (nhãn cần số việc & khoảng ngày đang xem) */}
              {activeView !== 'agenda' && (
                <CalendarNavHead
                  activeView={activeView}
                  currentDate={currentDate}
                  setCurrentDate={setCurrentDate}
                  startOnSunday={startOnSunday}
                  setStartOnSunday={setStartOnSunday}
                  extra={calStats?.view === activeView ? calStats.text : ''}
                />
              )}
              <div className="tk-cal-panel__body">{calendarView}</div>
            </section>
          ) : (
            <div className="tk-empty-state">Đăng nhập để xem lịch nhiệm vụ.</div>
          ))}
        </div>
      </div>

      {/* Panel Lịch vạn niên & sự kiện (desktop nổi bên phải, mobile là sheet) */}
      <Suspense fallback={null}>
        <CalendarWidgetPanel
          isOpen={isWidgetOpen}
          tasks={pendingTasks}
          onClose={handleToggleWidget}
          holidayToggles={holidayToggles}
          onToggleHolidayType={handleToggleHolidayType}
          customAnniversaries={customAnniversaries}
          onAddCustomAnniversary={handleAddCustomAnniversary}
          onDeleteCustomAnniversary={handleDeleteCustomAnniversary}
          isEventTaskAdded={isEventTaskAdded}
          onCreateTaskFromEvent={async (ev) => {
            if (isEventTaskAdded(ev)) return;
            await addTask({
              title: eventTaskTitle(ev),
              dueDate: toDateStr(ev.targetDate || new Date()),
              priority: 0,
              status: 'todo',
            });
            refreshCalendars();
          }}
          onSelectEventDate={(targetDate) => {
            setCurrentDate(targetDate);
            handleSetActiveView('day');
            if (window.matchMedia?.(MOBILE_MQ).matches) setIsWidgetOpen(false);
          }}
        />
      </Suspense>
      {isWidgetOpen && <div className="tk-util-scrim tk-mobile-only" onClick={handleToggleWidget} />}

      {/* Ngăn chi tiết (nổi bên phải desktop / sheet mobile); bản nháp = cùng ngăn ở chế độ tạo mới */}
      {draft ? (
        <TaskDetailDrawer key={`draft-${draft.key}`} draft={draft} taskModel={taskModel} onClose={closeDraft} />
      ) : selectedTask && (
        <TaskDetailDrawer
          key={selectedTask.id}
          task={tasks.find((t) => t.id === selectedTask.id) || selectedTask}
          taskModel={taskModel}
          onClose={handleCloseSelectedModal}
        />
      )}

      {subView && subParent && subIndex >= 0 && (
        <TaskSubtaskModal
          parent={subParent}
          subtasks={subList}
          index={subIndex}
          onIndex={(i) => setSubView({ parentId: subView.parentId, subId: subList[i].id })}
          onClose={() => setSubView(null)}
          onOpenParent={() => {
            setSubView(null);
            handleSelectTaskFromCalendar(subParent);
          }}
          taskModel={taskModel}
        />
      )}

      {dayPop && (
        <TaskDayPopover
          key={`${dayPop.dateStr}-${dayPop.time}`}
          dateStr={dayPop.dateStr}
          time={dayPop.time}
          holidays={dayPop.holidays}
          tasks={tasks
            .filter((t) => !t.parent_task_id && t.due_date === dayPop.dateStr)
            .sort((a, b) => (a.due_time || '99').localeCompare(b.due_time || '99'))}
          onOpenTask={(t) => {
            setDayPop(null);
            handleSelectTaskFromCalendar(t);
          }}
          onCreate={(raw) => createFromQuickText(raw, 'todo', { date: dayPop.dateStr, time: dayPop.time })}
          onClose={() => setDayPop(null)}
          style={{ position: 'fixed', left: `${dayPop.x}px`, top: `${dayPop.y}px` }}
        />
      )}

      {/* Nút + và sheet "Việc mới" */}
      {user && !selectedTask && !draft && !quickAdd && (
        <button type="button" className="tk-fab" onClick={() => setQuickAdd({ status: 'todo' })} aria-label="Thêm việc mới">
          <AppIcon name="plus" size={24} />
        </button>
      )}
      <TaskQuickAdd
        open={!!quickAdd}
        status={quickAdd?.status || 'todo'}
        today={today}
        onClose={() => setQuickAdd(null)}
        onCreate={createFromQuickText}
        onOpenFullForm={(parsed, status) => openDraft(status, parsed)}
      />
    </div>
  );
}

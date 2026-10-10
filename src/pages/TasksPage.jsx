import { useState, lazy, Suspense, useCallback, useEffect } from 'react';
import TaskListSection from '../components/TaskListSection';
import { useUserTasks } from '../hooks/useUserTasks';
import { useAuth } from '../contexts/AuthContext';
import TaskDetailDrawer from '../components/TaskDetailDrawer';
import TaskCreateModal from '../components/TaskCreateModal';
import TaskForm from '../components/TaskForm';
import CalendarToolbar from '../components/CalendarToolbar';
import AppIcon from '../components/AppIcon';
import { toDateStr } from '../utils/dateUtils';
import { rescheduleTaskPatch } from '../utils/calendarTimeUtils';
import { solarToLunar, getCanChiYear, getCanChiDay, getNextGoodHour } from '../utils/lunarUtils';
import '../styles/tasks.css';
import '../styles/calendar-widget.css';
import '../styles/week-calendar.css';
import '../styles/tasks-aurora.css';

const MonthCalendar = lazy(() => import('../components/MonthCalendar'));
const WeekCalendar = lazy(() => import('../components/WeekCalendar'));
const CalendarAgendaView = lazy(() => import('../components/CalendarAgendaView'));
const CalendarDayView = lazy(() => import('../components/CalendarDayView'));
const CalendarWidgetPanel = lazy(() => import('../components/CalendarWidgetPanel'));
const TaskKanbanView = lazy(() => import('../components/TaskKanbanView'));

/**
 * TasksPage (/tasks) — Trung tâm Quản lý Nhiệm vụ & Lịch Công việc (v6.13.0).
 *
 * 5 chế độ xem linh hoạt trên thanh All-in-one Header Switcher:
 * - **Danh sách**: Phân loại việc Quá hạn / Hôm nay / Sắp tới
 * - **Lịch biểu (Agenda)**: Dòng sự kiện liên tục theo ngày cuốn chiếu (kèm ngày lễ & task)
 * - **Ngày**: Timeline 24h chi tiết 1 ngày
 * - **Tuần**: Grid 7 ngày với vạch đỏ thời gian thực và chia cột chống đè
 * - **Tháng**: Lịch tháng 100vh chuẩn Google Calendar
 *
 * Tiện ích bên phải (Collapsible Widget Panel):
 * - Lịch vạn niên (Dương - Âm - Can Chi Năm/Tháng/Ngày)
 * - Giờ Hoàng Đạo 12 con giáp
 * - Đếm ngược ngày lễ lớn & sự kiện quan trọng
 */
export default function TasksPage() {
  const { user } = useAuth();
  const taskModel = useUserTasks();
  const {
    todayTasks,
    overdueTasks,
    futureTasks,
    pendingTasks,
    getCompletedTasksRange,
    deleteTask,
    updateTask,
  } = taskModel;

  // Chế độ xem: 'kanban' | 'list' | 'agenda' | 'day' | 'week' | 'month'
  const [activeView, setActiveView] = useState(() => {
    // Mobile: mặc định Danh sách, không có view Tuần (quá chật) → chuyển sang Ngày
    const isMobile = window.matchMedia?.('(max-width: 640px)').matches;
    const saved = localStorage.getItem('lh_tasks_active_view');
    if (isMobile && saved === 'week') return 'day';
    return saved || (isMobile ? 'list' : 'kanban');
  });

  const handleSetActiveView = useCallback((v) => {
    setActiveView(v);
    localStorage.setItem('lh_tasks_active_view', v);
  }, []);

  const [showForm, setShowForm] = useState(false);

  // State ngày neo và tùy chọn đầu tuần
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [startOnSunday, setStartOnSunday] = useState(() => {
    const saved = localStorage.getItem('lh_cal_start_sun');
    return saved !== null ? saved === 'true' : true;
  });

  // State đóng/mở panel tiện ích bên phải (mặc định mở trên desktop nếu chưa lưu)
  const [isWidgetOpen, setIsWidgetOpen] = useState(() => {
    const saved = localStorage.getItem('lh_cal_widget_open');
    if (saved !== null) return saved === 'true';
    return typeof window !== 'undefined' ? window.innerWidth >= 1200 : true;
  });

  const handleToggleWidget = useCallback(() => {
    setIsWidgetOpen((prev) => {
      const next = !prev;
      localStorage.setItem('lh_cal_widget_open', String(next));
      return next;
    });
  }, []);

  // State bật/tắt các loại ngày lễ (Việt Nam, Âm lịch, Quốc tế, Nhật Bản, Dev, Kỷ niệm)
  const [holidayToggles, setHolidayToggles] = useState(() => {
    const saved = localStorage.getItem('lh_cal_holiday_toggles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.international === undefined) parsed.international = true;
        if (parsed.custom === undefined) parsed.custom = true;
        return parsed;
      } catch {
        // Safe fallback
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

  // State danh sách ngày kỷ niệm cá nhân (lưu offline vào localStorage)
  const [customAnniversaries, setCustomAnniversaries] = useState(() => {
    const saved = localStorage.getItem('lh_custom_anniversaries');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Safe fallback
      }
    }
    return [];
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

  // State xem chi tiết task (hiển thị qua TaskDetailDrawer)
  const [selectedTask, setSelectedTask] = useState(null);

  // Các view Lịch tự tải task đã xong 1 lần theo khoảng ngày → tăng key sau mỗi
  // thao tác để chúng tải lại (không thì task vừa hoàn thành biến mất khỏi lịch).
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const refreshCalendars = useCallback(() => setCalendarRefreshKey((k) => k + 1), []);

  // Kéo thả trên Lịch: timeStr undefined = giữ giờ, null = cả ngày, "HH:MM" = đặt giờ
  const handleRescheduleTask = useCallback(async (taskId, dateStr, timeStr) => {
    const task = taskModel.tasks.find((t) => String(t.id) === String(taskId));
    if (!task || task.completed) return;
    const patch = rescheduleTaskPatch(task, dateStr, timeStr);
    if (!patch) return;
    await updateTask(task.id, patch);
    refreshCalendars();
  }, [taskModel.tasks, updateTask, refreshCalendars]);

  // Đóng Drawer luôn làm mới Lịch: trong drawer có thể đã tick/thêm task con.
  const handleCloseSelectedModal = useCallback(() => {
    setSelectedTask(null);
    refreshCalendars();
  }, [refreshCalendars]);

  // State mở Modal tạo Task
  const [createModalState, setCreateModalState] = useState(null); // { date: string, time: string }

  const due = overdueTasks.length + todayTasks.length;

  const handleSelectTaskFromCalendar = useCallback((task) => {
    setSelectedTask(task);
  }, []);

  const handleOpenCreateModal = useCallback((dateStr, timeStr, initialStatus = 'todo') => {
    setCreateModalState({ date: dateStr, time: timeStr, status: initialStatus });
  }, []);

  // Click ô giờ trống trên lưới Ngày/Tuần → task Bắt đầu tại ô đó, Hạn +1 giờ
  // (kiểu Google Calendar), xem TaskForm `initialStart`.
  const handleSlotCreate = useCallback((dateStr, startTime) => {
    setCreateModalState({ date: dateStr, start: startTime, status: 'todo' });
  }, []);

  const handleAddNewTask = useCallback(() => {
    if (activeView === 'list') {
      setShowForm((prev) => !prev);
    } else if (activeView === 'kanban') {
      // Kanban không có form inline — mở modal giống double-click cột To Do (không ngày).
      setCreateModalState({ status: 'todo' });
    } else {
      setCreateModalState({
        date: toDateStr(currentDate || new Date()),
        time: '09:00',
      });
    }
  }, [activeView, currentDate]);

  // Header theo mockup: "Chiều thứ Bảy, 10/10" + âm lịch + giờ tốt kế tiếp; cập nhật mỗi phút.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const hourNow = now.getHours();
  const dayPart = hourNow < 11 ? 'Sáng' : hourNow < 13 ? 'Trưa' : hourNow < 18 ? 'Chiều' : 'Tối';
  const weekday = ['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'][now.getDay()];
  const lunarNow = solarToLunar(now.getDate(), now.getMonth() + 1, now.getFullYear());
  const moon = lunarNow.day === 1 ? 'Trăng non' : lunarNow.day === 15 ? 'Trăng rằm' : null;
  const goodHour = getNextGoodHour(now);
  const goodHourLabel = !goodHour
    ? null
    : goodHour.isNow
    ? `Đang giờ tốt: ${goodHour.name} ${goodHour.range}`
    : `Giờ tốt kế tiếp: ${goodHour.name} ${goodHour.range}, còn ${Math.floor(goodHour.minutesUntil / 60) ? `${Math.floor(goodHour.minutesUntil / 60)} giờ ` : ''}${goodHour.minutesUntil % 60} phút`;

  const viewDate = currentDate || now;
  const viewLunar = solarToLunar(viewDate.getDate(), viewDate.getMonth() + 1, viewDate.getFullYear());
  const viewIsToday = toDateStr(viewDate) === toDateStr(now);
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
    return taskModel.tasks.some((t) => t.title === title && t.due_date === due);
  };

  return (
    <div className={`tasks-page tasks-page--workspace tasks-workspace${activeView === 'day' ? ' tasks-workspace--day' : ''}`}>
      {/* Hiệu ứng nền Vũ trụ Aurora & Chân trời hành tinh chuẩn mockup */}
      <div className="task-cosmos-bg">
        <div className="task-aurora-glow" />
        <div className="task-stars-layer-1" />
        <div className="task-stars-layer-2" />
        <div className="task-shooting-star task-shooting-star--1" />
        <div className="task-shooting-star task-shooting-star--2" />
        <div className="task-shooting-star task-shooting-star--3" />
        <div className="task-shooting-star task-shooting-star--4" />
        <div className="task-comet-wrapper">
          <span className="task-comet-tail-1" />
          <span className="task-comet-tail-2" />
          <span className="task-comet-head" />
        </div>
        <div className="task-planet-horizon" />
      </div>
      <header className="tk-header">
        <div className="tk-header__info">
          <div className="tk-header__title-row">
            <h1 className="tk-header__title">
              {dayPart} {weekday}, {now.getDate()}/{now.getMonth() + 1}
            </h1>
            {user && (
              <span className="tk-header__stats">
                {pendingTasks.length} ĐANG MỞ · {overdueTasks.length} TRỄ
              </span>
            )}
          </div>
          <div className="tk-header__lunar">
            <span className="tk-chip">
              <AppIcon name="moon" size={13} style={{ color: 'var(--tk-st-doing)' }} />
              Âm {lunarNow.day}/{lunarNow.month} {getCanChiYear(lunarNow.year)}, ngày {getCanChiDay(now.getDate(), now.getMonth() + 1, now.getFullYear()).full}
              {moon && <span style={{ opacity: 0.5 }}>·</span>}
              {moon}
            </span>
            {goodHourLabel && (
              <span className="tk-chip">
                <AppIcon name="sun" size={13} style={{ color: 'var(--tk-st-doing)' }} />
                {goodHourLabel}
              </span>
            )}
          </div>
        </div>

        {/* Chỉ hiện trên mobile ở view Ngày (CSS): thay cho cụm điều hướng của toolbar */}
        {activeView === 'day' && (
          <div className="tk-header__day">
            <div className="tk-header__day-info">
              <span className="tk-header__day-title">
                {['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][viewDate.getDay()]} {viewDate.getDate()}/{viewDate.getMonth() + 1}/{viewDate.getFullYear()}
              </span>
              <span className="tk-header__day-lunar">
                <AppIcon name="moon" size={13} style={{ color: 'var(--tk-accent)', flex: 'none' }} />
                <span>
                  Âm {viewLunar.day}/{viewLunar.month} {getCanChiYear(viewLunar.year)}, ngày {getCanChiDay(viewDate.getDate(), viewDate.getMonth() + 1, viewDate.getFullYear()).full}
                  {viewLunar.day === 1 ? ' · Trăng non' : viewLunar.day === 15 ? ' · Trăng rằm' : ''}
                </span>
              </span>
            </div>
            {!viewIsToday && (
              <button type="button" className="tk-header__day-today" onClick={() => setCurrentDate(new Date())}>
                Hôm nay
              </button>
            )}
            <button type="button" className="tk-header__day-arrow" onClick={() => shiftViewDay(-1)} aria-label="Ngày trước">
              <AppIcon name="caretLeft" size={17} />
            </button>
            <button type="button" className="tk-header__day-arrow" onClick={() => shiftViewDay(1)} aria-label="Ngày sau">
              <AppIcon name="caretRight" size={17} />
            </button>
          </div>
        )}
      </header>

      {/* Thanh All-in-one Header Toolbar — Cố định 100% trên đỉnh, không bao giờ bị nhảy */}
      <CalendarToolbar
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        activeView={activeView}
        setActiveView={handleSetActiveView}
        startOnSunday={startOnSunday}
        setStartOnSunday={setStartOnSunday}
        isWidgetOpen={isWidgetOpen}
        onToggleWidget={handleToggleWidget}
        onAddNewTask={handleAddNewTask}
        taskCount={due}
      />

      {/* Bố cục 2 phân vùng (Main Canvas + Collapsible Right Widget Panel) */}
      <div className="cal-layout-container">
        <main className="cal-main-canvas">
          {activeView === 'list' ? (
            <div className="tasks-list-scroll-wrapper">
              {/* Mini Summary Bar nằm gọn gàng trên đầu danh sách, không đẩy Header */}
              <div className="tasks-hero-compact">
                <div className="tasks-hero-compact__left">
                  <span className="tasks-hero-compact__num gradient-text">{due}</span>
                  <span className="tasks-hero-compact__label">việc cần làm</span>
                </div>

                <div className="tasks-hero-compact__stats">
                  <div className="tasks-hero-compact__badge tasks-hero-compact__badge--overdue">
                    <span className="tasks-hero-compact__dot" /> {overdueTasks.length} Quá hạn
                  </div>
                  <div className="tasks-hero-compact__badge tasks-hero-compact__badge--today">
                    <span className="tasks-hero-compact__dot" /> {todayTasks.length} Hôm nay
                  </div>
                  <div className="tasks-hero-compact__badge tasks-hero-compact__badge--future">
                    <span className="tasks-hero-compact__dot" /> {futureTasks.length} Sắp tới
                  </div>
                </div>
              </div>

              <TaskListSection
                taskModel={taskModel}
                showForm={showForm}
                setShowForm={setShowForm}
                onSelectTask={handleSelectTaskFromCalendar}
              />
            </div>
          ) : !user ? (
            <div className="task-empty">
              <div className="task-empty__hint">Đăng nhập để xem lịch nhiệm vụ.</div>
            </div>
          ) : (
            <Suspense fallback={<div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Đang tải...</div>}>
              {activeView === 'kanban' && (
                <TaskKanbanView
                  taskModel={taskModel}
                  onSelectTask={handleSelectTaskFromCalendar}
                  refreshKey={calendarRefreshKey}
                />
              )}

              {activeView === 'agenda' && (
                <CalendarAgendaView
                  onRescheduleTask={handleRescheduleTask}
                  pendingTasks={pendingTasks}
                  overdueTasks={overdueTasks}
                  onMoveAllLateToToday={async () => {
                    const todayStr = toDateStr();
                    await Promise.all(overdueTasks.map((t) => updateTask(t.id, { due_date: todayStr })));
                    refreshCalendars();
                  }}
                  getCompletedTasksRange={getCompletedTasksRange}
                  onSelectTask={handleSelectTaskFromCalendar}
                  onQuickCreate={handleOpenCreateModal}
                  currentDate={currentDate}
                  holidayToggles={holidayToggles}
                  customAnniversaries={customAnniversaries}
                  refreshKey={calendarRefreshKey}
                />
              )}

              {activeView === 'day' && (
                <CalendarDayView
                  onRescheduleTask={handleRescheduleTask}
                  pendingTasks={pendingTasks}
                  getCompletedTasksRange={getCompletedTasksRange}
                  onSelectTask={handleSelectTaskFromCalendar}
                  onQuickCreate={handleOpenCreateModal}
                  onSlotCreate={handleSlotCreate}
                  currentDate={currentDate}
                  holidayToggles={holidayToggles}
                  customAnniversaries={customAnniversaries}
                  refreshKey={calendarRefreshKey}
                />
              )}

              {activeView === 'week' && (
                <WeekCalendar
                  onRescheduleTask={handleRescheduleTask}
                  pendingTasks={pendingTasks}
                  getCompletedTasksRange={getCompletedTasksRange}
                  onSelectTask={handleSelectTaskFromCalendar}
                  onQuickCreate={handleOpenCreateModal}
                  onSlotCreate={handleSlotCreate}
                  currentDate={currentDate}
                  startOnSunday={startOnSunday}
                  hideToolbar={true}
                  holidayToggles={holidayToggles}
                  customAnniversaries={customAnniversaries}
                  refreshKey={calendarRefreshKey}
                />
              )}

              {activeView === 'month' && (
                <MonthCalendar
                  onRescheduleTask={handleRescheduleTask}
                  getCompletedTasksRange={getCompletedTasksRange}
                  onDeleteTask={deleteTask}
                  pendingTasks={pendingTasks}
                  onSelectTask={handleSelectTaskFromCalendar}
                  onQuickCreate={handleOpenCreateModal}
                  currentDate={currentDate}
                  setCurrentDate={setCurrentDate}
                  startOnSunday={startOnSunday}
                  hideToolbar={true}
                  holidayToggles={holidayToggles}
                  customAnniversaries={customAnniversaries}
                  refreshKey={calendarRefreshKey}
                />
              )}
            </Suspense>
          )}
        </main>

        {/* Panel Tiện ích Bên Phải (Lịch vạn niên, Giờ Hoàng Đạo, Đếm ngược, Bật tắt Lễ & Kỷ niệm) */}
        <Suspense fallback={null}>
          <CalendarWidgetPanel
            isOpen={isWidgetOpen}
            currentDate={currentDate}
            onClose={handleToggleWidget}
            holidayToggles={holidayToggles}
            onToggleHolidayType={handleToggleHolidayType}
            customAnniversaries={customAnniversaries}
            onAddCustomAnniversary={handleAddCustomAnniversary}
            onDeleteCustomAnniversary={handleDeleteCustomAnniversary}
            isEventTaskAdded={isEventTaskAdded}
            onCreateTaskFromEvent={async (ev) => {
              if (isEventTaskAdded(ev)) return;
              await taskModel.addTask({
                title: eventTaskTitle(ev),
                dueDate: toDateStr(ev.targetDate || new Date()),
                priority: 0,
                status: 'todo',
              });
              refreshCalendars();
            }}
            onSelectEventDate={(targetDate) => {
              setCurrentDate(targetDate);
              // Tự chuyển sang view Ngày hoặc Tuần để xem chi tiết
              if (activeView === 'month') {
                handleSetActiveView('day');
              }
            }}
          />
        </Suspense>
      </div>

      {/* Right Drawer trượt xem và sửa chi tiết Task chuẩn mockup mới */}
      {selectedTask && (
        <TaskDetailDrawer
          key={selectedTask.id}
          task={taskModel.tasks.find((t) => t.id === selectedTask.id) || selectedTask}
          taskModel={taskModel}
          onClose={handleCloseSelectedModal}
          onOpenSubtaskDetail={(st) => setSelectedTask(st)}
        />
      )}

      {/* Modal tạo Task đầy đủ tính năng */}
      <TaskCreateModal
        isOpen={!!createModalState}
        initialDate={createModalState?.date}
        initialTime={createModalState?.time}
        initialStart={createModalState?.start}
        initialStatus={createModalState?.status || 'todo'}
        onClose={() => setCreateModalState(null)}
        taskModel={taskModel}
      />
    </div>
  );
}

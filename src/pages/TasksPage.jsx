import { useState, lazy, Suspense, useCallback } from 'react';
import TaskListSection from '../components/TaskListSection';
import { useUserTasks } from '../hooks/useUserTasks';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import TaskDetailModal from '../components/TaskDetailModal';
import TaskCreateModal from '../components/TaskCreateModal';
import CalendarToolbar from '../components/CalendarToolbar';
import { toDateStr } from '../utils/dateUtils';
import '../styles/tasks.css';
import '../styles/calendar-widget.css';
import '../styles/week-calendar.css';

const MonthCalendar = lazy(() => import('../components/MonthCalendar'));
const WeekCalendar = lazy(() => import('../components/WeekCalendar'));
const CalendarAgendaView = lazy(() => import('../components/CalendarAgendaView'));
const CalendarDayView = lazy(() => import('../components/CalendarDayView'));
const CalendarWidgetPanel = lazy(() => import('../components/CalendarWidgetPanel'));

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
    deleteCompletedTask,
    completeTask,
  } = taskModel;

  // Chế độ xem: 'list' | 'agenda' | 'day' | 'week' | 'month'
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('lh_tasks_active_view') || 'list';
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

  // State xem chi tiết task từ lịch
  const [selectedTask, setSelectedTask] = useState(null);

  // State mở Modal tạo Task
  const [createModalState, setCreateModalState] = useState(null); // { date: string, time: string }

  const due = overdueTasks.length + todayTasks.length;

  const handleSelectTaskFromCalendar = useCallback((task) => {
    setSelectedTask(task);
  }, []);

  const handleOpenCreateModal = useCallback((dateStr, timeStr) => {
    setCreateModalState({ date: dateStr, time: timeStr });
  }, []);

  const handleAddNewTask = useCallback(() => {
    if (activeView === 'list') {
      setShowForm((prev) => !prev);
    } else {
      setCreateModalState({
        date: toDateStr(currentDate || new Date()),
        time: '09:00',
      });
    }
  }, [activeView, currentDate]);

  return (
    <div className="tasks-page tasks-page--workspace">
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

              <TaskListSection taskModel={taskModel} showForm={showForm} setShowForm={setShowForm} />
            </div>
          ) : !user ? (
            <div className="task-empty">
              <div className="task-empty__hint">Đăng nhập để xem lịch nhiệm vụ.</div>
            </div>
          ) : (
            <Suspense fallback={<div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Đang tải lịch...</div>}>
              {activeView === 'agenda' && (
                <CalendarAgendaView
                  pendingTasks={pendingTasks}
                  getCompletedTasksRange={getCompletedTasksRange}
                  onSelectTask={handleSelectTaskFromCalendar}
                  onQuickCreate={handleOpenCreateModal}
                  currentDate={currentDate}
                  holidayToggles={holidayToggles}
                  customAnniversaries={customAnniversaries}
                />
              )}

              {activeView === 'day' && (
                <CalendarDayView
                  pendingTasks={pendingTasks}
                  getCompletedTasksRange={getCompletedTasksRange}
                  onSelectTask={handleSelectTaskFromCalendar}
                  onQuickCreate={handleOpenCreateModal}
                  currentDate={currentDate}
                  holidayToggles={holidayToggles}
                  customAnniversaries={customAnniversaries}
                />
              )}

              {activeView === 'week' && (
                <WeekCalendar
                  pendingTasks={pendingTasks}
                  getCompletedTasksRange={getCompletedTasksRange}
                  onSelectTask={handleSelectTaskFromCalendar}
                  onQuickCreate={handleOpenCreateModal}
                  currentDate={currentDate}
                  startOnSunday={startOnSunday}
                  hideToolbar={true}
                  holidayToggles={holidayToggles}
                  customAnniversaries={customAnniversaries}
                />
              )}

              {activeView === 'month' && (
                <MonthCalendar
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

      {/* Modal chi tiết Task khi click vào sự kiện trên Lịch */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={async () => {
            setSelectedTask(null);
          }}
          onComplete={async (taskId, completed) => {
            await completeTask(taskId, completed);
            setSelectedTask(null);
          }}
          onDelete={async (taskId) => {
            if (selectedTask.completed) {
              await deleteCompletedTask(taskId);
            } else {
              await deleteTask(taskId);
            }
            setSelectedTask(null);
          }}
        />
      )}

      {/* Modal tạo Task đầy đủ tính năng */}
      <TaskCreateModal
        isOpen={!!createModalState}
        initialDate={createModalState?.date}
        initialTime={createModalState?.time}
        onClose={() => setCreateModalState(null)}
        taskModel={taskModel}
      />
    </div>
  );
}

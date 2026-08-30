import { useState, lazy, Suspense, useCallback } from 'react';
import TaskListSection from '../components/TaskListSection';
import { useUserTasks } from '../hooks/useUserTasks';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import TaskDetailModal from '../components/TaskDetailModal';
import TaskCreateModal from '../components/TaskCreateModal';
import CalendarToolbar from '../components/CalendarToolbar';
import '../styles/tasks.css';

const MonthCalendar = lazy(() => import('../components/MonthCalendar'));
const WeekCalendar = lazy(() => import('../components/WeekCalendar'));

/**
 * TasksPage (/tasks) — Task thành module riêng ở v4.27.0, thêm hero + tab Lịch ở v4.29.0.
 *
 * 3 chế độ xem:
 * - **Danh sách** — việc CHƯA làm (Quá hạn / Hôm nay / Sắp tới)
 * - **Lịch tuần (Google Calendar style)** — khối thời gian trực quan 24h, chia cột chống đè khi trùng giờ
 * - **Lịch tháng** — tổng quan ngày âm + ngày lễ + số task hoàn thành
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

  const [view, setView] = useState('list');
  const [calendarMode, setCalendarMode] = useState('week'); // 'week' | 'month'
  const [showForm, setShowForm] = useState(false);

  // State ngày neo và tùy chọn đầu tuần dùng chung giữa Tuần & Tháng (đồng bộ chuẩn Google Calendar)
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [startOnSunday, setStartOnSunday] = useState(() => {
    const saved = localStorage.getItem('lh_cal_start_sun');
    return saved !== null ? saved === 'true' : true;
  });

  // State xem chi tiết task từ lịch
  const [selectedTask, setSelectedTask] = useState(null);

  // State mở Modal tạo Task đầy đủ tính năng khi click vào ô giờ trong WeekCalendar
  const [createModalState, setCreateModalState] = useState(null); // { date: string, time: string }

  const due = overdueTasks.length + todayTasks.length;

  const handleSelectTaskFromCalendar = useCallback((task) => {
    setSelectedTask(task);
  }, []);

  const handleOpenCreateModal = useCallback((dateStr, timeStr) => {
    setCreateModalState({ date: dateStr, time: timeStr });
  }, []);

  return (
    <div className={`tasks-page${view === 'calendar' ? ` tasks-page--calendar tasks-page--calendar-${calendarMode}` : ''}`}>
      <div className="tasks-hero">
        <div className="tasks-hero__count">
          <span className="tasks-hero__num gradient-text">{due}</span>
          <span className="tasks-hero__unit">việc cần làm</span>
        </div>

        <div className="tasks-hero__stats">
          <div className="tasks-stat tasks-stat--overdue">
            <span className="tasks-stat__val">{overdueTasks.length}</span>
            <span className="tasks-stat__label">Quá hạn</span>
          </div>
          <div className="tasks-stat tasks-stat--today">
            <span className="tasks-stat__val">{todayTasks.length}</span>
            <span className="tasks-stat__label">Hôm nay</span>
          </div>
          <div className="tasks-stat tasks-stat--future">
            <span className="tasks-stat__val">{futureTasks.length}</span>
            <span className="tasks-stat__label">Sắp tới</span>
          </div>
        </div>
      </div>

      <div className="tasks-viewbar" role="tablist" aria-label="Chế độ xem">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'list'}
          className={`tasks-viewbar__tab${view === 'list' ? ' tasks-viewbar__tab--active' : ''}`}
          onClick={() => setView('list')}
        >
          <AppIcon name="list" size={15} /> Danh sách
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'calendar'}
          className={`tasks-viewbar__tab${view === 'calendar' ? ' tasks-viewbar__tab--active' : ''}`}
          onClick={() => setView('calendar')}
        >
          <AppIcon name="calendar" size={15} /> Lịch
        </button>

        {view === 'list' && (
          <button
            type="button"
            className="tasks-viewbar__add"
            onClick={() => setShowForm(!showForm)}
            id="task-add-btn"
            style={{ color: showForm ? 'var(--red)' : 'var(--purple-light)' }}
          >
            <AppIcon name={showForm ? 'x' : 'plus'} size={15} /> {showForm ? 'Đóng' : 'Thêm'}
          </button>
        )}
      </div>

      {view === 'list' ? (
        <TaskListSection taskModel={taskModel} showForm={showForm} setShowForm={setShowForm} />
      ) : !user ? (
        <div className="task-empty">
          <div className="task-empty__hint">Đăng nhập để xem lịch nhiệm vụ.</div>
        </div>
      ) : (
        <Suspense fallback={<div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Đang tải lịch...</div>}>
          {/* Thanh Toolbar Google Calendar chung — cố định 100% không bị giật hay dính scroll khi chuyển view */}
          <CalendarToolbar
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            calendarMode={calendarMode}
            setCalendarMode={setCalendarMode}
            startOnSunday={startOnSunday}
            setStartOnSunday={setStartOnSunday}
          />

          <div className="calendar-view-container">
            {calendarMode === 'week' ? (
              <WeekCalendar
                pendingTasks={pendingTasks}
                getCompletedTasksRange={getCompletedTasksRange}
                onSelectTask={handleSelectTaskFromCalendar}
                onQuickCreate={handleOpenCreateModal}
                currentDate={currentDate}
                startOnSunday={startOnSunday}
                hideToolbar={true}
              />
            ) : (
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
              />
            )}
          </div>
        </Suspense>
      )}

      {/* Modal chi tiết Task khi click vào sự kiện trên Lịch */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={async () => {
            // TaskDetailModal tự động gọi update trong nó
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

      {/* Modal tạo Task đầy đủ tính năng khi click vào khung giờ trống trên Lịch Tuần */}
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

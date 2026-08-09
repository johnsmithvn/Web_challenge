import { useState, lazy, Suspense } from 'react';
import TaskListSection from '../components/TaskListSection';
import { useUserTasks } from '../hooks/useUserTasks';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import '../styles/tasks.css';

const MonthCalendar = lazy(() => import('../components/MonthCalendar'));

/**
 * TasksPage (/tasks) — Task thành module riêng ở v4.27.0, thêm hero + tab Lịch ở v4.29.0.
 *
 * 2 view trên cùng `user_tasks`:
 * - **Danh sách** — việc CHƯA làm (Quá hạn / Hôm nay / Sắp tới)
 * - **Lịch** — việc pending + đã xong theo ngày, hiển thị bằng chip tên task.
 */
export default function TasksPage() {
  const { user } = useAuth();
  const taskModel = useUserTasks();
  const { todayTasks, overdueTasks, futureTasks, pendingTasks, getCompletedTasksRange, deleteTask } = taskModel;
  const [view, setView] = useState('list');
  // Nút "Thêm" đứng cùng hàng với 2 tab nên page giữ state mở form.
  const [showForm, setShowForm] = useState(false);

  const due = overdueTasks.length + todayTasks.length;

  return (
    <div className={`tasks-page${view === 'calendar' ? ' tasks-page--calendar' : ''}`}>
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
          role="tab" aria-selected={view === 'list'}
          className={`tasks-viewbar__tab${view === 'list' ? ' tasks-viewbar__tab--active' : ''}`}
          onClick={() => setView('list')}
        ><AppIcon name="list" size={15} /> Danh sách</button>
        <button
          role="tab" aria-selected={view === 'calendar'}
          className={`tasks-viewbar__tab${view === 'calendar' ? ' tasks-viewbar__tab--active' : ''}`}
          onClick={() => setView('calendar')}
        ><AppIcon name="calendar" size={15} /> Lịch</button>

        {view === 'list' && (
          <button
            className="tasks-viewbar__add"
            onClick={() => setShowForm(!showForm)}
            id="task-add-btn"
            style={{ color: showForm ? 'var(--red)' : 'var(--purple-light)' }}
          ><AppIcon name={showForm ? 'x' : 'plus'} size={15} /> {showForm ? 'Đóng' : 'Thêm'}</button>
        )}
      </div>

      {view === 'list' ? (
        <TaskListSection taskModel={taskModel} showForm={showForm} setShowForm={setShowForm} />
      ) : !user ? (
        <div className="task-empty">
          <div className="task-empty__hint">Đăng nhập để xem lịch sử nhiệm vụ.</div>
        </div>
      ) : (
        <Suspense fallback={<div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Đang tải lịch...</div>}>
          <MonthCalendar
            getCompletedTasksRange={getCompletedTasksRange}
            onDeleteTask={deleteTask}
            pendingTasks={pendingTasks}
          />
        </Suspense>
      )}
    </div>
  );
}

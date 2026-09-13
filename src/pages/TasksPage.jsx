import { useState, lazy, Suspense, useCallback } from 'react';
import TaskListSection from '../components/TaskListSection';
import { useUserTasks } from '../hooks/useUserTasks';
import { useTags } from '../hooks/useTags';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import TaskDetailModal from '../components/TaskDetailModal';
import TaskCreateModal from '../components/TaskCreateModal';
import CalendarToolbar from '../components/CalendarToolbar';
import DatePickerPopover from '../components/DatePickerPopover';
import TagPicker from '../components/TagPicker';
import { PRIORITY_OPTIONS, WEEKDAYS } from '../utils/taskFields';
import { toDateStr } from '../utils/dateUtils';
import '../styles/tasks.css';
import '../styles/calendar-widget.css';
import '../styles/week-calendar.css';

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
function TaskEditForm({ task, onSave, onCancel, allTags, addTag }) {
  const [editTitle, setEditTitle] = useState(task?.title || '');
  const [editDesc, setEditDesc] = useState(task?.description || '');
  const [editDate, setEditDate] = useState(task?.due_date || toDateStr());
  const [editTime, setEditTime] = useState(task?.due_time ? task.due_time.substring(0, 5) : '23:59');
  const [editPriority, setEditPriority] = useState(task?.priority || 0);
  const [editTagIds, setEditTagIds] = useState((task?._tags || []).map((t) => t.id));
  const [showEditDP, setShowEditDP] = useState(false);

  const rec = task?.recurrence_rule;
  const [editShowRec, setEditShowRec] = useState(!!rec);
  const [editRecType, setEditRecType] = useState(rec?.type || 'interval');
  const [editRecDays, setEditRecDays] = useState(rec?.days || 7);
  const [editRecWeekday, setEditRecWeekday] = useState(rec?.weekday ?? 1);
  const [editRecMonthDay, setEditRecMonthDay] = useState(rec?.day || 1);

  const handleSave = () => {
    if (!editTitle.trim()) return;
    let recurrenceRule = null;
    if (editShowRec) {
      if (editRecType === 'interval') recurrenceRule = { type: 'interval', days: editRecDays };
      else if (editRecType === 'weekly') recurrenceRule = { type: 'weekly', weekday: editRecWeekday };
      else if (editRecType === 'monthly') recurrenceRule = { type: 'monthly', day: editRecMonthDay };
    }
    onSave(
      {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        due_date: editDate || toDateStr(),
        due_time: editTime || null,
        priority: editPriority,
        recurrence_rule: recurrenceRule,
      },
      editTagIds
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
        background: 'rgba(139,92,246,0.06)',
        border: '1px solid rgba(139,92,246,0.18)',
        borderRadius: 'var(--radius-md)',
        padding: '0.85rem',
        marginBottom: '0.25rem',
      }}
    >
      {/* Title */}
      <input
        className="auth-input"
        value={editTitle}
        onChange={(e) => setEditTitle(e.target.value)}
        style={{ fontSize: '0.88rem', fontWeight: 600 }}
        autoFocus
        placeholder="Tên nhiệm vụ *"
      />

      {/* Description */}
      <textarea
        className="auth-input task-desc-input"
        value={editDesc}
        onChange={(e) => setEditDesc(e.target.value)}
        rows={2}
        placeholder="Mô tả..."
        style={{ fontSize: '0.82rem' }}
      />

      {/* Date + Time (DatePicker) */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setShowEditDP(!showEditDP)}
          className="auth-input"
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '0.82rem' }}
        >
          <AppIcon name="calendar" size={14} />{' '}
          {editDate
            ? new Date(editDate + 'T00:00:00').toLocaleDateString('vi-VN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })
            : 'Chọn ngày'}
          {editTime && editTime !== '00:00' && (
            <>
              {' '}
              · <AppIcon name="clock" size={14} /> {editTime}
            </>
          )}
        </button>
        {showEditDP && (
          <DatePickerPopover
            value={editDate}
            onChange={(d) => setEditDate(d)}
            onClose={() => setShowEditDP(false)}
            timeValue={editTime}
            onTimeChange={setEditTime}
            style={{ top: '100%', left: 0, marginTop: '0.25rem' }}
          />
        )}
      </div>

      {/* Priority */}
      <div>
        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
          Độ ưu tiên
        </label>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {PRIORITY_OPTIONS.filter((o) => o.value > 0).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setEditPriority(editPriority === opt.value ? 0 : opt.value)}
              className={`task-option-btn ${editPriority === opt.value ? 'active' : ''}`}
              style={
                editPriority === opt.value
                  ? {
                      background: `${opt.color}20`,
                      borderColor: `${opt.color}60`,
                      color: opt.color,
                    }
                  : {}
              }
            >
              <AppIcon name={opt.icon} size={14} /> {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recurrence toggle */}
      <div>
        <button
          type="button"
          onClick={() => setEditShowRec(!editShowRec)}
          className={`task-option-btn ${editShowRec ? 'task-option-btn--active-cyan' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        >
          <AppIcon name="refresh" size={14} /> Lặp lại {editShowRec && <AppIcon name="check" size={12} />}
        </button>
        {editShowRec && (
          <div className="task-form-rec-panel">
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {[
                { key: 'interval', label: 'Mỗi N ngày' },
                { key: 'weekly', label: 'Hàng tuần' },
                { key: 'monthly', label: 'Hàng tháng' },
              ].map((rt) => (
                <button
                  key={rt.key}
                  type="button"
                  onClick={() => setEditRecType(rt.key)}
                  className={`task-option-btn ${editRecType === rt.key ? 'task-option-btn--active-cyan' : ''}`}
                  style={{ padding: '0.22rem 0.45rem', fontSize: '0.72rem' }}
                >
                  {rt.label}
                </button>
              ))}
            </div>
            {editRecType === 'interval' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mỗi</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={editRecDays}
                  onChange={(e) => setEditRecDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="auth-input"
                  style={{ width: '60px', fontSize: '0.82rem', textAlign: 'center' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ngày</span>
              </div>
            )}
            {editRecType === 'weekly' && (
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {WEEKDAYS.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setEditRecWeekday(i)}
                    className={`task-option-btn ${editRecWeekday === i ? 'task-option-btn--active-cyan' : ''}`}
                    style={{ padding: '0.22rem 0.38rem', fontSize: '0.72rem' }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
            {editRecType === 'monthly' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ngày</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editRecMonthDay}
                  onChange={(e) =>
                    setEditRecMonthDay(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))
                  }
                  className="auth-input"
                  style={{ width: '55px', fontSize: '0.82rem', textAlign: 'center' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>mỗi tháng</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      <div>
        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
          Tag
        </label>
        <TagPicker
          tags={allTags || []}
          selected={editTagIds}
          onToggle={(tagId) =>
            setEditTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
          }
          onAdd={addTag}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button
          onClick={handleSave}
          className="btn btn-primary"
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
          disabled={!editTitle.trim()}
        >
          <AppIcon name="save" size={14} /> Lưu
        </button>
        <button
          onClick={onCancel}
          className="btn btn-ghost"
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', color: 'var(--text-muted)' }}
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const { user } = useAuth();
  const taskModel = useUserTasks();
  const { tags: allTags, addTag } = useTags();
  const {
    todayTasks,
    overdueTasks,
    futureTasks,
    pendingTasks,
    getCompletedTasksRange,
    deleteTask,
    completeTask,
    updateTask,
    linkTaskTag,
    unlinkTaskTag,
  } = taskModel;

  // Chế độ xem: 'kanban' | 'list' | 'agenda' | 'day' | 'week' | 'month'
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('lh_tasks_active_view') || 'kanban';
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

  // State xem chi tiết task từ lịch & sửa task từ modal chi tiết
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditingSelected, setIsEditingSelected] = useState(false);

  const handleCloseSelectedModal = useCallback(() => {
    setSelectedTask(null);
    setIsEditingSelected(false);
  }, []);

  const handleSaveSelectedTaskEdit = useCallback(
    async (changes, newTagIds) => {
      if (!selectedTask) return;
      const taskId = selectedTask.id;
      const saved = await updateTask(taskId, changes);
      if (saved) {
        const currentTagIds = (selectedTask._tags || []).map((t) => t.id);
        const toAdd = newTagIds.filter((id) => !currentTagIds.includes(id));
        const toRemove = currentTagIds.filter((id) => !newTagIds.includes(id));
        const tagsToAdd = (allTags || []).filter((t) => toAdd.includes(t.id));
        await Promise.all([
          ...tagsToAdd.map((tag) => linkTaskTag(taskId, tag)),
          ...toRemove.map((tagId) => unlinkTaskTag(taskId, tagId)),
        ]);
      }
      setIsEditingSelected(false);
      setSelectedTask(null);
    },
    [selectedTask, updateTask, allTags, linkTaskTag, unlinkTaskTag]
  );

  // State mở Modal tạo Task
  const [createModalState, setCreateModalState] = useState(null); // { date: string, time: string }

  const due = overdueTasks.length + todayTasks.length;

  const handleSelectTaskFromCalendar = useCallback((task) => {
    setSelectedTask(task);
    setIsEditingSelected(false);
  }, []);

  const handleOpenCreateModal = useCallback((dateStr, timeStr) => {
    setCreateModalState({ date: dateStr, time: timeStr });
  }, []);

  const handleAddNewTask = useCallback(() => {
    if (activeView === 'list' || activeView === 'kanban') {
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
            <Suspense fallback={<div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Đang tải...</div>}>
              {activeView === 'kanban' && (
                <TaskKanbanView
                  taskModel={taskModel}
                  onSelectTask={handleSelectTaskFromCalendar}
                  onEditTask={(task) => {
                    setSelectedTask(task);
                    setIsEditingSelected(true);
                  }}
                  onQuickCreate={handleOpenCreateModal}
                />
              )}

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
          onClose={handleCloseSelectedModal}
          onEdit={() => setIsEditingSelected(true)}
          editContent={
            isEditingSelected ? (
              <TaskEditForm
                task={selectedTask}
                onSave={handleSaveSelectedTaskEdit}
                onCancel={() => setIsEditingSelected(false)}
                allTags={allTags}
                addTag={addTag}
              />
            ) : null
          }
          onComplete={async (task) => {
            await completeTask(task.id);
            handleCloseSelectedModal();
          }}
          onDelete={async (task) => {
            await deleteTask(task.id);
            handleCloseSelectedModal();
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

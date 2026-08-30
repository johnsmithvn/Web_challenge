import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { toDateStr } from '../utils/dateUtils';
import { solarToLunar, lunarLabel } from '../utils/lunarUtils';
import { useConfirm } from './ConfirmModal';
import UI_STRINGS from '../data/ui-strings.json';
import HOLIDAYS from '../data/holidays.json';
import AppIcon from './AppIcon';
import '../styles/calendar.css';
import '../styles/week-calendar.css';

const WEEKDAYS_MON = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAYS_SUN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MAX_CHIPS = 4;

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month, startOnSunday = false) {
  const d = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  if (startOnSunday) return d;
  return (d + 6) % 7; // Monday = 0
}

/**
 * MonthCalendar — Giao diện Lịch Tháng Full-Height App-like chuẩn Google Calendar.
 * Cứng cáp 100vh, hoàn toàn triệt tiêu thanh cuộn trang ngoài,
 * các ô chia đều khít khung nhìn, đồng bộ ngày bắt đầu tuần, ngày lễ và phím tắt.
 */
export default function MonthCalendar({
  getCompletedTasksRange,
  onDeleteTask,
  pendingTasks,
  onSelectTask,
  onQuickCreate,
  calendarView = 'month',
  onSwitchView,
  currentDate,
  setCurrentDate,
  startOnSunday: propStartOnSunday,
  hideToolbar = false,
}) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(() => (currentDate ? currentDate.getFullYear() : today.getFullYear()));
  const [viewMonth, setViewMonth] = useState(() => (currentDate ? currentDate.getMonth() : today.getMonth()));

  // Đồng bộ viewYear/viewMonth khi currentDate bên ngoài thay đổi
  useEffect(() => {
    if (currentDate) {
      setViewYear(currentDate.getFullYear());
      setViewMonth(currentDate.getMonth());
    }
  }, [currentDate]);

  const [selectedDayModal, setSelectedDayModal] = useState(null); // dateStr mở popup chi tiết ngày
  const [tasksByDay, setTasksByDay] = useState({});
  const { confirm, ConfirmModal } = useConfirm();

  // Đồng bộ tùy chọn đầu tuần với Lịch Tuần (lưu trong localStorage)
  const [internalStartOnSunday, setInternalStartOnSunday] = useState(() => {
    const saved = localStorage.getItem('lh_cal_start_sun');
    return saved !== null ? saved === 'true' : true;
  });

  const startOnSunday = propStartOnSunday !== undefined ? propStartOnSunday : internalStartOnSunday;

  const toggleStartDay = () => {
    setInternalStartOnSunday((prev) => {
      const next = !prev;
      localStorage.setItem('lh_cal_start_sun', String(next));
      return next;
    });
  };

  const weekdays = startOnSunday ? WEEKDAYS_SUN : WEEKDAYS_MON;
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfW = getFirstDayOfWeek(viewYear, viewMonth, startOnSunday);
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  const pad = (n) => String(n).padStart(2, '0');

  // Tải task hoàn thành trong tháng
  useEffect(() => {
    if (!getCompletedTasksRange) return;
    let stale = false;
    const from = `${viewYear}-${pad(viewMonth + 1)}-01`;
    const to = `${viewYear}-${pad(viewMonth + 1)}-${pad(daysInMonth)}`;

    getCompletedTasksRange(from, to).then((rows) => {
      if (stale) return;
      const map = {};
      for (const r of rows) {
        if (!r.completed_at) continue;
        const key = toDateStr(new Date(r.completed_at));
        (map[key] ||= []).push(r);
      }
      setTasksByDay(map);
    });
    return () => { stale = true; };
  }, [viewYear, viewMonth, daysInMonth, getCompletedTasksRange]);

  // Gom pending tasks theo due_date
  const pendingByDay = useMemo(() => {
    if (!pendingTasks) return {};
    const map = {};
    for (const t of pendingTasks) {
      if (!t.due_date) continue;
      (map[t.due_date] ||= []).push(t);
    }
    return map;
  }, [pendingTasks]);

  // Dữ liệu từng ngày trong tháng
  const dayData = useMemo(() => {
    const map = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
      const lunar = solarToLunar(d, viewMonth + 1, viewYear);
      const lunarKey = lunar.leap ? null : `${pad(lunar.month)}-${pad(lunar.day)}`;
      const holidayOfficial = HOLIDAYS.solar[`${pad(viewMonth + 1)}-${pad(d)}`]
        || (lunarKey ? HOLIDAYS.lunar[lunarKey] : null)
        || null;
      const holidayFun = (!holidayOfficial && HOLIDAYS.fun)
        ? (HOLIDAYS.fun[`${pad(viewMonth + 1)}-${pad(d)}`] || null)
        : null;
      const holiday = holidayOfficial || holidayFun;
      const holidayType = holidayOfficial ? 'official' : (holidayFun ? 'fun' : null);

      const tasks = tasksByDay[dateStr] || [];
      const pending = pendingByDay[dateStr] || [];
      const done = tasks.length > 0;
      map[d] = { dateStr, done, holiday, holidayType, lunar, tasks, pending };
    }
    return map;
  }, [viewYear, viewMonth, daysInMonth, tasksByDay, pendingByDay]);

  const todayStr = toDateStr(today);

  const prevMonth = useCallback(() => {
    if (setCurrentDate) {
      setCurrentDate((prev) => {
        const d = new Date(prev);
        d.setMonth(d.getMonth() - 1);
        return d;
      });
    } else {
      if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
      else setViewMonth((m) => m - 1);
    }
  }, [setCurrentDate, viewMonth]);

  const nextMonth = useCallback(() => {
    if (setCurrentDate) {
      setCurrentDate((prev) => {
        const d = new Date(prev);
        d.setMonth(d.getMonth() + 1);
        return d;
      });
    } else {
      if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
      else setViewMonth((m) => m + 1);
    }
  }, [setCurrentDate, viewMonth]);

  const goToday = useCallback(() => {
    if (setCurrentDate) {
      setCurrentDate(new Date());
    } else {
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
    }
  }, [setCurrentDate, today]);

  // Cuộn chuột trong Lịch Tháng để chuyển tháng trước / tháng sau (chuẩn Google Calendar UX)
  const wheelLockRef = useRef(false);
  const handleWheel = useCallback((e) => {
    // Không chuyển tháng nếu đang mở modal chi tiết ngày
    if (selectedDayModal) return;

    // Ngưỡng lăn chuột đủ rõ ràng, tránh rung nhẹ trên touchpad
    if (Math.abs(e.deltaY) < 25) return;

    if (wheelLockRef.current) return;
    wheelLockRef.current = true;

    if (e.deltaY > 0) {
      nextMonth();
    } else {
      prevMonth();
    }

    // Khóa đệm 450ms để không bị nhảy cóc nhiều tháng liên tiếp do quán tính chuột
    setTimeout(() => {
      wheelLockRef.current = false;
    }, 450);
  }, [selectedDayModal, nextMonth, prevMonth]);

  // Mảng ô của tháng gồm ô trống đầu + các ngày + ô trống cuối
  const cells = useMemo(() => {
    const list = [];
    for (let i = 0; i < firstDayOfW; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    while (list.length % 7 !== 0) {
      list.push(null);
    }
    return list;
  }, [firstDayOfW, daysInMonth]);

  const weeksCount = Math.ceil(cells.length / 7) || 5;

  const handleDeleteTask = useCallback(async (task, dateStr) => {
    const cfg = UI_STRINGS.confirm.deleteTask;
    const ok = await confirm({
      ...cfg,
      message: cfg.message.replace('{name}', task.title),
    });
    if (!ok) return;
    const deleted = await onDeleteTask(task.id);
    if (deleted !== false) {
      setTasksByDay((prev) => ({
        ...prev,
        [dateStr]: (prev[dateStr] || []).filter((t) => t.id !== task.id),
      }));
    }
  }, [confirm, onDeleteTask]);

  // Đóng modal chi tiết ngày bằng Escape
  useEffect(() => {
    if (!selectedDayModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedDayModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDayModal]);

  return (
    <div className="month-cal week-cal" onWheel={handleWheel}>
      {ConfirmModal}

      {/* ── Toolbar điều hướng trên cùng — Ẩn khi dùng CalendarToolbar chung ──── */}
      {!hideToolbar && (
        <div className="week-cal__toolbar">
          <div className="week-cal__nav-group">
            <button
              type="button"
              className="week-cal__btn-today"
              onClick={goToday}
            >
              Hôm nay
            </button>
            <div className="week-cal__nav-arrows">
              <button
                type="button"
                className="week-cal__btn-nav"
                onClick={prevMonth}
                aria-label="Tháng trước"
              >
                <AppIcon name="caretLeft" size={16} />
              </button>
              <button
                type="button"
                className="week-cal__btn-nav"
                onClick={nextMonth}
                aria-label="Tháng sau"
              >
                <AppIcon name="caretRight" size={16} />
              </button>
            </div>
            <span className="week-cal__title" style={{ textTransform: 'capitalize' }}>
              {monthLabel}
            </span>
          </div>

          {/* Bắt đầu tuần, Legend & Bộ chuyển view */}
          <div className="week-cal__toolbar-right">
            <button
              type="button"
              className="week-cal__btn-startday"
              onClick={toggleStartDay}
              title="Đổi ngày bắt đầu tuần"
            >
              Bắt đầu: <strong>{startOnSunday ? 'Chủ Nhật' : 'Thứ 2'}</strong>
            </button>

            <div className="week-cal__color-legend">
              <span className="week-cal__legend-item week-cal__legend-item--holiday">
                <span className="week-cal__legend-dot" /> Ngày lễ
              </span>
              <span className="week-cal__legend-item week-cal__legend-item--fun">
                <span className="week-cal__legend-dot" /> Dịp đặc biệt / Dev
              </span>
              <span className="week-cal__legend-item week-cal__legend-item--overdue">
                <span className="week-cal__legend-dot" /> Quá hạn
              </span>
              <span className="week-cal__legend-item week-cal__legend-item--done">
                <span className="week-cal__legend-dot" /> Đã xong
              </span>
            </div>

            {onSwitchView && (
              <div className="week-cal__view-switch" role="tablist" aria-label="Chế độ lịch">
                <button
                  type="button"
                  role="tab"
                  aria-selected={calendarView === 'week'}
                  className={`week-cal__view-btn${calendarView === 'week' ? ' week-cal__view-btn--active' : ''}`}
                  onClick={() => onSwitchView('week')}
                >
                  Tuần
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={calendarView === 'month'}
                  className={`week-cal__view-btn${calendarView === 'month' ? ' week-cal__view-btn--active' : ''}`}
                  onClick={() => onSwitchView('month')}
                >
                  Tháng
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hàng Thứ 7 ngày trong tuần ─────────────────────────────────── */}
      <div className="cal-weekdays">
        {weekdays.map((d) => (
          <div key={d} className="cal-weekday">
            {d}
          </div>
        ))}
      </div>

      {/* ── Lưới Lịch Tháng Full-Height (Chia đều tỷ lệ 1fr cho các tuần) ── */}
      <div
        className="cal-grid"
        style={{ gridTemplateRows: `repeat(${weeksCount}, minmax(0, 1fr))` }}
      >
        {cells.map((day, i) => {
          if (!day) {
            return (
              <div
                key={`blank-${i}`}
                className="cal-cell cal-cell--blank"
              />
            );
          }

          const info = dayData[day];
          const isToday = info.dateStr === todayStr;
          const isFuture = new Date(info.dateStr) > today;

          const chips = [
            ...info.tasks.map((t) => ({ ...t, _done: true })),
            ...info.pending.map((t) => {
              const overdue = !t.completed && t.due_date && t.due_date < todayStr;
              return { ...t, _done: false, _overdue: overdue };
            }),
          ];

          const chipLimit = info.holiday ? MAX_CHIPS - 1 : MAX_CHIPS;
          const shown = chips.slice(0, chipLimit);

          return (
            <div
              key={day}
              className={[
                'cal-cell',
                info.done ? 'cal-cell--done' : isFuture ? 'cal-cell--future' : 'cal-cell--empty',
                isToday ? 'cal-cell--today' : '',
                info.holiday ? `cal-cell--holiday cal-cell--holiday-${info.holidayType}` : '',
              ].join(' ')}
              onClick={() => setSelectedDayModal(info.dateStr)}
              onDoubleClick={() => onQuickCreate?.(info.dateStr, '09:00')}
              id={`cal-day-${info.dateStr}`}
              role="button"
              title={[
                info.dateStr,
                `Âm lịch ${info.lunar.day}/${info.lunar.month}${info.lunar.leap ? ' (nhuận)' : ''}`,
                info.holiday,
                info.tasks.length ? `${info.tasks.length} task xong` : null,
                'Nhấp đúp để tạo việc nhanh',
              ].filter(Boolean).join(' — ')}
            >
              {/* Header ngày: Số ngày dương + Âm lịch */}
              <div className="cal-cell__head">
                <span className={`cal-cell__num ${isToday ? 'cal-cell__num--today' : ''}`}>
                  {day}
                </span>
                <span className={`cal-cell__lunar ${info.lunar.day === 1 ? 'cal-cell__lunar--first' : ''}`}>
                  {lunarLabel(info.lunar)}
                </span>
              </div>

              {/* Banner Ngày Lễ trong ô */}
              {info.holiday && (
                <span
                  className={`cal-cell__holiday cal-cell__holiday--${info.holidayType}`}
                  title={`${info.holidayType === 'fun' ? 'Dịp đặc biệt / Dev: ' : 'Ngày lễ: '}${info.holiday}`}
                >
                  <AppIcon name={info.holidayType === 'fun' ? 'lightning' : 'star'} size={11} weight="fill" />
                  <span className="cal-cell__holiday-name">{info.holiday}</span>
                </span>
              )}

              {/* Danh sách Task Chips phẳng kiểu Google Calendar */}
              <div className="cal-cell__chips">
                {shown.map((t) => {
                  const chipClass = t._done
                    ? 'cal-chip--done'
                    : t._overdue
                    ? 'cal-chip--overdue'
                    : 'cal-chip--active';

                  return (
                    <div
                      key={t.id}
                      className={`cal-chip ${chipClass}`}
                      title={t.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTask?.(t);
                      }}
                    >
                      <span className="cal-chip__title">
                        {t._done ? '✓ ' : t._overdue ? '⚠️ ' : ''}{t.title}
                      </span>
                    </div>
                  );
                })}

                {chips.length > chipLimit && (
                  <div
                    className="cal-chip cal-chip--more"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDayModal(info.dateStr);
                    }}
                  >
                    +{chips.length - chipLimit} nữa…
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal Chi Tiết Ngày Nổi (Day Detail Modal) — Không phá vỡ 100vh ── */}
      {selectedDayModal && (() => {
        const dayNum = Number(selectedDayModal.slice(8, 10));
        const info = dayData[dayNum];
        const selectedTasks = info?.tasks || [];
        const selectedPending = info?.pending || [];

        return (
          <div
            className="qc-backdrop"
            onClick={() => setSelectedDayModal(null)}
            style={{ zIndex: 9999 }}
          >
            <div
              className="card cal-day-modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '480px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                padding: '1.25rem',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-glass)',
              }}
            >
              {/* Header ngày modal */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                    {new Date(selectedDayModal + 'T00:00:00').toLocaleDateString('vi-VN', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                  {info?.lunar && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <AppIcon name="moon" size={13} weight="fill" />
                      <span>Âm lịch {info.lunar.day}/{info.lunar.month}{info.lunar.leap ? ' (nhuận)' : ''}</span>
                      {info.holiday && (
                        <span style={{ color: info.holidayType === 'fun' ? 'var(--purple-light)' : 'var(--gold-dim)', fontWeight: 600, marginLeft: '0.35rem' }}>
                          · {info.holidayType === 'fun' ? '⚡ ' : '★ '}{info.holiday}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setSelectedDayModal(null)}
                  style={{ padding: '4px', borderRadius: '50%' }}
                  aria-label="Đóng"
                >
                  <AppIcon name="x" size={16} />
                </button>
              </div>

              {/* Nút thêm việc */}
              <div style={{ marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSelectedDayModal(null);
                    onQuickCreate?.(selectedDayModal, '09:00');
                  }}
                  style={{ width: '100%', justifyContent: 'center', padding: '0.45rem', fontSize: '0.84rem' }}
                >
                  <AppIcon name="plus" size={15} /> Thêm nhiệm vụ ngày này
                </button>
              </div>

              {/* Danh sách công việc của ngày */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '2px' }}>
                {selectedTasks.length === 0 && selectedPending.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    Không có nhiệm vụ nào trong ngày này.
                  </div>
                )}

                {/* Tasks đang chờ làm */}
                {selectedPending.map((task) => (
                  <div
                    key={task.id}
                    className="cal-day-modal__task-item"
                    onClick={() => {
                      setSelectedDayModal(null);
                      onSelectTask?.(task);
                    }}
                    style={{
                      background: 'rgba(3, 155, 229, 0.08)',
                      border: '1px solid rgba(3, 155, 229, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.6rem 0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <AppIcon name="clock" size={15} style={{ color: '#039be5' }} />
                      <span>{task.title}</span>
                    </div>
                    {task.due_time && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {task.due_time.substring(0, 5)}
                      </span>
                    )}
                  </div>
                ))}

                {/* Tasks đã hoàn thành */}
                {selectedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="cal-day-modal__task-item"
                    onClick={() => {
                      setSelectedDayModal(null);
                      onSelectTask?.(task);
                    }}
                    style={{
                      background: 'rgba(24, 128, 56, 0.08)',
                      border: '1px solid rgba(24, 128, 56, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.6rem 0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                      <AppIcon name="checkCircle" size={15} style={{ color: '#188038' }} />
                      <span>{task.title}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {task.completed_at && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(task.completed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {onDeleteTask && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTask(task, selectedDayModal);
                          }}
                          className="btn btn-ghost"
                          style={{ padding: '2px 4px', color: 'var(--text-muted)' }}
                          title="Xóa"
                        >
                          <AppIcon name="trash" size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

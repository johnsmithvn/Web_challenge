import { useState, useMemo, useEffect, useCallback } from 'react';
import { toDateStr, mondayIndex } from '../utils/dateUtils';
import '../styles/calendar.css';

const VN_HOLIDAYS = {
  '01-01': '🎆 Tết Dương Lịch',
  '04-30': '🎖 Giải Phóng Miền Nam',
  '05-01': '👷 Quốc Tế Lao Động',
  '09-02': '🇻🇳 Quốc Khánh',
  '10-20': '🌺 Ngày Phụ Nữ VN',
  '11-20': '📚 Ngày Nhà Giáo',
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return mondayIndex(new Date(year, month, 1)); // Monday = 0
}

/**
 * MonthCalendar — lịch tháng, dùng ở 2 chế độ:
 *
 * - **habit mode** (truyền `habitData`): ô tô xanh/đỏ theo ngày tick đủ habit.
 *   Dùng ở /tracker và /life-log.
 * - **task mode** (KHÔNG truyền `habitData`): ô tô theo số task đã xong hôm đó,
 *   hiện chip tên task ngay trong ô. Dùng ở /tasks (v4.29.0).
 *
 * Khi feature habit bị cắt, xoá nhánh habit là xong — không có prop cấu hình.
 */
export default function MonthCalendar({ habitData, getCompletedTasksRange, skipLog = {}, onDayClick }) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected,  setSelected]  = useState(null);
  const [tasksByDay, setTasksByDay] = useState({});
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  const habitMode = !!habitData;
  const daysInMonth  = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfW  = getFirstDayOfWeek(viewYear, viewMonth);
  const monthLabel   = new Date(viewYear, viewMonth).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  const pad = (n) => String(n).padStart(2, '0');

  // 1 query cho cả tháng rồi group theo ngày ĐỊA PHƯƠNG (không phải UTC).
  useEffect(() => {
    if (!getCompletedTasksRange) return;
    let stale = false;
    const start = `${viewYear}-${pad(viewMonth + 1)}-01`;
    const end   = `${viewYear}-${pad(viewMonth + 1)}-${pad(getDaysInMonth(viewYear, viewMonth))}`;
    getCompletedTasksRange(start, end).then(rows => {
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
  }, [viewYear, viewMonth, getCompletedTasksRange]);

  // Compute day data
  const dayData = useMemo(() => {
    const map = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
      const holiday = VN_HOLIDAYS[`${pad(viewMonth + 1)}-${pad(d)}`];
      const tasks   = tasksByDay[dateStr] || [];
      const done    = habitMode ? (habitData?.[dateStr] ?? false) : tasks.length > 0;
      map[d] = { dateStr, done, holiday, tasks };
    }
    return map;
  }, [viewYear, viewMonth, daysInMonth, habitMode, habitData, tasksByDay]);

  const todayStr = toDateStr(today);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  // Stats for this month
  const doneCount   = Object.values(dayData).filter(d => d.done).length;
  const totalPassed = Object.values(dayData).filter(d => new Date(d.dateStr) <= today).length;
  const monthPct    = totalPassed ? Math.round((doneCount / totalPassed) * 100) : 0;
  const taskTotal   = Object.values(dayData).reduce((s, d) => s + d.tasks.length, 0);

  // Build grid: blanks + days
  const cells = [...Array(firstDayOfW).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // Data cho cả tháng đã có sẵn → chọn ngày chỉ là toggle, không fetch.
  const handleSelectDay = useCallback((dateStr) => {
    setExpandedTaskId(null);
    setSelected(prev => (prev === dateStr ? null : dateStr));
    onDayClick?.(dateStr);
  }, [onDayClick]);

  const selectedTasks = selected ? (tasksByDay[selected] || []) : [];

  // Reset selection when changing months
  useEffect(() => {
    setSelected(null);
    setExpandedTaskId(null);
  }, [viewYear, viewMonth]);

  return (
    <div className="month-calendar card">
      {/* Header */}
      <div className="cal-header">
        <button className="cal-nav-btn" onClick={prevMonth} id="cal-prev">‹</button>
        <div className="cal-title-group">
          <h3 className="cal-title">{monthLabel}</h3>
          <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
            onClick={goToday} id="cal-today-btn">
            Hôm nay
          </button>
        </div>
        <button className="cal-nav-btn" onClick={nextMonth} id="cal-next">›</button>
      </div>

      {/* Month stats */}
      <div className="cal-month-stats">
        <div className="cal-stat">
          <span className="cal-stat__val" style={{ color: 'var(--green)' }}>
            {habitMode ? doneCount : taskTotal}
          </span>
          <span className="cal-stat__label">{habitMode ? 'Ngày done' : 'Task xong'}</span>
        </div>
        {/* Task mode bỏ progress bar: % ngày-có-task không phải mục tiêu nào cả,
            và thanh 6% trong track rộng nhìn như đang lỗi. */}
        <div className="cal-stat-bar">
          {habitMode && (
            <div className="progress-bar-track" style={{ height: 6 }}>
              <div className="progress-bar-fill" style={{ width: `${monthPct}%` }} />
            </div>
          )}
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {habitMode ? `${monthPct}% tháng này` : `${doneCount} ngày có việc xong`}
          </span>
        </div>
        <div className="cal-stat">
          <span className="cal-stat__val" style={{ color: habitMode ? 'var(--red)' : 'var(--purple-light)' }}>
            {habitMode ? totalPassed - doneCount : (doneCount ? Math.round(taskTotal / doneCount * 10) / 10 : 0)}
          </span>
          <span className="cal-stat__label">{habitMode ? 'Ngày miss' : 'TB / ngày'}</span>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="cal-weekdays">
        {WEEKDAYS.map(d => <div key={d} className="cal-weekday">{d}</div>)}
      </div>

      {/* Day grid */}
      <div className="cal-grid">
        {cells.map((day, i) => {
          if (!day) return <div key={`blank-${i}`} className="cal-cell cal-cell--blank" />;

          const info     = dayData[day];
          const isToday  = info.dateStr === todayStr;
          const isFuture = new Date(info.dateStr) > today;
          const isSelected = selected === info.dateStr;

          // Task mode: ô trống là bình thường (không phải "miss"), nên không tô đỏ.
          const stateClass = info.done
            ? 'cal-cell--done'
            : isFuture ? 'cal-cell--future'
            : habitMode ? 'cal-cell--miss' : 'cal-cell--empty';

          return (
            <div
              key={day}
              className={[
                'cal-cell',
                stateClass,
                habitMode ? '' : 'cal-cell--tasks',
                isToday    ? 'cal-cell--today'    : '',
                isSelected ? 'cal-cell--selected' : '',
              ].join(' ')}
              onClick={() => handleSelectDay(info.dateStr)}
              id={`cal-day-${info.dateStr}`}
              role="button"
              title={info.holiday || `${info.dateStr}${info.tasks.length ? ` — ${info.tasks.length} task xong` : ''}`}
            >
              <span className="cal-cell__num">{day}</span>

              {/* habit mode giữ dot; task mode hiện chip tên task như Google Calendar */}
              {habitMode
                ? info.done && <span className="cal-cell__dot" />
                : info.tasks.length > 0 && (
                    <span className="cal-cell__chips">
                      {info.tasks.slice(0, 2).map(t => (
                        <span key={t.id} className="cal-chip" title={t.title}>{t.title}</span>
                      ))}
                      {info.tasks.length > 2 && (
                        <span className="cal-chip cal-chip--more">+{info.tasks.length - 2} nữa</span>
                      )}
                    </span>
                  )}

              {info.holiday && <span className="cal-cell__holiday" title={info.holiday}>🔴</span>}
            </div>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selected && (
        <div className="cal-day-detail">
          <strong>{new Date(selected).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
          {habitMode && (dayData[new Date(selected).getDate()]?.done
            ? <span style={{ color: 'var(--green)' }}>✅ Đã hoàn thành</span>
            : <span style={{ color: 'var(--text-muted)' }}>❌ Chưa hoàn thành</span>
          )}
          {dayData[new Date(selected).getDate()]?.holiday && (
            <span style={{ color: '#fbbf24' }}>{dayData[new Date(selected).getDate()].holiday}</span>
          )}



          {/* Skip reason for this day */}
          {skipLog[selected] && (
            <div style={{
              marginTop: '0.5rem', padding: '0.5rem 0.75rem',
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--red)', marginBottom: '0.2rem' }}>
                📝 Lý do bỏ: {skipLog[selected].reason}
              </div>
              {skipLog[selected].note && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {skipLog[selected].note}
                </div>
              )}
            </div>
          )}

          {/* Completed tasks for this day */}
          {!habitMode && selectedTasks.length === 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>
              Không có task nào hoàn thành ngày này.
            </span>
          )}
          {selectedTasks.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{
                fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)',
                marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}>
                📌 Nhiệm vụ đã hoàn thành ({selectedTasks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {selectedTasks.map(task => (
                  <div key={task.id} style={{
                    background: 'rgba(0,255,136,0.04)',
                    border: '1px solid rgba(0,255,136,0.1)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.5rem 0.6rem',
                    cursor: task.description ? 'pointer' : 'default',
                  }}
                  onClick={() => task.description && setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        ✅ {task.title}
                        {task.description && (
                          <span style={{ fontSize: '0.68rem', marginLeft: '0.3rem', color: 'var(--text-muted)' }}>
                            {expandedTaskId === task.id ? '▾' : '▸'}
                          </span>
                        )}
                      </span>
                      {task.completed_at && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {new Date(task.completed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {expandedTaskId === task.id && task.description && (
                      <div style={{
                        marginTop: '0.35rem',
                        padding: '0.4rem 0.5rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {task.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="cal-legend">
        {habitMode ? (
          <>
            <span><span className="cal-dot cal-dot--done"/> Done</span>
            <span><span className="cal-dot cal-dot--miss"/> Miss</span>
          </>
        ) : (
          <span><span className="cal-dot cal-dot--done"/> Có task xong</span>
        )}
        <span><span className="cal-dot cal-dot--future"/> Chưa tới</span>
        <span>🔴 Ngày lễ</span>
      </div>
    </div>
  );
}

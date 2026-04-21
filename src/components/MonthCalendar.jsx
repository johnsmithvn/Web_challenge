import { useState, useMemo, useEffect, useCallback } from 'react';
import { useCustomHabits } from '../hooks/useCustomHabits';
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
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Monday = 0
}

export default function MonthCalendar({ habitData, getCompletedTasks }) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected,  setSelected]  = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  const { activeHabits } = useCustomHabits();

  const daysInMonth  = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfW  = getFirstDayOfWeek(viewYear, viewMonth);
  const monthLabel   = new Date(viewYear, viewMonth).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  // Compute day data
  const dayData = useMemo(() => {
    const map = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const holiday = VN_HOLIDAYS[`${String(viewMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`];
      const done    = habitData?.[dateStr] ?? false;
      map[d] = { dateStr, done, holiday };
    }
    return map;
  }, [viewYear, viewMonth, habitData]);

  const todayStr = today.toISOString().split('T')[0];

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

  // Build grid: blanks + days
  const cells = [...Array(firstDayOfW).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // Fetch completed tasks when a day is selected
  const handleSelectDay = useCallback(async (dateStr) => {
    if (selected === dateStr) {
      setSelected(null);
      setSelectedTasks([]);
      setExpandedTaskId(null);
      return;
    }
    setSelected(dateStr);
    setExpandedTaskId(null);
    setSelectedTasks([]);

    if (getCompletedTasks) {
      setLoadingTasks(true);
      try {
        const tasks = await getCompletedTasks(dateStr);
        setSelectedTasks(tasks || []);
      } catch {
        setSelectedTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    }
  }, [selected, getCompletedTasks]);

  // Reset tasks when changing months
  useEffect(() => {
    setSelected(null);
    setSelectedTasks([]);
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
          <span className="cal-stat__val" style={{ color: 'var(--green)' }}>{doneCount}</span>
          <span className="cal-stat__label">Ngày done</span>
        </div>
        <div className="cal-stat-bar">
          <div className="progress-bar-track" style={{ height: 6 }}>
            <div className="progress-bar-fill" style={{ width: `${monthPct}%` }} />
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{monthPct}% tháng này</span>
        </div>
        <div className="cal-stat">
          <span className="cal-stat__val" style={{ color: 'var(--red)' }}>
            {totalPassed - doneCount}
          </span>
          <span className="cal-stat__label">Ngày miss</span>
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

          return (
            <div
              key={day}
              className={[
                'cal-cell',
                info.done ? 'cal-cell--done' : isFuture ? 'cal-cell--future' : 'cal-cell--miss',
                isToday    ? 'cal-cell--today'    : '',
                isSelected ? 'cal-cell--selected' : '',
              ].join(' ')}
              onClick={() => handleSelectDay(info.dateStr)}
              id={`cal-day-${info.dateStr}`}
              role="button"
              title={info.holiday || info.dateStr}
            >
              <span className="cal-cell__num">{day}</span>
              {info.done && <span className="cal-cell__dot" />}
              {info.holiday && <span className="cal-cell__holiday" title={info.holiday}>🔴</span>}
            </div>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selected && (
        <div className="cal-day-detail">
          <strong>{new Date(selected).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
          {dayData[new Date(selected).getDate()]?.done
            ? <span style={{ color: 'var(--green)' }}>✅ Đã hoàn thành</span>
            : <span style={{ color: 'var(--text-muted)' }}>❌ Chưa hoàn thành</span>
          }
          {dayData[new Date(selected).getDate()]?.holiday && (
            <span style={{ color: '#fbbf24' }}>{dayData[new Date(selected).getDate()].holiday}</span>
          )}

          {/* Completed tasks for this day */}
          {loadingTasks && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>
              ⏳ Đang tải nhiệm vụ...
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
        <span><span className="cal-dot cal-dot--done"/> Done</span>
        <span><span className="cal-dot cal-dot--miss"/> Miss</span>
        <span><span className="cal-dot cal-dot--future"/> Chưa tới</span>
        <span>🔴 Ngày lễ</span>
      </div>
    </div>
  );
}

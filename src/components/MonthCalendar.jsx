import { useState, useMemo, useEffect, useCallback } from 'react';
import { toDateStr, mondayIndex } from '../utils/dateUtils';
import { solarToLunar, lunarLabel } from '../utils/lunarUtils';
import { useConfirm } from './ConfirmModal';
import UI_STRINGS from '../data/ui-strings.json';
import HOLIDAYS from '../data/holidays.json';
import AppIcon from './AppIcon';
import '../styles/calendar.css';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Số chip task hiện tối đa trong 1 ô — chiều cao ô cố định (calendar.css) được
// tính vừa đúng 4 chip + dòng "+N nữa", đổi số này thì đổi luôn chiều cao đó.
const MAX_CHIPS = 4;

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return mondayIndex(new Date(year, month, 1)); // Monday = 0
}

/**
 * MonthCalendar — lịch tháng cho /tasks: hiển thị task pending/completed,
 * ngày âm và holiday; chip dư được gom theo sức chứa cố định của ô.
 */
export default function MonthCalendar({ getCompletedTasksRange, onDeleteTask, pendingTasks, onDayClick }) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected,  setSelected]  = useState(null);
  const [tasksByDay, setTasksByDay] = useState({});
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const { confirm, ConfirmModal } = useConfirm();

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

  // Task chưa hoàn thành, group theo due_date — pendingTasks đã fetch đầy đủ
  // (không giới hạn ngày) ở useUserTasks nên không cần query riêng cho lịch.
  const pendingByDay = useMemo(() => {
    if (!pendingTasks) return {};
    const map = {};
    for (const t of pendingTasks) {
      if (!t.due_date) continue;
      (map[t.due_date] ||= []).push(t);
    }
    return map;
  }, [pendingTasks]);

  // Compute day data — kèm âm lịch + ngày lễ (lễ dương HOẶC lễ âm).
  const dayData = useMemo(() => {
    const map = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
      const lunar   = solarToLunar(d, viewMonth + 1, viewYear);
      // Tháng nhuận KHÔNG tính lễ: Tết tháng 1 nhuận không phải Tết.
      const lunarKey = lunar.leap ? null : `${pad(lunar.month)}-${pad(lunar.day)}`;
      const holiday = HOLIDAYS.solar[`${pad(viewMonth + 1)}-${pad(d)}`]
        || (lunarKey ? HOLIDAYS.lunar[lunarKey] : null)
        || null;
      const tasks   = tasksByDay[dateStr] || [];
      const pending = pendingByDay[dateStr] || [];
      const done    = tasks.length > 0;
      map[d] = { dateStr, done, holiday, lunar, tasks, pending };
    }
    return map;
  }, [viewYear, viewMonth, daysInMonth, tasksByDay, pendingByDay]);

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
  const taskTotal   = Object.values(dayData).reduce((s, d) => s + d.tasks.length, 0);

  // Build grid: blanks + days
  const cells = [...Array(firstDayOfW).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // Data cho cả tháng đã có sẵn → chọn ngày chỉ là toggle, không fetch.
  const handleSelectDay = useCallback((dateStr) => {
    setExpandedTaskId(null);
    setSelected(prev => (prev === dateStr ? null : dateStr));
    onDayClick?.(dateStr);
  }, [onDayClick]);

  const selectedTasks   = selected ? (tasksByDay[selected] || []) : [];
  const selectedPending = selected ? (pendingByDay[selected] || []) : [];

  // Xoá task đã hoàn thành ngay từ panel chi tiết ngày (task mode only).
  const handleDeleteTask = useCallback(async (task, dateStr) => {
    if (!onDeleteTask) return;
    const cfg = UI_STRINGS.confirm.deleteTask;
    const ok = await confirm({
      ...cfg,
      message: cfg.message.replace('{name}', task.title),
    });
    if (!ok) return;
    const deleted = await onDeleteTask(task.id);
    if (deleted !== false) {
      setTasksByDay(prev => ({
        ...prev,
        [dateStr]: (prev[dateStr] || []).filter(t => t.id !== task.id),
      }));
      setExpandedTaskId(prev => (prev === task.id ? null : prev));
    }
  }, [confirm, onDeleteTask]);

  // Reset selection when changing months
  useEffect(() => {
    setSelected(null);
    setExpandedTaskId(null);
  }, [viewYear, viewMonth]);

  return (
    <div className="month-calendar card">
      {ConfirmModal}
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
          <span className="cal-stat__val" style={{ color: 'var(--green)' }}>{taskTotal}</span>
          <span className="cal-stat__label">Task xong</span>
        </div>
        {/* Cố ý KHÔNG có progress bar: % ngày-có-task không phải mục tiêu nào cả,
            và thanh 6% trong track rộng nhìn như đang lỗi. */}
        <div className="cal-stat-bar">
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {doneCount} ngày có việc xong
          </span>
        </div>
        <div className="cal-stat">
          <span className="cal-stat__val" style={{ color: 'var(--purple-light)' }}>
            {doneCount ? Math.round(taskTotal / doneCount * 10) / 10 : 0}
          </span>
          <span className="cal-stat__label">TB / ngày</span>
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

          // Ô trống là bình thường (không phải "miss"), nên không tô đỏ.
          const stateClass = info.done
            ? 'cal-cell--done'
            : isFuture ? 'cal-cell--future' : 'cal-cell--empty';

          // 1 danh sách chip: xong trước (xanh), sắp tới sau (tím) — trước đây
          // ngày vừa có việc xong vừa có việc sắp tới thì chip tím bị nuốt hẳn.
          const chips = [
            ...info.tasks.map(t => ({ ...t, _done: true })),
            ...info.pending.map(t => ({ ...t, _done: false })),
          ];
          const chipLimit = info.holiday ? MAX_CHIPS - 1 : MAX_CHIPS;
          const shown = chips.slice(0, chipLimit);

          return (
            <div
              key={day}
              className={[
                'cal-cell',
                stateClass,
                'cal-cell--tasks',
                isToday    ? 'cal-cell--today'    : '',
                isSelected ? 'cal-cell--selected' : '',
                info.holiday ? 'cal-cell--holiday' : '',
              ].join(' ')}
              onClick={() => handleSelectDay(info.dateStr)}
              id={`cal-day-${info.dateStr}`}
              role="button"
              title={[
                info.dateStr,
                `Âm lịch ${info.lunar.day}/${info.lunar.month}${info.lunar.leap ? ' (nhuận)' : ''}`,
                info.holiday,
                info.tasks.length ? `${info.tasks.length} task xong` : null,
              ].filter(Boolean).join(' — ')}
            >
              <span className="cal-cell__head">
                <span className="cal-cell__num">{day}</span>
                <span className="cal-cell__lunar">{lunarLabel(info.lunar)}</span>
              </span>

              {/* Chip tên task như Google Calendar */}
              {shown.length > 0 && (
                <span className="cal-cell__chips">
                  {shown.map(t => (
                    <span key={t.id} className={`cal-chip${t._done ? '' : ' cal-chip--pending'}`} title={t.title}>{t.title}</span>
                  ))}
                  {chips.length > chipLimit && (
                    <span className="cal-chip cal-chip--more">+{chips.length - chipLimit} nữa…</span>
                  )}
                </span>
              )}

              {info.holiday && (
                <span className="cal-cell__holiday" title={info.holiday}>
                  <AppIcon name="star" size={11} weight="fill" />
                  <span className="cal-cell__holiday-name">{info.holiday}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selected && (
        <div className="cal-day-detail">
          {/* Cắt chuỗi thay vì new Date(selected).getDate(): chuỗi 'YYYY-MM-DD'
              được parse theo UTC nên getDate() lệch 1 ngày ở múi âm. */}
          {(() => {
            const info = dayData[Number(selected.slice(8, 10))];
            return (
              <div className="cal-day-detail__head">
                <strong>{new Date(selected + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                {info && (
                  <span className="cal-day-detail__lunar">
                    <AppIcon name="moon" size={13} weight="fill" /> Âm lịch {info.lunar.day}/{info.lunar.month}{info.lunar.leap ? ' (nhuận)' : ''}
                  </span>
                )}
                {info?.holiday && (
                  <span className="cal-day-detail__holiday">
                    <AppIcon name="star" size={13} weight="fill" /> {info.holiday}
                  </span>
                )}
              </div>
            );
          })()}



          {/* Tasks ngày này — 1 danh sách duy nhất (đã xong + chưa xong trộn chung).
              Trạng thái đã thể hiện qua màu chip trên lưới lịch rồi nên không tách
              tiêu đề riêng ở đây nữa, chỉ liệt kê hết task của ngày. */}
          {selectedTasks.length === 0 && selectedPending.length === 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>
              Không có task nào ngày này.
            </span>
          )}
          {(selectedTasks.length > 0 || selectedPending.length > 0) && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{
                fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)',
                marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}>
                <AppIcon name="pushPin" size={14} /> Nhiệm vụ ngày này ({selectedTasks.length + selectedPending.length})
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <AppIcon name="checkCircle" size={14} /> {task.title}
                        {task.description && (
                          <span style={{ fontSize: '0.68rem', marginLeft: '0.3rem', color: 'var(--text-muted)' }}>
                            {expandedTaskId === task.id ? '▾' : '▸'}
                          </span>
                        )}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                        {task.completed_at && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {new Date(task.completed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {onDeleteTask && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(task, selected); }}
                            title="Xoá task này"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: '0.78rem', color: 'var(--text-muted)', opacity: 0.6,
                              padding: '0.1rem 0.2rem',
                            }}
                          ><AppIcon name="trash" size={14} /></button>
                        )}
                      </div>
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
                {selectedPending.map(task => (
                  <div key={task.id} style={{
                    background: 'rgba(139,92,246,0.04)',
                    border: '1px solid rgba(139,92,246,0.12)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.5rem 0.6rem',
                    fontSize: '0.82rem', color: 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                  }}>
                    <AppIcon name="clock" size={14} weight="bold" /> {task.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="cal-legend">
        <span><span className="cal-dot cal-dot--done"/> Có task xong</span>
        <span><span className="cal-dot cal-dot--pending"/> Sắp tới / chưa xong</span>
        <span><span className="cal-dot cal-dot--future"/> Chưa tới</span>
        <span><AppIcon name="star" size={11} weight="fill" /> Ngày lễ</span>
        <span><AppIcon name="moon" size={11} weight="fill" /> Số nhỏ góc phải = ngày âm</span>
      </div>
    </div>
  );
}

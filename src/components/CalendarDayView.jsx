import { useState, useMemo, useEffect, useRef } from 'react';
import { toDateStr } from '../utils/dateUtils';
import { solarToLunar, getCanChiDay, getZodiacHours } from '../utils/lunarUtils';
import HOLIDAYS from '../data/holidays.json';
import {
  bucketTasksByDay,
  computeDayLayout,
  getTaskVisualStatus,
  taskDayMark,
  slotTimeFromOffset,
  taskDragStart,
  dropZoneProps,
} from '../utils/calendarTimeUtils';
import '../styles/week-calendar.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PX_PER_HOUR = 60; // 60px cho 1 giờ ở view ngày rộng rãi
const MARKER_ICON = { deadline: '⏰ ', start: '▶ ' }; // mốc ngắn (computeDayLayout `kind`)

/**
 * CalendarDayView — Chế độ xem Lịch Ngày 1 cột với timeline 24h chi tiết chuẩn mockup Aurora.
 * Tích hợp dải 12 giờ hoàng đạo, dải giờ hoàng đạo trên timeline và cột Việc chưa xếp giờ.
 */
export default function CalendarDayView({
  pendingTasks = [],
  getCompletedTasksRange,
  onSelectTask,
  onQuickCreate,
  onSlotCreate,
  currentDate = new Date(),
  holidayToggles = { solar: true, lunar: true, international: true, japan: false, fun: true, custom: true },
  customAnniversaries = [],
  refreshKey = 0,
  onRescheduleTask,
}) {
  const [completedTasks, setCompletedTasks] = useState([]);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  const scrollRef = useRef(null);
  const hasAutoScrolled = useRef(false);

  const targetDate = useMemo(() => {
    const d = new Date(currentDate || new Date());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  const dateStr = useMemo(() => toDateStr(targetDate), [targetDate]);
  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const isToday = dateStr === todayStr;

  // Cập nhật vạch đỏ thời gian thực mỗi 60 giây
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Tự động cuộn đến khung giờ hiện tại khi mở view
  useEffect(() => {
    if (!scrollRef.current || hasAutoScrolled.current) return;
    const targetScroll = isToday ? Math.max(0, (nowMinutes / 60) * PX_PER_HOUR - 180) : 8 * PX_PER_HOUR;
    scrollRef.current.scrollTop = targetScroll;
    hasAutoScrolled.current = true;
  }, [isToday, nowMinutes]);

  // Tải completed tasks có khoảng KẾ HOẠCH
  useEffect(() => {
    if (!getCompletedTasksRange) return;
    let stale = false;
    getCompletedTasksRange(dateStr, dateStr, { byPlan: true }).then((res) => {
      if (!stale) setCompletedTasks(res || []);
    });
    return () => { stale = true; };
  }, [getCompletedTasksRange, dateStr, refreshKey]);

  // Gom tasks của ngày
  const dayPending = useMemo(() => {
    return bucketTasksByDay(pendingTasks, dateStr, dateStr)[dateStr] || [];
  }, [pendingTasks, dateStr]);

  const [yy, mm, dd] = dateStr.split('-').map(Number);
  const zodiacHours = useMemo(() => getZodiacHours(dd, mm, yy), [dd, mm, yy]);
  const hoangDaoBands = useMemo(() => {
    const bands = [];
    for (const zh of zodiacHours) {
      if (zh.isHoangDao) {
        if (zh.startHour === 23) {
          bands.push({ start: 23, end: 24, name: zh.name });
          bands.push({ start: 0, end: 1, name: zh.name });
        } else {
          bands.push({ start: zh.startHour, end: zh.endHour, name: zh.name });
        }
      }
    }
    return bands;
  }, [zodiacHours]);

  const allDayHolidays = useMemo(() => {
    const dd = targetDate.getDate();
    const mm = targetDate.getMonth() + 1;
    const yy = targetDate.getFullYear();

    const solarKey = `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const solarH = HOLIDAYS.solar[solarKey];

    const lunar = solarToLunar(dd, mm, yy);
    const lunarKey = `${String(lunar.month).padStart(2, '0')}-${String(lunar.day).padStart(2, '0')}`;
    const lunarH = HOLIDAYS.lunar[lunarKey];

    const list = [];
    if (holidayToggles?.custom !== false && Array.isArray(customAnniversaries)) {
      for (const anniv of customAnniversaries) {
        if (!anniv || !anniv.title) continue;
        let isMatch = false;
        if (anniv.calType === 'solar') {
          isMatch = Number(anniv.day) === dd && Number(anniv.month) === mm;
        } else if (anniv.calType === 'lunar') {
          isMatch = Number(anniv.day) === lunar.day && Number(anniv.month) === lunar.month;
        }
        if (isMatch) {
          let extraNote = '';
          if (anniv.year && Number(anniv.year) > 0) {
            const passedYears = yy - Number(anniv.year);
            if (passedYears > 0) extraNote = ` (${passedYears} năm)`;
          }
          list.push({
            title: `${anniv.icon || '💖'} ${anniv.title}${extraNote}`,
            type: 'custom',
          });
        }
      }
    }

    if (holidayToggles?.solar !== false && solarH) list.push({ title: solarH, type: 'solar' });
    if (holidayToggles?.lunar !== false && lunarH) list.push({ title: lunarH, type: 'lunar' });
    if (holidayToggles?.international !== false && HOLIDAYS.international?.[solarKey]) {
      list.push({ title: HOLIDAYS.international[solarKey], type: 'international' });
    }
    if (holidayToggles?.japan && HOLIDAYS.japan?.[solarKey]) list.push({ title: HOLIDAYS.japan[solarKey], type: 'japan' });
    if (holidayToggles?.fun && HOLIDAYS.fun?.[solarKey]) list.push({ title: HOLIDAYS.fun[solarKey], type: 'fun' });
    return list;
  }, [targetDate, holidayToggles, customAnniversaries]);

  // Phân bổ layout các task có giờ
  const combinedTasks = useMemo(() => {
    return [...dayPending, ...completedTasks];
  }, [dayPending, completedTasks]);

  const { allDayTasks, timedTasks } = useMemo(() => {
    return computeDayLayout(combinedTasks, dateStr, 30, PX_PER_HOUR);
  }, [combinedTasks, dateStr]);

  // Các task cả ngày đã hoàn thành (chỉ các task đã xong mới hiện chip ở hàng Cả ngày trên header)
  const allDayDoneTasks = useMemo(() => {
    return allDayTasks.filter((t) => t.completed || t.status === 'completed' || t.status === 'done');
  }, [allDayTasks]);

  // Việc chưa xếp giờ trong ngày + các việc quá hạn (nếu là hôm nay) để hiển thị ở panel phải
  const unscheduledTasks = useMemo(() => {
    // Lấy từ allDayTasks (computeDayLayout) thay vì đọc due_time/start_time thô:
    // việc nhiều ngày có giờ ở ngày đầu/cuối vẫn là "cả ngày" ở các ngày giữa.
    const dayUnscheduled = allDayTasks.filter((t) => {
      const isDone = t.status === 'completed' || t.status === 'done' || t.completed;
      return !isDone && t.status !== 'skip';
    });

    let overdueList = [];
    if (isToday) {
      overdueList = pendingTasks.filter((t) => {
        const isDone = t.status === 'completed' || t.status === 'done' || t.completed;
        const isSkip = t.status === 'skip';
        if (isDone || isSkip) return false;
        return t.due_date && t.due_date < todayStr;
      });
    }

    const combined = [...overdueList, ...dayUnscheduled];
    return combined.sort((a, b) => {
      const ad = a.due_date || '9999-99-99';
      const bd = b.due_date || '9999-99-99';
      if (ad !== bd) return ad.localeCompare(bd);
      return (b.priority || 0) - (a.priority || 0);
    });
  }, [allDayTasks, pendingTasks, isToday, todayStr]);

  const canChiDay = useMemo(() => {
    return getCanChiDay(targetDate.getDate(), targetDate.getMonth() + 1, targetDate.getFullYear());
  }, [targetDate]);

  return (
    <div className="cal-day-view" role="region" aria-label="Lịch ngày 24 giờ">
      {/* Header ngày */}
      <div className="cal-day-view__header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div className="cal-day-view__date-badge">
            <span className="cal-day-view__weekday">
              {targetDate.toLocaleDateString('vi-VN', { weekday: 'long' })}
            </span>
            <span className={`cal-day-view__num${isToday ? ' cal-day-view__num--today' : ''}`}>
              {targetDate.getDate()}
            </span>
            <span className="cal-day-view__canchi">Ngày {canChiDay.full}</span>
          </div>

          {/* Khu vực sự kiện cả ngày: ngày lễ & các việc cả ngày đã làm xong */}
          {(allDayHolidays.length > 0 || allDayDoneTasks.length > 0) && (
            <div className="cal-day-view__allday-row">
              <span className="cal-day-view__allday-label">Cả ngày</span>
              <div className="cal-day-view__allday-chips">
                {allDayHolidays.map((h, i) => (
                  <div key={i} className={`week-cal__holiday-chip week-cal__holiday-chip--${h.type}`}>
                    {h.title}
                  </div>
                ))}
                {allDayDoneTasks.map((t) => {
                  const status = getTaskVisualStatus(t, todayStr, nowMinutes);
                  const p = Math.max(0, Math.min(5, Number(t.priority) || 0));
                  const statusClass = status === 'done'
                    ? 'week-cal__chip-allday--done'
                    : status === 'overdue'
                    ? 'week-cal__chip-allday--overdue'
                    : `week-cal__chip-allday--p${p}`;
                  return (
                    <div
                      key={t.id}
                      className={`week-cal__chip-allday ${statusClass}`}
                      onClick={() => onSelectTask && onSelectTask(t)}
                      title={t.title}
                    >
                      {status === 'done' ? '✓ ' : status === 'overdue' ? '⚠️ ' : taskDayMark(t, dateStr)}{t.title}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Dải 12 giờ hoàng đạo (Zodiac badges) chuẩn mockup */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '2px',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tk-text-mute)', flexShrink: 0 }}>
            Giờ hoàng đạo:
          </span>
          {zodiacHours.map((zh) => (
            <span
              key={zh.name}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 7px',
                borderRadius: '6px',
                fontSize: '11px',
                flexShrink: 0,
                background: zh.isHoangDao ? 'var(--tk-ks-today-bg)' : 'var(--tk-border-soft, rgba(255, 255, 255, 0.04))',
                border: `1px solid ${zh.isHoangDao ? 'var(--tk-ks-today-bd)' : 'var(--tk-border, rgba(255, 255, 255, 0.06))'}`,
                color: zh.isHoangDao ? 'var(--tk-ks-today-fg)' : 'var(--tk-text-mute)',
                fontWeight: zh.isHoangDao ? 600 : 400,
              }}
              title={`${zh.name} (${zh.range}): ${zh.isHoangDao ? 'Hoàng đạo' : 'Hắc đạo'}`}
            >
              <span>{zh.name}</span>
              <span style={{ fontSize: '9.5px', opacity: 0.75 }}>{zh.range}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Khung nội dung 2 cột: Timeline 24h bên trái + Panel Việc chưa xếp giờ bên phải */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Khung timeline cuộn 24 giờ */}
        <div className="cal-day-view__scroll-body" ref={scrollRef} style={{ flex: 1 }}>
          <div className="cal-day-view__grid" style={{ height: `${24 * PX_PER_HOUR}px` }}>
            {/* Cột nhãn giờ bên trái */}
            <div className="cal-day-view__time-col">
              {HOURS.map((h) => (
                <div key={h} className="cal-day-view__time-label" style={{ top: `${h * PX_PER_HOUR}px` }}>
                  {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                </div>
              ))}
            </div>

            {/* Canvas chính chứa slot giờ, dải hoàng đạo và các task */}
            <div
              className="cal-day-view__canvas"
              {...(onRescheduleTask
                ? dropZoneProps((id, e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onRescheduleTask(id, dateStr, slotTimeFromOffset(e.clientY - rect.top, PX_PER_HOUR));
                  })
                : {})}
            >
              {/* Dải bóng giờ hoàng đạo (Bands) */}
              {isToday &&
                hoangDaoBands.map((bd, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: `${bd.start * PX_PER_HOUR}px`,
                      height: `${(bd.end - bd.start) * PX_PER_HOUR}px`,
                      background: 'var(--tk-ks-today-tint)',
                      borderLeft: '2px solid rgba(251, 191, 36, 0.3)',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '12px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'var(--tk-ks-today-fg)',
                        opacity: 0.85,
                      }}
                    >
                      Hoàng đạo · {bd.name}
                    </span>
                  </div>
                ))}

              {HOURS.map((h) => (
                <div
                  key={h}
                  className="cal-day-view__hour-line"
                  style={{ top: `${h * PX_PER_HOUR}px`, height: `${PX_PER_HOUR}px` }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickY = e.clientY - rect.top;
                    const isBottomHalf = clickY > PX_PER_HOUR / 2;
                    const timeStr = `${String(h).padStart(2, '0')}:${isBottomHalf ? '30' : '00'}`;
                    if (onSlotCreate) onSlotCreate(dateStr, timeStr);
                    else if (onQuickCreate) onQuickCreate(dateStr, timeStr);
                  }}
                  title={`Nhấn để tạo công việc lúc ${String(h).padStart(2, '0')}:00`}
                >
                  <div className="cal-day-view__half-hour-line" />
                </div>
              ))}

              {/* Vạch đỏ thời gian thực */}
              {isToday && (
                <div
                  className="cal-day-view__now-line"
                  style={{ top: `${(nowMinutes / 60) * PX_PER_HOUR}px` }}
                >
                  <div className="cal-day-view__now-dot" />
                </div>
              )}

              {/* Các task có giờ */}
              {timedTasks.map((t) => {
                const visualStatus = getTaskVisualStatus(t, todayStr, nowMinutes);
                const p = Math.max(0, Math.min(5, Number(t.priority) || 0));
                const statusClass = visualStatus === 'done'
                  ? 'week-cal__event--done'
                  : visualStatus === 'overdue'
                  ? 'week-cal__event--overdue'
                  : `week-cal__event--p${p}`;

                return (
                  <div
                    key={t.id}
                    className={`week-cal__event ${statusClass}${t._layout.kind !== 'block' ? ' week-cal__event--marker' : ''}`}
                    draggable={visualStatus !== 'done' && !!onRescheduleTask}
                    onDragStart={(e) => taskDragStart(e, t)}
                    style={{
                      top: `${t._layout.top}px`,
                      height: `${Math.max(26, t._layout.height)}px`,
                      left: t._layout.left,
                      width: t._layout.width,
                      zIndex: 3,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectTask) onSelectTask(t);
                    }}
                    title={`${t.title} (${t._layout.timeRangeLabel})`}
                  >
                    <div className="week-cal__event-title">
                      {visualStatus === 'done' ? '✓ ' : visualStatus === 'overdue' ? '⚠️ ' : MARKER_ICON[t._layout.kind] || ''}{t.title}
                    </div>
                    {t._layout.height >= 34 && (
                      <div className="week-cal__event-time">{t._layout.timeRangeLabel}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel Việc Chưa Xếp Giờ bên phải */}
        {(
          <div
            className="cal-day-view__unscheduled-panel"
            {...(onRescheduleTask ? dropZoneProps((id) => onRescheduleTask(id, dateStr, null)) : {})}
            style={{
              width: '260px',
              borderLeft: '1px solid var(--tk-border-soft, rgba(255,255,255,0.08))',
              background: 'var(--tk-card-bg, rgba(14,19,36,0.5))',
              display: 'flex',
              flexDirection: 'column',
              padding: '12px',
              gap: '10px',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--tk-text-mute, #8A93AD)',
                }}
              >
                CHƯA XẾP GIỜ
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  background: 'var(--tk-border-soft, rgba(255,255,255,0.08))',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  color: 'var(--tk-text-sub, #AEB6CC)',
                }}
              >
                {unscheduledTasks.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {unscheduledTasks.map((t) => {
                const isLate = t.due_date && t.due_date < todayStr && !t.completed && t.status !== 'skip';
                return (
                  <div
                    key={t.id}
                    draggable={!!onRescheduleTask}
                    onDragStart={(e) => taskDragStart(e, t)}
                    onClick={() => onSelectTask?.(t)}
                    style={{
                      position: 'relative',
                      padding: '8px 10px 8px 12px',
                      borderRadius: '10px',
                      background: isLate ? 'var(--tk-ks-late-tint)' : 'var(--tk-card-bg, rgba(255,255,255,0.03))',
                      border: `1px solid ${isLate ? 'var(--tk-ks-late-bd)' : 'var(--tk-border, rgba(255,255,255,0.07))'}`,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '2.5px',
                        background: isLate ? 'var(--tk-ks-late-fg)' : (t.priority >= 3 ? 'var(--tk-ks-late-fg)' : 'var(--tk-st-todo)'),
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: isLate ? 'var(--tk-ks-late-fg)' : 'var(--tk-text-main, #E8ECF7)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                      >
                        {t.title}
                      </div>
                      {isLate && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: 'var(--tk-ks-late-bg)',
                            color: 'var(--tk-ks-late-fg)',
                            flexShrink: 0,
                          }}
                        >
                          Quá hạn
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--tk-text-sub, #8A93AD)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {t.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

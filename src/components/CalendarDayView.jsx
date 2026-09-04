import { useState, useMemo, useEffect, useRef } from 'react';
import { toDateStr } from '../utils/dateUtils';
import { solarToLunar, getCanChiDay } from '../utils/lunarUtils';
import HOLIDAYS from '../data/holidays.json';
import {
  computeDayLayout,
  getTaskVisualStatus,
} from '../utils/calendarTimeUtils';
import AppIcon from './AppIcon';
import '../styles/week-calendar.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PX_PER_HOUR = 60; // 60px cho 1 giờ ở view ngày rộng rãi

/**
 * CalendarDayView — Chế độ xem Lịch Ngày 1 cột với timeline 24h chi tiết (Ảnh 2).
 * Tái sử dụng thuật toán chia cột tránh đè task, all-day bar và vạch đỏ thời gian thực.
 */
export default function CalendarDayView({
  pendingTasks = [],
  getCompletedTasksRange,
  onSelectTask,
  onQuickCreate,
  currentDate = new Date(),
  holidayToggles = { solar: true, lunar: true, international: true, japan: false, fun: true, custom: true },
  customAnniversaries = [],
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

  // Tải completed tasks cho ngày đang chọn
  useEffect(() => {
    if (!getCompletedTasksRange) return;
    getCompletedTasksRange(dateStr, dateStr).then((res) => {
      setCompletedTasks(res || []);
    });
  }, [getCompletedTasksRange, dateStr]);

  // Gom tasks của ngày
  const dayPending = useMemo(() => {
    return pendingTasks.filter((t) => t.due_date === dateStr);
  }, [pendingTasks, dateStr]);

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
    // 1. Ngày kỷ niệm cá nhân
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
    return computeDayLayout(combinedTasks, 45, PX_PER_HOUR);
  }, [combinedTasks]);

  const canChiDay = useMemo(() => {
    return getCanChiDay(targetDate.getDate(), targetDate.getMonth() + 1, targetDate.getFullYear());
  }, [targetDate]);

  return (
    <div className="cal-day-view" role="region" aria-label="Lịch ngày 24 giờ">
      {/* Header ngày */}
      <div className="cal-day-view__header">
        <div className="cal-day-view__date-badge">
          <span className="cal-day-view__weekday">
            {targetDate.toLocaleDateString('vi-VN', { weekday: 'long' })}
          </span>
          <span className={`cal-day-view__num${isToday ? ' cal-day-view__num--today' : ''}`}>
            {targetDate.getDate()}
          </span>
          <span className="cal-day-view__canchi">Ngày {canChiDay.full}</span>
        </div>

        {/* Khu vực sự kiện cả ngày */}
        {(allDayHolidays.length > 0 || allDayTasks.length > 0) && (
          <div className="cal-day-view__allday-row">
            <span className="cal-day-view__allday-label">Cả ngày</span>
            <div className="cal-day-view__allday-chips">
              {allDayHolidays.map((h, i) => (
                <div key={i} className={`week-cal__holiday-chip week-cal__holiday-chip--${h.type}`}>
                  {h.title}
                </div>
              ))}
              {allDayTasks.map((t) => (
                <div
                  key={t.id}
                  className={`week-cal__task-chip week-cal__task-chip--p${t.priority || 4}${t.completed ? ' week-cal__task-chip--done' : ''}`}
                  onClick={() => onSelectTask && onSelectTask(t)}
                >
                  {t.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Khung timeline cuộn 24 giờ */}
      <div className="cal-day-view__scroll-body" ref={scrollRef}>
        <div className="cal-day-view__grid" style={{ height: `${24 * PX_PER_HOUR}px` }}>
          {/* Cột nhãn giờ bên trái */}
          <div className="cal-day-view__time-col">
            {HOURS.map((h) => (
              <div key={h} className="cal-day-view__time-label" style={{ top: `${h * PX_PER_HOUR}px` }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Canvas chính chứa slot giờ và các task */}
          <div className="cal-day-view__canvas">
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
                  if (onQuickCreate) onQuickCreate(dateStr, timeStr);
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
                  className={`week-cal__event ${statusClass}`}
                  style={{
                    top: `${t._layout.top}px`,
                    height: `${Math.max(26, t._layout.height)}px`,
                    left: t._layout.left,
                    width: t._layout.width,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectTask) onSelectTask(t);
                  }}
                  title={`${t.title} (${t._layout.timeRangeLabel})`}
                >
                  <div className="week-cal__event-title">
                    {visualStatus === 'done' ? '✓ ' : visualStatus === 'overdue' ? '⚠️ ' : ''}{t.title}
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
    </div>
  );
}

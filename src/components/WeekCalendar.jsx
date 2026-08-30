import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { toDateStr } from '../utils/dateUtils';
import { solarToLunar, lunarLabel } from '../utils/lunarUtils';
import HOLIDAYS from '../data/holidays.json';
import {
  getWeekDays,
  computeDayLayout,
  getTaskVisualStatus,
} from '../utils/calendarTimeUtils';
import AppIcon from './AppIcon';
import '../styles/week-calendar.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PX_PER_HOUR = 54; // Chiều cao 1 giờ chuẩn Google Calendar

/**
 * WeekCalendar — Lịch Tuần Time-Grid chuẩn phong cách Google Calendar.
 * Tích hợp hiển thị ngày lễ (Quốc khánh), hỗ trợ bắt đầu từ Chủ Nhật hoặc Thứ 2,
 * vạch đỏ thời gian thực, thẻ màu sắc phẳng đậm đà chữ trắng tương phản cao.
 */
export default function WeekCalendar({
  pendingTasks = [],
  getCompletedTasksRange,
  onSelectTask,
  onQuickCreate,
  calendarView = 'week',
  onSwitchView,
  currentDate,
  startOnSunday: propStartOnSunday,
  hideToolbar = false,
}) {
  const today = new Date();
  const [internalBaseDate, setBaseDate] = useState(today);
  const baseDate = currentDate || internalBaseDate;

  const [completedByDay, setCompletedByDay] = useState({});
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  // Mặc định tuần bắt đầu từ Chủ Nhật (Sunday) giống Google Calendar trong ảnh của user
  const [internalStartOnSunday, setInternalStartOnSunday] = useState(() => {
    const saved = localStorage.getItem('lh_cal_start_sun');
    return saved !== null ? saved === 'true' : true;
  });

  const startOnSunday = propStartOnSunday !== undefined ? propStartOnSunday : internalStartOnSunday;

  const scrollRef = useRef(null);
  const hasAutoScrolled = useRef(false);
  const todayStr = useMemo(() => toDateStr(new Date()), []);

  const toggleStartDay = () => {
    setInternalStartOnSunday((prev) => {
      const next = !prev;
      localStorage.setItem('lh_cal_start_sun', String(next));
      return next;
    });
  };

  // Cập nhật vạch thời gian thực tế mỗi 60 giây
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Tự động cuộn mượt đến khung giờ hiện tại khi mở Lịch Tuần
  useEffect(() => {
    if (scrollRef.current && !hasAutoScrolled.current) {
      hasAutoScrolled.current = true;
      // Cuộn đến trước giờ hiện tại 2 tiếng (hoặc tối thiểu mốc 7h sáng nếu dậy sớm)
      const targetMinutes = Math.max(0, nowMinutes - 120);
      const targetScrollTop = (targetMinutes / 60) * 54;
      scrollRef.current.scrollTop = targetScrollTop;
    }
  }, [nowMinutes]);

  // Mảng 7 ngày của tuần đang chọn kèm tính toán Âm lịch
  const weekDays = useMemo(() => {
    const rawDays = getWeekDays(baseDate, startOnSunday);
    return rawDays.map((day) => {
      const d = day.date;
      try {
        const lunar = solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
        const lunarText = lunar ? lunarLabel(lunar) : '';
        const isFirstLunarDay = lunar?.day === 1;
        return { ...day, lunar, lunarText, isFirstLunarDay };
      } catch {
        return { ...day, lunar: null, lunarText: '', isFirstLunarDay: false };
      }
    });
  }, [baseDate, startOnSunday]);

  const startWeekStr = weekDays[0]?.dateStr;
  const endWeekStr = weekDays[6]?.dateStr;

  // Tính ngày lễ cho từng ngày trong tuần (phân loại official & fun/dev)
  const holidaysMap = useMemo(() => {
    const map = {};
    const pad = (n) => String(n).padStart(2, '0');

    for (const day of weekDays) {
      const d = day.date;
      const m = d.getMonth() + 1;
      const dt = d.getDate();
      const y = d.getFullYear();
      const solarKey = `${pad(m)}-${pad(dt)}`;

      // 1. Kiểm tra ngày lễ chính thống dương lịch
      if (HOLIDAYS.solar[solarKey]) {
        map[day.dateStr] = { name: HOLIDAYS.solar[solarKey], type: 'official' };
        continue;
      }

      // 2. Kiểm tra ngày lễ âm lịch
      try {
        const lunar = solarToLunar(dt, m, y);
        if (lunar && !lunar.leap) {
          const lunarKey = `${pad(lunar.month)}-${pad(lunar.day)}`;
          if (HOLIDAYS.lunar[lunarKey]) {
            map[day.dateStr] = { name: HOLIDAYS.lunar[lunarKey], type: 'official' };
            continue;
          }
        }
      } catch {
        // Safe catch
      }

      // 3. Kiểm tra ngày lễ kỷ niệm vui / Dev / Quốc tế Nam giới
      if (HOLIDAYS.fun && HOLIDAYS.fun[solarKey]) {
        map[day.dateStr] = { name: HOLIDAYS.fun[solarKey], type: 'fun' };
      }
    }
    return map;
  }, [weekDays]);

  // Tự động tải task hoàn thành trong dải 7 ngày của tuần
  useEffect(() => {
    if (!getCompletedTasksRange || !startWeekStr || !endWeekStr) return;
    let stale = false;
    getCompletedTasksRange(startWeekStr, endWeekStr).then((rows) => {
      if (stale) return;
      const map = {};
      for (const r of rows || []) {
        if (!r.completed_at) continue;
        const key = toDateStr(new Date(r.completed_at));
        (map[key] ||= []).push(r);
      }
      setCompletedByDay(map);
    });
    return () => { stale = true; };
  }, [startWeekStr, endWeekStr, getCompletedTasksRange]);

  // Gom nhóm pending tasks theo due_date
  const pendingByDay = useMemo(() => {
    const map = {};
    for (const t of pendingTasks) {
      if (!t.due_date) continue;
      (map[t.due_date] ||= []).push(t);
    }
    return map;
  }, [pendingTasks]);

  // Tự động cuộn đến 7:00 AM (hoặc giờ hiện tại nếu trong khoảng 7h-21h) lúc mở lần đầu
  useEffect(() => {
    if (!hasAutoScrolled.current && scrollRef.current) {
      const targetHour = Math.max(7, Math.min(20, Math.floor(nowMinutes / 60) - 1));
      scrollRef.current.scrollTop = targetHour * PX_PER_HOUR;
      hasAutoScrolled.current = true;
    }
  }, [nowMinutes]);

  // Điều hướng tuần
  const goToday = () => setBaseDate(new Date());
  const prevWeek = () => {
    setBaseDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };
  const nextWeek = () => {
    setBaseDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  // Tiêu đề dải tuần phong cách Google (VD: "Thg 8 – Thg 9, 2026" hoặc "24 – 30 tháng 8, 2026")
  const weekLabel = useMemo(() => {
    if (!weekDays.length) return '';
    const d1 = weekDays[0].date;
    const d2 = weekDays[6].date;
    const m1 = d1.toLocaleDateString('vi-VN', { month: 'short' });
    const m2 = d2.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' });
    if (d1.getMonth() === d2.getMonth()) {
      return `${d1.getDate()} – ${d2.getDate()} ${m2}`;
    }
    return `${m1} – ${m2}`;
  }, [weekDays]);

  // Tính layout (tọa độ + chia cột trùng giờ) cho từng ngày
  const dayLayouts = useMemo(() => {
    const result = {};
    for (const day of weekDays) {
      const dStr = day.dateStr;
      const combined = [
        ...(pendingByDay[dStr] || []),
        ...(completedByDay[dStr] || []),
      ];
      result[dStr] = computeDayLayout(combined, 45, PX_PER_HOUR);
    }
    return result;
  }, [weekDays, pendingByDay, completedByDay]);

  // Xử lý khi click vào ô trống trong lưới giờ
  const handleGridClick = useCallback((e, dateStr) => {
    if (e.target.closest('.week-cal__event')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickedMinutes = Math.floor((offsetY / PX_PER_HOUR) * 60);

    const roundedMins = Math.floor(clickedMinutes / 30) * 30;
    const h = String(Math.floor(roundedMins / 60)).padStart(2, '0');
    const m = String(roundedMins % 60).padStart(2, '0');
    const timeStr = `${h}:${m}`;

    onQuickCreate?.(dateStr, timeStr);
  }, [onQuickCreate]);

  return (
    <div className="week-cal">
      {/* ── Toolbar điều hướng trên cùng (ẩn khi dùng CalendarToolbar chung) ── */}
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
                onClick={prevWeek}
                aria-label="Tuần trước"
              >
                <AppIcon name="caretLeft" size={16} />
              </button>
              <button
                type="button"
                className="week-cal__btn-nav"
                onClick={nextWeek}
                aria-label="Tuần sau"
              >
                <AppIcon name="caretRight" size={16} />
              </button>
            </div>
            <span className="week-cal__title">{weekLabel}</span>
          </div>

          {/* Tùy chọn đầu tuần & Legend màu sắc */}
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

            {/* Bộ chuyển đổi Tuần / Tháng */}
            <div className="week-cal__view-switch" role="tablist" aria-label="Chế độ lịch">
              <button
                type="button"
                role="tab"
                aria-selected={calendarView === 'week'}
                className={`week-cal__view-btn${calendarView === 'week' ? ' week-cal__view-btn--active' : ''}`}
                onClick={() => onSwitchView?.('week')}
              >
                Tuần
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={calendarView === 'month'}
                className={`week-cal__view-btn${calendarView === 'month' ? ' week-cal__view-btn--active' : ''}`}
                onClick={() => onSwitchView?.('month')}
              >
                Tháng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scrollable Horizontal Wrapper ───────────────────────────────── */}
      <div className="week-cal__horizontal-scroll">
        <div className="week-cal__inner-container">
          {/* ── Header 7 ngày ─────────────────────────────────────────────── */}
          <div className="week-cal__days-header">
            <div className="week-cal__timezone-slot" />
            {weekDays.map((day) => (
              <div
                key={day.dateStr}
                className={`week-cal__day-head${day.isToday ? ' week-cal__day-head--today' : ''}`}
                onClick={() => onQuickCreate?.(day.dateStr, '09:00')}
                title={`Dương lịch: ${day.dateStr} — Âm lịch: ${day.lunar ? `${day.lunar.day}/${day.lunar.month}${day.lunar.leap ? ' (nhuận)' : ''}` : 'N/A'}`}
              >
                <span className="week-cal__day-name">{day.weekdayName}</span>
                <div className="week-cal__day-num-container">
                  <span className="week-cal__day-num">{day.dayNum}</span>
                  {day.lunarText && (
                    <span
                      className={`week-cal__day-lunar${day.isFirstLunarDay ? ' week-cal__day-lunar--first' : ''}`}
                      title={`Âm lịch: ${day.lunarText}`}
                    >
                      {day.isFirstLunarDay ? day.lunarText : day.lunar?.day}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── All-day Row (Ngày lễ Quốc Khánh + Công việc cả ngày) ────────── */}
          <div className="week-cal__allday-row">
            <div className="week-cal__allday-label">
              <span className="week-cal__gmt-text">GMT+07</span>
            </div>
            {weekDays.map((day) => {
              const layout = dayLayouts[day.dateStr] || { allDayTasks: [] };
              const holidayInfo = holidaysMap[day.dateStr];

              return (
                <div key={`allday-${day.dateStr}`} className="week-cal__allday-cell">
                  {/* Highlight Ngày lễ chính thức HOẶC Ngày kỷ niệm vui / Dev */}
                  {holidayInfo && (
                    <div
                      className={`week-cal__holiday-chip week-cal__holiday-chip--${holidayInfo.type}`}
                      title={`${holidayInfo.type === 'fun' ? 'Dịp đặc biệt / Dev: ' : 'Ngày lễ: '}${holidayInfo.name}`}
                    >
                      <span className="week-cal__holiday-title">
                        {holidayInfo.type === 'fun' ? '⚡ ' : ''}{holidayInfo.name}
                      </span>
                    </div>
                  )}

                  {/* Tasks cả ngày */}
                  {layout.allDayTasks.map((t) => {
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTask?.(t);
                        }}
                        title={t.title}
                      >
                        {status === 'done' ? '✓ ' : status === 'overdue' ? '⚠️ ' : ''}{t.title}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* ── Lưới thời gian cuộn được (Time Grid 24h) ───────────────────── */}
          <div className="week-cal__grid-scroll" ref={scrollRef}>
            <div className="week-cal__grid-body">
              {/* Cột mốc giờ bên trái */}
              <div className="week-cal__time-col">
                {HOURS.map((h) => (
                  <div
                    key={`hour-${h}`}
                    className="week-cal__hour-row"
                    style={{ position: 'relative' }}
                  >
                    {h > 0 && (
                      <span className="week-cal__hour-label">
                        {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* 7 cột ngày */}
              {weekDays.map((day) => {
                const layout = dayLayouts[day.dateStr] || { timedTasks: [] };
                return (
                  <div
                    key={`col-${day.dateStr}`}
                    className={`week-cal__day-col${day.isToday ? ' week-cal__day-col--today' : ''}`}
                    onClick={(e) => handleGridClick(e, day.dateStr)}
                  >
                    {/* Đường kẻ ngang phân giờ sắc nét */}
                    <div className="week-cal__grid-lines">
                      {HOURS.map((h) => (
                        <div key={`line-${h}`} className="week-cal__hour-row" />
                      ))}
                    </div>

                    {/* Vạch đỏ chỉ thời gian thực tế nếu là ngày hôm nay */}
                    {day.isToday && (
                      <div
                        className="week-cal__now-line"
                        style={{ top: `${(nowMinutes / 60) * PX_PER_HOUR}px` }}
                      >
                        <div className="week-cal__now-dot" />
                      </div>
                    )}

                    {/* Các khối task theo giờ (Flat Google Calendar design) */}
                    {layout.timedTasks.map((t) => {
                      const status = getTaskVisualStatus(t, todayStr, nowMinutes);
                      const p = Math.max(0, Math.min(5, Number(t.priority) || 0));
                      const statusClass = status === 'done'
                        ? 'week-cal__event--done'
                        : status === 'overdue'
                        ? 'week-cal__event--overdue'
                        : `week-cal__event--p${p}`;

                      return (
                        <div
                          key={t.id}
                          className={`week-cal__event ${statusClass}`}
                          style={{
                            top: `${t._layout.top}px`,
                            height: `${t._layout.height}px`,
                            left: t._layout.left,
                            width: t._layout.width,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTask?.(t);
                          }}
                          title={`${t.title} (${t._layout.timeRangeLabel})`}
                        >
                          <div className="week-cal__event-title">
                            {status === 'done' ? '✓ ' : status === 'overdue' ? '⚠️ ' : ''}{t.title}
                          </div>
                          {t._layout.height >= 34 && (
                            <div className="week-cal__event-time">
                              {t._layout.timeRangeLabel}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

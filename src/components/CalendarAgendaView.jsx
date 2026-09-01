import { useState, useEffect, useMemo } from 'react';
import { toDateStr } from '../utils/dateUtils';
import { solarToLunar } from '../utils/lunarUtils';
import HOLIDAYS from '../data/holidays.json';
import AppIcon from './AppIcon';
import '../styles/calendar-widget.css';

/**
 * CalendarAgendaView — Chế độ xem "Lịch biểu" (Agenda View) theo phong cách lichamviet (Ảnh 1).
 * Hiển thị danh sách cuộn liên tục theo từng ngày liên tiếp:
 * - Cột trái: Số ngày, Thứ, Tháng
 * - Cột phải: Sự kiện cả ngày (Lễ Tết) + Danh sách công việc có deadline
 * - Nếu trống: Hiển thị "Không có sự kiện"
 */
export default function CalendarAgendaView({
  pendingTasks = [],
  getCompletedTasksRange,
  onSelectTask,
  onQuickCreate,
  currentDate = new Date(),
  holidayToggles = { solar: true, lunar: true, international: true, japan: false, fun: true, custom: true },
  customAnniversaries = [],
}) {
  const [completedByDay, setCompletedByDay] = useState({});

  // Tạo dải ngày: từ 3 ngày trước đến 45 ngày tới quanh currentDate
  const days = useMemo(() => {
    const start = new Date(currentDate || new Date());
    start.setDate(start.getDate() - 2);
    start.setHours(0, 0, 0, 0);

    const result = [];
    const todayStr = toDateStr(new Date());

    for (let i = 0; i < 45; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = toDateStr(d);
      const dd = d.getDate();
      const mm = d.getMonth() + 1;
      const yy = d.getFullYear();

      // Kiểm tra ngày lễ
      const solarKey = `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      const solarHoliday = HOLIDAYS.solar[solarKey];

      const lunar = solarToLunar(dd, mm, yy);
      const lunarKey = `${String(lunar.month).padStart(2, '0')}-${String(lunar.day).padStart(2, '0')}`;
      const lunarHoliday = HOLIDAYS.lunar[lunarKey];
      const internationalHoliday = HOLIDAYS.international?.[solarKey];

      const holidays = [];
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
            holidays.push({
              title: `${anniv.icon || '💖'} ${anniv.title}${extraNote}`,
              type: 'custom',
            });
          }
        }
      }

      if (holidayToggles?.solar !== false && solarHoliday) holidays.push({ title: solarHoliday, type: 'solar' });
      if (holidayToggles?.lunar !== false && lunarHoliday) holidays.push({ title: lunarHoliday, type: 'lunar' });
      if (holidayToggles?.international !== false && internationalHoliday) holidays.push({ title: internationalHoliday, type: 'international' });
      if (holidayToggles?.japan && HOLIDAYS.japan?.[solarKey]) holidays.push({ title: HOLIDAYS.japan[solarKey], type: 'japan' });
      if (holidayToggles?.fun && HOLIDAYS.fun?.[solarKey]) holidays.push({ title: HOLIDAYS.fun[solarKey], type: 'fun' });

      const dayName = d.toLocaleDateString('vi-VN', { weekday: 'short' });

      result.push({
        date: d,
        dateStr,
        dayNum: dd,
        monthNum: mm,
        yearNum: yy,
        dayName,
        isToday: dateStr === todayStr,
        lunar,
        holidays,
      });
    }
    return result;
  }, [currentDate, holidayToggles, customAnniversaries]);

  // Tải completed tasks cho khoảng ngày hiển thị
  useEffect(() => {
    if (!getCompletedTasksRange || days.length === 0) return;
    const startStr = days[0].dateStr;
    const endStr = days[days.length - 1].dateStr;

    getCompletedTasksRange(startStr, endStr).then((res) => {
      const map = {};
      for (const t of res || []) {
        if (t.completed_date) {
          if (!map[t.completed_date]) map[t.completed_date] = [];
          map[t.completed_date].push(t);
        }
      }
      setCompletedByDay(map);
    });
  }, [getCompletedTasksRange, days]);

  // Gom pending tasks theo ngày
  const pendingByDay = useMemo(() => {
    const map = {};
    for (const t of pendingTasks) {
      if (t.due_date) {
        if (!map[t.due_date]) map[t.due_date] = [];
        map[t.due_date].push(t);
      }
    }
    return map;
  }, [pendingTasks]);

  return (
    <div className="cal-agenda-view" role="region" aria-label="Lịch biểu chi tiết">
      <div className="cal-agenda-list">
        {days.map((day) => {
          const dayTasks = pendingByDay[day.dateStr] || [];
          const dayCompleted = completedByDay[day.dateStr] || [];
          const hasEvents = day.holidays.length > 0 || dayTasks.length > 0 || dayCompleted.length > 0;

          return (
            <div
              key={day.dateStr}
              className={`cal-agenda-row${day.isToday ? ' cal-agenda-row--today' : ''}`}
              id={`agenda-${day.dateStr}`}
            >
              {/* Cột Ngày bên trái */}
              <div className="cal-agenda-day-col">
                <div className={`cal-agenda-day-badge${day.isToday ? ' cal-agenda-day-badge--today' : ''}`}>
                  {day.dayNum}
                </div>
                <div className="cal-agenda-day-meta">
                  <span className="cal-agenda-day-sub">THG {day.monthNum}, {day.dayName.toUpperCase()}</span>
                  <span className="cal-agenda-lunar-sub">{day.lunar.day}/{day.lunar.month} ÂL</span>
                </div>
              </div>

              {/* Cột Sự kiện & Công việc bên phải */}
              <div className="cal-agenda-content-col">
                {!hasEvents ? (
                  <div className="cal-agenda-empty-slot">
                    <span className="cal-agenda-empty-text">Không có sự kiện</span>
                    <button
                      type="button"
                      className="cal-agenda-add-quick"
                      onClick={() => onQuickCreate && onQuickCreate(day.dateStr, '09:00')}
                      title="Thêm công việc vào ngày này"
                    >
                      <AppIcon name="plus" size={13} /> Thêm việc
                    </button>
                  </div>
                ) : (
                  <div className="cal-agenda-items">
                    {/* Ngày lễ / Sự kiện cả ngày */}
                    {day.holidays.map((h, hIdx) => (
                      <div key={hIdx} className={`cal-agenda-item cal-agenda-item--holiday cal-agenda-item--${h.type}`}>
                        <span className="cal-agenda-dot" />
                        <span className="cal-agenda-badge-allday">Cả ngày</span>
                        <span className="cal-agenda-item-title">{h.title}</span>
                      </div>
                    ))}

                    {/* Công việc chờ làm */}
                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        className={`cal-agenda-item cal-agenda-item--task cal-agenda-item--p${t.priority || 4}`}
                        onClick={() => onSelectTask && onSelectTask(t)}
                        role="button"
                        tabIndex={0}
                      >
                        <span className={`cal-agenda-task-priority-dot cal-agenda-task-priority-dot--p${t.priority || 4}`} />
                        {t.due_time ? (
                          <span className="cal-agenda-time-pill">{t.due_time}</span>
                        ) : (
                          <span className="cal-agenda-badge-allday">Trong ngày</span>
                        )}
                        <span className="cal-agenda-item-title">{t.title}</span>
                      </div>
                    ))}

                    {/* Công việc đã xong */}
                    {dayCompleted.map((t) => (
                      <div
                        key={t.id}
                        className="cal-agenda-item cal-agenda-item--done"
                        onClick={() => onSelectTask && onSelectTask(t)}
                        role="button"
                        tabIndex={0}
                      >
                        <span className="cal-agenda-check-icon">✓</span>
                        <span className="cal-agenda-item-title cal-agenda-item-title--done">{t.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

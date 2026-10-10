import { useState, useEffect, useMemo, useRef } from 'react';
import { toDateStr, formatDate } from '../utils/dateUtils';
import { solarToLunar } from '../utils/lunarUtils';
import { bucketTasksByDay, hasExplicitTime, taskDayRole, taskDragStart, dropZoneProps, buildAgendaRows } from '../utils/calendarTimeUtils';
import { PRIORITY_OPTIONS } from '../utils/taskFields';
import HOLIDAYS from '../data/holidays.json';
import AppIcon from './AppIcon';
import '../styles/calendar-widget.css';

// Nhãn task không giờ trong ngày, theo vai của ngày (taskDayRole) với task nhiều ngày.
const AGENDA_DAY_LABEL = { single: 'Trong ngày', start: '▶ Bắt đầu', middle: '↔ Nhiều ngày', end: '⏰ Hạn' };

/**
 * CalendarAgendaView — Chế độ xem "Lịch biểu" (Agenda View) theo phong cách lichamviet (Ảnh 1).
 * Hiển thị danh sách cuộn liên tục theo từng ngày liên tiếp:
 * - Cột trái: Số ngày, Thứ, Tháng
 * - Cột phải: Sự kiện cả ngày (Lễ Tết) + Danh sách công việc có deadline
 * - Nếu trống: Hiển thị "Không có sự kiện"
 * - Cuộn xuống đáy tự động nạp thêm 10 ngày liên tiếp
 */
export default function CalendarAgendaView({
  pendingTasks = [],
  overdueTasks = [],
  onMoveAllLateToToday,
  getCompletedTasksRange,
  onSelectTask,
  onQuickCreate,
  currentDate = new Date(),
  holidayToggles = { solar: true, lunar: true, international: true, japan: false, fun: true, custom: true },
  customAnniversaries = [],
  refreshKey = 0,
  onRescheduleTask,
}) {
  const [completedByDay, setCompletedByDay] = useState({});
  const [daysCount, setDaysCount] = useState(45);
  const [isLateBannerOpen, setIsLateBannerOpen] = useState(false);
  const isLoadingMore = useRef(false);

  // Reset daysCount về 45 khi currentDate thay đổi
  useEffect(() => {
    setDaysCount(45);
  }, [currentDate]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Khi cuộn gần tới đáy (< 250px) thì tự động load thêm 10 ngày
    if (scrollHeight - scrollTop - clientHeight < 250 && !isLoadingMore.current) {
      isLoadingMore.current = true;
      setDaysCount((prev) => prev + 10);
      setTimeout(() => {
        isLoadingMore.current = false;
      }, 300);
    }
  };

  // Tạo dải ngày: từ 2 ngày trước đến daysCount ngày tới quanh currentDate
  const days = useMemo(() => {
    const start = new Date(currentDate || new Date());
    start.setDate(start.getDate() - 2);
    start.setHours(0, 0, 0, 0);

    const result = [];
    const todayStr = toDateStr(new Date());

    for (let i = 0; i < daysCount; i++) {
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
  }, [currentDate, holidayToggles, customAnniversaries, daysCount]);

  // Tải completed tasks cho khoảng ngày hiển thị — gom theo ngày KẾ HOẠCH (Bắt đầu→Hạn),
  // cùng trục với task chờ làm, nên bấm hoàn thành muộn không làm task nhảy ngày.
  useEffect(() => {
    if (!getCompletedTasksRange || days.length === 0) return;
    let stale = false;
    const startStr = days[0].dateStr;
    const endStr = days[days.length - 1].dateStr;

    getCompletedTasksRange(startStr, endStr, { byPlan: true }).then((res) => {
      if (stale) return;
      setCompletedByDay(bucketTasksByDay(res || [], startStr, endStr));
    });
    return () => { stale = true; };
  }, [getCompletedTasksRange, days, refreshKey]);

  // Gom pending tasks vào mọi ngày đang hiện mà khoảng Bắt đầu→Hạn đi qua
  const pendingByDay = useMemo(
    () => (days.length ? bucketTasksByDay(pendingTasks, days[0].dateStr, days[days.length - 1].dateStr) : {}),
    [pendingTasks, days]
  );

  // Gom theo tuần, gộp các ngày trống liền nhau thành 1 hàng (mockup Lịch biểu)
  const rows = useMemo(() => {
    const countOf = (day) => (pendingByDay[day.dateStr] || []).length + (completedByDay[day.dateStr] || []).length;
    return buildAgendaRows(days, countOf, (day) => day.holidays.length > 0 || countOf(day) > 0, toDateStr(new Date()));
  }, [days, pendingByDay, completedByDay]);

  return (
    <div
      className="cal-agenda-view"
      role="region"
      aria-label="Lịch biểu chi tiết"
      onScroll={handleScroll}
    >
      <div className="cal-agenda-list">
        {/* Banner gom việc quá hạn chuẩn mockup */}
        {overdueTasks.length > 0 && (
          <div
            style={{
              margin: '0 0 16px 0',
              borderRadius: '14px',
              background: 'var(--tk-ks-late-bg)',
              border: '1px solid rgba(255, 92, 112, 0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              onClick={() => setIsLateBannerOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                cursor: 'pointer',
              }}
            >
              <AppIcon name="warning" size={16} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tk-ks-late-fg)' }}>
                {overdueTasks.length} việc quá hạn
              </span>
              <span style={{ fontSize: '12px', color: 'var(--tk-text-mute)' }}>
                {(() => {
                  const oldest = overdueTasks.reduce((m, t) => (t.due_date && (!m || t.due_date < m) ? t.due_date : m), null);
                  return oldest ? `cũ nhất từ ${Number(oldest.slice(8, 10))}/${Number(oldest.slice(5, 7))}` : '';
                })()}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveAllLateToToday?.();
                }}
                style={{
                  marginLeft: 'auto',
                  height: '28px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 92, 112, 0.4)',
                  background: 'var(--tk-ks-late-bg)',
                  color: 'var(--tk-ks-late-fg)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Chuyển hết về hôm nay
              </button>
            </div>

            {isLateBannerOpen && (
              <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {overdueTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable={!!onRescheduleTask}
                    onDragStart={(e) => taskDragStart(e, t)}
                    onClick={() => onSelectTask?.(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: 'var(--tk-border-soft)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--tk-ks-late-fg)' }} />
                    <span style={{ fontSize: '12.5px', color: 'var(--tk-text-main)', flex: 1 }}>{t.title}</span>
                    <span style={{ fontSize: '11px', color: 'var(--tk-ks-late-fg)' }}>{formatDate(t.due_date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {rows.map((row) => {
          if (row.kind === 'week') {
            return (
              <div key={`w-${row.key}`} className="cal-agenda-week">
                <span>{row.label}</span>
                <span className="cal-agenda-week__count">{row.count} việc</span>
              </div>
            );
          }
          if (row.kind === 'gap') {
            return (
              <div
                key={`g-${row.from}`}
                className="cal-agenda-gap"
                {...(onRescheduleTask ? dropZoneProps((id) => onRescheduleTask(id, row.from)) : {})}
              >
                <span>{row.label}</span>
                <button
                  type="button"
                  className="cal-agenda-add-quick"
                  onClick={() => onQuickCreate && onQuickCreate(row.from, '09:00')}
                  title="Thêm công việc"
                >
                  <AppIcon name="plus" size={13} />
                </button>
              </div>
            );
          }
          const { day } = row;
          const dayTasks = pendingByDay[day.dateStr] || [];
          const dayCompleted = completedByDay[day.dateStr] || [];
          const hasEvents = day.holidays.length > 0 || dayTasks.length > 0 || dayCompleted.length > 0;

          return (
            <div
              key={day.dateStr}
              className={`cal-agenda-row${day.isToday ? ' cal-agenda-row--today' : ''}`}
              id={`agenda-${day.dateStr}`}
              {...(onRescheduleTask ? dropZoneProps((id) => onRescheduleTask(id, day.dateStr)) : {})}
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
                        className="cal-agenda-item cal-agenda-item--task"
                        draggable={!!onRescheduleTask}
                        onDragStart={(e) => taskDragStart(e, t)}
                        onClick={() => onSelectTask && onSelectTask(t)}
                        role="button"
                        tabIndex={0}
                      >
                        <span
                          className="cal-agenda-task-priority-dot"
                          style={{ background: (PRIORITY_OPTIONS.find((p) => p.value === t.priority) || PRIORITY_OPTIONS[0]).color }}
                        />
                        {t.start_date === t.due_date && t.start_time && hasExplicitTime(t.due_time) ? (
                          <span className="cal-agenda-time-pill" title="Bắt đầu – Hạn">
                            {t.start_time.substring(0, 5)}–{t.due_time.substring(0, 5)}
                          </span>
                        ) : t.due_date === day.dateStr && hasExplicitTime(t.due_time) ? (
                          <span className="cal-agenda-time-pill" title="Giờ hạn">⏰ {t.due_time.substring(0, 5)}</span>
                        ) : t.start_date === day.dateStr && t.start_time ? (
                          <span className="cal-agenda-time-pill" title="Giờ bắt đầu">▶ {t.start_time.substring(0, 5)}</span>
                        ) : (
                          <span className="cal-agenda-badge-allday">
                            {AGENDA_DAY_LABEL[taskDayRole(t, day.dateStr)]}
                          </span>
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

        <div className="cal-agenda-load-more">
          <AppIcon name="arrowsClockwise" size={13} className="spin-slow" />
          <span>Đang hiển thị {daysCount} ngày · Cuộn xuống để tự động nạp thêm 10 ngày tiếp theo</span>
        </div>
      </div>
    </div>
  );
}

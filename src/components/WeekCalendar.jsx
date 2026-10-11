import { useState, useMemo, useEffect, useRef } from 'react';
import { toDateStr } from '../utils/dateUtils';
import { solarToLunar, lunarLabel } from '../utils/lunarUtils';
import HOLIDAYS from '../data/holidays.json';
import {
  getWeekDays,
  bucketTasksByDay,
  computeDayLayout,
  slotTimeFromOffset,
  taskDragStart,
  dropZoneProps,
} from '../utils/calendarTimeUtils';
import { ksStyle, taskCardModel } from '../utils/kanbanUtils';
import AppIcon from './AppIcon';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PX_PER_HOUR = 48; // lưới 48px/giờ như mockup (đường kẻ giờ vẽ bằng CSS cùng bước, xem .tk-wk-col)
const MARKER_MIN = 57; // mốc giờ hạn/bắt đầu cao ~44px như khối trong mockup
const HOLIDAY_ICON = { fun: 'lightning', custom: 'heart' }; // còn lại: ngôi sao
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const pad = (n) => String(n).padStart(2, '0');

/**
 * WeekCalendar — view Tuần theo mockup "Kanban tối & sáng" (chỉ desktop):
 * đầu cột (thứ · số · âm lịch) → hàng Cả ngày (1 sự kiện + việc không giờ) → lưới giờ 48px.
 * Bấm ô giờ / "+N nữa" mở popover Ngày (onOpenDay); kéo việc vào ô giờ / hàng Cả ngày để dời.
 */
export default function WeekCalendar({
  pendingTasks = [],
  getCompletedTasksRange,
  onSelectTask,
  onOpenDay,
  currentDate,
  startOnSunday = true,
  holidayToggles = { solar: true, lunar: true, international: true, japan: false, fun: true, custom: true },
  customAnniversaries = [],
  refreshKey = 0,
  onRescheduleTask,
}) {
  const todayStr = toDateStr();
  const [completedByDay, setCompletedByDay] = useState({});
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  const scrollRef = useRef(null);
  const hasAutoScrolled = useRef(false);

  // Vạch giờ hiện tại cập nhật mỗi phút
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Mở lần đầu: cuộn tới 1 giờ trước hiện tại (trong khoảng 7h–20h)
  useEffect(() => {
    if (hasAutoScrolled.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = Math.max(7, Math.min(20, Math.floor(nowMinutes / 60) - 1)) * PX_PER_HOUR;
    hasAutoScrolled.current = true;
  }, [nowMinutes]);

  const weekDays = useMemo(
    () => getWeekDays(currentDate || new Date(), startOnSunday).map((day) => ({
      ...day,
      lunar: solarToLunar(day.date.getDate(), day.date.getMonth() + 1, day.date.getFullYear()),
    })),
    [currentDate, startOnSunday]
  );
  const startWeekStr = weekDays[0].dateStr;
  const endWeekStr = weekDays[6].dateStr;

  // Ngày lễ / kỷ niệm của từng ngày trong tuần
  const holidaysMap = useMemo(() => {
    const map = {};
    for (const day of weekDays) {
      const d = day.date.getDate();
      const m = day.date.getMonth() + 1;
      const y = day.date.getFullYear();
      const { lunar } = day;
      const solarKey = `${pad(m)}-${pad(d)}`;
      const holidays = [];
      if (holidayToggles?.custom !== false && Array.isArray(customAnniversaries)) {
        for (const anniv of customAnniversaries) {
          if (!anniv || !anniv.title) continue;
          const isMatch = anniv.calType === 'solar'
            ? Number(anniv.day) === d && Number(anniv.month) === m
            : anniv.calType === 'lunar' && Number(anniv.day) === lunar.day && Number(anniv.month) === lunar.month;
          if (!isMatch) continue;
          const years = anniv.year && Number(anniv.year) > 0 ? y - Number(anniv.year) : 0;
          holidays.push({ name: `${anniv.icon || '💖'} ${anniv.title}${years > 0 ? ` (${years} năm)` : ''}`, type: 'custom' });
        }
      }
      if (holidayToggles?.solar !== false && HOLIDAYS.solar[solarKey]) holidays.push({ name: HOLIDAYS.solar[solarKey], type: 'solar' });
      const lunarKey = lunar.leap ? null : `${pad(lunar.month)}-${pad(lunar.day)}`;
      if (holidayToggles?.lunar !== false && lunarKey && HOLIDAYS.lunar[lunarKey]) holidays.push({ name: HOLIDAYS.lunar[lunarKey], type: 'lunar' });
      if (holidayToggles?.international !== false && HOLIDAYS.international?.[solarKey]) holidays.push({ name: HOLIDAYS.international[solarKey], type: 'international' });
      if (holidayToggles?.japan && HOLIDAYS.japan?.[solarKey]) holidays.push({ name: HOLIDAYS.japan[solarKey], type: 'japan' });
      if (holidayToggles?.fun && HOLIDAYS.fun?.[solarKey]) holidays.push({ name: HOLIDAYS.fun[solarKey], type: 'fun' });
      map[day.dateStr] = holidays;
    }
    return map;
  }, [weekDays, holidayToggles, customAnniversaries]);

  // Việc đã xong gom theo ngày KẾ HOẠCH (Bắt đầu→Hạn): nằm đúng ô đã lên lịch
  useEffect(() => {
    if (!getCompletedTasksRange) return undefined;
    let stale = false;
    getCompletedTasksRange(startWeekStr, endWeekStr, { byPlan: true }).then((rows) => {
      if (!stale) setCompletedByDay(bucketTasksByDay(rows || [], startWeekStr, endWeekStr));
    });
    return () => { stale = true; };
  }, [startWeekStr, endWeekStr, getCompletedTasksRange, refreshKey]);

  const pendingByDay = useMemo(
    () => bucketTasksByDay(pendingTasks, startWeekStr, endWeekStr),
    [pendingTasks, startWeekStr, endWeekStr]
  );

  // Bố cục từng ngày: việc có giờ thành khối, còn lại lên hàng Cả ngày
  const dayLayouts = useMemo(() => {
    const openIds = new Set(pendingTasks.map((t) => t.id));
    const result = {};
    for (const day of weekDays) {
      const combined = [
        ...(pendingByDay[day.dateStr] || []),
        ...(completedByDay[day.dateStr] || []).filter((t) => !openIds.has(t.id)),
      ];
      result[day.dateStr] = computeDayLayout(combined, day.dateStr, MARKER_MIN, PX_PER_HOUR);
    }
    return result;
  }, [weekDays, pendingByDay, completedByDay, pendingTasks]);

  const dayClass = (day) => (day.isToday ? ' is-today' : day.date.getDay() === 0 ? ' is-sun' : '');
  const holidayNames = (day) => holidaysMap[day.dateStr].map((h) => h.name);

  return (
    <div className="tk-wk">
      <div className="tk-wk-row tk-wk-head">
        <span />
        {weekDays.map((day) => (
          <div key={day.dateStr} className={`tk-wk-dayhead${day.isToday ? ' is-today' : ''}`}>
            <span className={`tk-wk-dn${dayClass(day)}`}>{day.weekdayName}</span>
            <span className={`tk-wk-num${dayClass(day)}`}>{day.dayNum}</span>
            <span className="tk-wk-lun">{lunarLabel(day.lunar)}</span>
          </div>
        ))}
      </div>

      <div className="tk-wk-row">
        <span className="tk-wk-allday__label">Cả ngày</span>
        {weekDays.map((day) => {
          const hol = holidaysMap[day.dateStr];
          const all = dayLayouts[day.dateStr].allDayTasks;
          const evs = hol.slice(0, 1);
          const pills = all.slice(0, hol.length ? 1 : 2);
          const more = hol.length - evs.length + all.length - pills.length;
          return (
            <div
              key={day.dateStr}
              className={`tk-wk-allcell${day.isToday ? ' is-today' : ''}`}
              {...(onRescheduleTask ? dropZoneProps((id) => onRescheduleTask(id, day.dateStr, null)) : {})}
            >
              {evs.map((h) => (
                <span key={h.name} className="tk-wk-ev" title={h.name}>
                  <AppIcon name={HOLIDAY_ICON[h.type] || 'star'} size={9} weight="fill" />
                  <span className="tk-wk-ev__t">{h.name}</span>
                </span>
              ))}
              {pills.map((t) => {
                const m = taskCardModel(t, todayStr);
                return (
                  <span
                    key={t.id}
                    className="tk-mo-pill"
                    style={ksStyle(m.k)}
                    title={t.title}
                    draggable={!m.done && !!onRescheduleTask}
                    onDragStart={(e) => taskDragStart(e, t)}
                    onClick={() => onSelectTask?.(t)}
                  >
                    <span className={`tk-mo-pill__t${m.done ? ' is-done' : ''}`}>{t.title}</span>
                  </span>
                );
              })}
              {more > 0 && (
                <button type="button" className="tk-mo-more" onClick={(e) => onOpenDay?.(day.dateStr, e, holidayNames(day))}>
                  +{more} nữa
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="tk-wk-scroll" ref={scrollRef}>
        <div className="tk-wk-grid" style={{ height: `${24 * PX_PER_HOUR}px` }}>
          <div className="tk-wk-hours">
            {HOURS.slice(1).map((h) => (
              <span key={h} style={{ top: `${h * PX_PER_HOUR}px` }}>{hm(h * 60)}</span>
            ))}
          </div>

          {weekDays.map((day) => (
            <div
              key={day.dateStr}
              className={`tk-wk-col${day.isToday ? ' is-today' : ''}`}
              title="Bấm để thêm việc vào giờ này"
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const time = slotTimeFromOffset(e.clientY - e.currentTarget.getBoundingClientRect().top, PX_PER_HOUR);
                onOpenDay?.(day.dateStr, e, holidayNames(day), time);
              }}
              {...(onRescheduleTask
                ? dropZoneProps((id, e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onRescheduleTask(id, day.dateStr, slotTimeFromOffset(e.clientY - rect.top, PX_PER_HOUR));
                  })
                : {})}
            >
              {dayLayouts[day.dateStr].timedTasks.map((t) => {
                const m = taskCardModel(t, todayStr);
                const L = t._layout;
                return (
                  <div
                    key={t.id}
                    className={`tk-wk-block${L.height >= 40 ? '' : ' is-short'}`}
                    style={{ ...ksStyle(m.k), top: `${L.top}px`, height: `${L.height}px`, left: L.left, width: `calc(${L.width} - 2px)` }}
                    draggable={!m.done && !!onRescheduleTask}
                    onDragStart={(e) => taskDragStart(e, t)}
                    onClick={() => onSelectTask?.(t)}
                    title={`${t.title} (${L.timeRangeLabel})`}
                  >
                    <span className="tk-wk-block__tm">
                      {L.kind === 'block' ? `${hm(L.startMinutes)}–${hm(L.endMinutes)}` : `${L.kind === 'start' ? '▶ ' : ''}${hm(L.startMinutes)}`}
                    </span>
                    <span className={`tk-wk-block__t${m.done ? ' is-done' : ''}`}>{t.title}</span>
                  </div>
                );
              })}
              {day.isToday && <span className="tk-dv-now" style={{ top: `${(nowMinutes / 60) * PX_PER_HOUR}px` }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

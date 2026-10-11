import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { toDateStr } from '../utils/dateUtils';
import { solarToLunar, lunarLabel } from '../utils/lunarUtils';
import { bucketTasksByDay, hasExplicitTime, holidayDot, taskDragStart, dropZoneProps } from '../utils/calendarTimeUtils';
import { ksStyle, taskCardModel } from '../utils/kanbanUtils';
import HOLIDAYS from '../data/holidays.json';
import AppIcon from './AppIcon';
import TaskCard from './TaskCard';
import '../styles/calendar.css';

const pad = (n) => String(n).padStart(2, '0');

const WEEKDAYS_MON = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAYS_SUN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DFULL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const MAX_CHIPS = 3; // mockup: 3 việc/ô, có sự kiện thì còn 2
const HOLIDAY_ICON = { fun: 'lightning', custom: 'heart' }; // còn lại: ngôi sao

/**
 * MonthCalendar — view Tháng theo mockup "Kanban tối & sáng".
 *   Desktop: lưới kín khung, ô có số + âm lịch + nút +, 1 sự kiện, việc dạng pill màu theo hạn, "+N nữa".
 *   Mobile : lưới gọn (số, âm lịch, chấm màu), chạm chọn ngày → danh sách việc của ngày bên dưới.
 * Nút + / "+N nữa" mở popover Ngày (onOpenDay) do TasksPage vẽ.
 */
export default function MonthCalendar({
  getCompletedTasksRange,
  pendingTasks,
  onSelectTask,
  onOpenDay,
  currentDate,
  setCurrentDate,
  startOnSunday = true,
  holidayToggles = { solar: true, lunar: true, international: true, japan: false, fun: true, custom: true },
  customAnniversaries = [],
  refreshKey = 0,
  onRescheduleTask,
  isMobile = false,
}) {
  const todayStr = toDateStr();
  const view = currentDate || new Date();
  const viewYear = view.getFullYear();
  const viewMonth = view.getMonth();
  const ym = `${viewYear}-${pad(viewMonth + 1)}`;
  const weekdays = startOnSunday ? WEEKDAYS_SUN : WEEKDAYS_MON;

  // Ô lưới: từ đầu tuần chứa ngày 1 tới cuối tuần chứa ngày cuối (ngày tháng trước/sau hiện mờ)
  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const lead = startOnSunday ? first.getDay() : (first.getDay() + 6) % 7;
    const total = Math.ceil((lead + new Date(viewYear, viewMonth + 1, 0).getDate()) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(viewYear, viewMonth, 1 - lead + i);
      return { date: d, dateStr: toDateStr(d), day: d.getDate(), inMonth: d.getMonth() === viewMonth };
    });
  }, [viewYear, viewMonth, startOnSunday]);
  const gridFrom = cells[0].dateStr;
  const gridTo = cells[cells.length - 1].dateStr;

  // Việc đã xong gom theo ngày KẾ HOẠCH (Bắt đầu→Hạn), cùng trục với việc chờ làm
  const [doneByDay, setDoneByDay] = useState({});
  useEffect(() => {
    if (!getCompletedTasksRange) return undefined;
    let stale = false;
    getCompletedTasksRange(gridFrom, gridTo, { byPlan: true }).then((rows) => {
      if (!stale) setDoneByDay(bucketTasksByDay(rows || [], gridFrom, gridTo));
    });
    return () => { stale = true; };
  }, [gridFrom, gridTo, getCompletedTasksRange, refreshKey]);

  const pendingByDay = useMemo(
    () => bucketTasksByDay(pendingTasks || [], gridFrom, gridTo),
    [pendingTasks, gridFrom, gridTo]
  );

  // Dữ liệu từng ô: âm lịch, ngày lễ (chỉ ngày trong tháng), việc (chờ làm + đã xong, sắp theo giờ)
  const dayData = useMemo(() => {
    const openIds = new Set((pendingTasks || []).map((t) => t.id));
    const map = {};
    for (const c of cells) {
      const d = c.day;
      const m = c.date.getMonth() + 1;
      const y = c.date.getFullYear();
      const lunar = solarToLunar(d, m, y);
      const holidays = [];
      if (c.inMonth) {
        const lunarKey = lunar.leap ? null : `${pad(lunar.month)}-${pad(lunar.day)}`;
        const solarKey = `${pad(m)}-${pad(d)}`;
        // Ngày kỷ niệm cá nhân (ưu tiên cao nhất)
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
        if (holidayToggles?.lunar !== false && lunarKey && HOLIDAYS.lunar[lunarKey]) holidays.push({ name: HOLIDAYS.lunar[lunarKey], type: 'lunar' });
        if (holidayToggles?.international !== false && HOLIDAYS.international?.[solarKey]) holidays.push({ name: HOLIDAYS.international[solarKey], type: 'international' });
        if (holidayToggles?.japan && HOLIDAYS.japan?.[solarKey]) holidays.push({ name: HOLIDAYS.japan[solarKey], type: 'japan' });
        if (holidayToggles?.fun && HOLIDAYS.fun?.[solarKey]) holidays.push({ name: HOLIDAYS.fun[solarKey], type: 'fun' });
      }
      const timeOf = (t) => (t.due_date === c.dateStr && hasExplicitTime(t.due_time) ? t.due_time.slice(0, 5) : '');
      const tasks = [
        ...(pendingByDay[c.dateStr] || []),
        ...(doneByDay[c.dateStr] || []).filter((t) => !openIds.has(t.id)),
      ].sort((a, b) => (timeOf(a) || '99').localeCompare(timeOf(b) || '99'));
      map[c.dateStr] = { lunar, holidays, tasks, timeOf };
    }
    return map;
  }, [cells, pendingByDay, doneByDay, pendingTasks, holidayToggles, customAnniversaries]);

  // Lăn chuột trên lưới (desktop) để sang tháng trước / sau
  const wheelLockRef = useRef(false);
  const handleWheel = useCallback((e) => {
    if (Math.abs(e.deltaY) < 25 || wheelLockRef.current || !setCurrentDate) return;
    wheelLockRef.current = true;
    setCurrentDate((prev) => {
      const d = new Date(prev || new Date());
      d.setMonth(d.getMonth() + (e.deltaY > 0 ? 1 : -1), 1);
      return d;
    });
    setTimeout(() => { wheelLockRef.current = false; }, 450);
  }, [setCurrentDate]);

  const openDay = (dateStr) => (e) => onOpenDay?.(dateStr, e, dayData[dateStr].holidays.map((h) => h.name));
  const numClass = (c) => {
    if (c.dateStr === todayStr) return ' is-today';
    if (!c.inMonth) return ' is-out';
    return c.date.getDay() === 0 ? ' is-sun' : '';
  };

  // Mobile: ngày đang chọn (mặc định hôm nay nếu đang xem tháng này, không thì ngày 1)
  const [selDay, setSelDay] = useState(null);
  const sel = selDay?.slice(0, 7) === ym ? selDay : todayStr.slice(0, 7) === ym ? todayStr : `${ym}-01`;

  if (isMobile) {
    const selInfo = dayData[sel];
    const sd = new Date(`${sel}T00:00:00`);
    const open = (t) => () => onSelectTask?.(t);
    return (
      <div className="tk-mo tk-mo--m">
        <div className="tk-mo-mgrid">
          {weekdays.map((w) => (
            <span key={w} className={`tk-mo-mwd${w === 'CN' ? ' is-sun' : ''}`}>{w}</span>
          ))}
          {cells.map((c) => {
            const info = dayData[c.dateStr];
            const dots = [
              ...info.holidays.slice(0, 1).map((h) => holidayDot(h.type)),
              ...info.tasks.slice(0, 3).map((t) => `var(--tk-ks-${taskCardModel(t, todayStr).k}-glow)`),
            ];
            return (
              <button
                key={c.dateStr}
                type="button"
                className={`tk-mo-mcell${c.dateStr === todayStr ? ' is-today' : ''}${c.dateStr === sel ? ' is-sel' : ''}`}
                onClick={() => setSelDay(c.dateStr)}
                {...(onRescheduleTask ? dropZoneProps((id) => onRescheduleTask(id, c.dateStr)) : {})}
              >
                <span className={`tk-mo-num${numClass(c)}`}>{c.day}</span>
                <span className="tk-mo-mlun">{c.inMonth ? lunarLabel(info.lunar) : ''}</span>
                <span className="tk-mo-dots">
                  {dots.map((color, i) => <span key={i} style={{ background: color }} />)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="tk-mo-selhead">
          <span className="tk-mo-selhead__label">{DFULL[sd.getDay()]}, {sd.getDate()}/{sd.getMonth() + 1}</span>
          <span className="tk-mo-selhead__lun">{selInfo.lunar.day}/{selInfo.lunar.month} ÂL</span>
          <button type="button" className="tk-mo-selhead__add" aria-label="Thêm việc vào ngày này" onClick={openDay(sel)}>
            <AppIcon name="plus" size={16} />
          </button>
        </div>
        {selInfo.holidays.map((h, i) => (
          <div key={i} className="tk-mo-ev">
            <span className="tk-mo-ev__dot" style={{ background: holidayDot(h.type) }} />
            {h.name}
          </div>
        ))}
        <div className="tk-mo-sellist">
          {selInfo.tasks.map((t) => (
            <TaskCard key={t.id} variant="mobile" task={t} today={todayStr} onOpen={open(t)} onStatus={open(t)} onDate={open(t)} onPriority={open(t)} />
          ))}
          {selInfo.tasks.length === 0 && selInfo.holidays.length === 0 && (
            <span className="tk-mo-empty">Chưa có việc nào trong ngày.</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="tk-mo" onWheel={handleWheel}>
      <div className="tk-mo-wd">
        {weekdays.map((w) => (
          <span key={w} className={w === 'CN' ? 'is-sun' : undefined}>{w}</span>
        ))}
      </div>
      <div className="tk-mo-grid" style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(0, 1fr))` }}>
        {cells.map((c) => {
          const info = dayData[c.dateStr];
          const chips = info.tasks;
          const holidayCount = Math.min(1, info.holidays.length); // 1 sự kiện/ô, còn lại dồn vào "+N nữa"
          const chipLimit = Math.max(1, MAX_CHIPS - holidayCount);
          const shown = chips.slice(0, chipLimit);
          const more = Math.max(0, chips.length - chipLimit) + info.holidays.length - holidayCount;

          return (
            <div
              key={c.dateStr}
              className={`tk-mo-cell${c.inMonth ? '' : ' is-out'}${c.dateStr === todayStr ? ' is-today' : ''}`}
              title={`${c.dateStr} — Âm lịch ${info.lunar.day}/${info.lunar.month}${info.lunar.leap ? ' (nhuận)' : ''}`}
              {...(onRescheduleTask ? dropZoneProps((id) => onRescheduleTask(id, c.dateStr)) : {})}
            >
              <div className="tk-mo-cell__head">
                <span className={`tk-mo-num${numClass(c)}`}>{c.day}</span>
                {c.inMonth && <span className="tk-mo-lunar">{lunarLabel(info.lunar)}</span>}
                <button type="button" className="tk-mo-add" title="Xem / thêm việc" onClick={openDay(c.dateStr)}>
                  <AppIcon name="plus" size={12} />
                </button>
              </div>

              {info.holidays.slice(0, holidayCount).map((h, hIdx) => (
                <span key={hIdx} className={`cal-cell__holiday cal-cell__holiday--${h.type}`} title={h.name}>
                  <AppIcon name={HOLIDAY_ICON[h.type] || 'star'} size={9} weight="fill" />
                  <span className="cal-cell__holiday-name">{h.name}</span>
                </span>
              ))}

              {shown.map((t) => {
                const m = taskCardModel(t, todayStr);
                const tm = info.timeOf(t);
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
                    {tm && <span className="tk-mo-pill__tm">{tm}</span>}
                    <span className={`tk-mo-pill__t${m.done ? ' is-done' : ''}`}>{t.title}</span>
                  </span>
                );
              })}

              {more > 0 && (
                <button type="button" className="tk-mo-more" onClick={openDay(c.dateStr)}>
                  +{more} nữa
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

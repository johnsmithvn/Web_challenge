import { useState, useEffect, useMemo } from 'react';
import { toDateStr } from '../utils/dateUtils';
import { solarToLunar } from '../utils/lunarUtils';
import { bucketTasksByDay, hasExplicitTime, taskDayRole, taskDragStart, dropZoneProps, buildAgendaRows, holidayDot } from '../utils/calendarTimeUtils';
import { STATUS_META, taskCardModel } from '../utils/kanbanUtils';
import { PRIORITY_LABELS, shiftDateDays } from '../utils/taskNlpParser';
import HOLIDAYS from '../data/holidays.json';
import AppIcon from './AppIcon';
import TaskCard from './TaskCard';
import CalendarNavHead from './CalendarToolbar';

const SPAN = 21; // 3 tuần; "Xem thêm 2 tuần" cộng 14
const DFULL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
// Việc không giờ: nhãn cột giờ theo vai của ngày với việc nhiều ngày (taskDayRole)
const ROLE_LABEL = { single: 'Cả ngày', start: 'Bắt đầu', middle: 'Cả ngày', end: 'Hạn' };

const dm = (v) => `${Number(v.slice(8, 10))}/${Number(v.slice(5, 7))}`;
const byDue = (a, b) => `${a.due_date || '9'}${a.due_time || '99'}`.localeCompare(`${b.due_date || '9'}${b.due_time || '99'}`);

/** Giờ hiện ở cột trái của việc trong ngày: giờ bắt đầu / giờ hạn rơi vào ngày đó, không có → null. */
function timeOf(t, dateStr) {
  if (t.start_date === dateStr && hasExplicitTime(t.start_time)) return t.start_time.slice(0, 5);
  if (t.due_date === dateStr && hasExplicitTime(t.due_time)) return t.due_time.slice(0, 5);
  return null;
}

/**
 * CalendarAgendaView — "Lịch biểu" theo mockup Kanban tối & sáng: từ ngày đang xem tới 3 tuần sau,
 * gom theo tuần; ngày trống liền nhau gộp 1 hàng; banner việc quá hạn ở đầu (mở ra để xem / dời hết).
 * Desktop: cột ngày 132px | danh sách; mobile: khối ngày dọc, việc quá hạn hiện bằng thẻ mobile.
 */
export default function CalendarAgendaView({
  pendingTasks = [],
  allTasks = [],
  onMoveAllLateToToday,
  getCompletedTasksRange,
  onSelectTask,
  onOpenDay,
  currentDate = new Date(),
  setCurrentDate,
  holidayToggles = { solar: true, lunar: true, international: true, japan: false, fun: true, custom: true },
  customAnniversaries = [],
  refreshKey = 0,
  onRescheduleTask,
  isMobile = false,
}) {
  const today = toDateStr();
  const [completedByDay, setCompletedByDay] = useState({});
  const [lateOpen, setLateOpen] = useState(false);
  // "Xem thêm" cộng dồn cho tới khi đổi ngày bắt đầu (‹ › / Hôm nay tạo Date mới) → về 3 tuần
  const [extra, setExtra] = useState({ from: currentDate, days: 0 });
  const span = SPAN + (extra.from === currentDate ? extra.days : 0);

  const days = useMemo(() => {
    const start = new Date(currentDate || new Date());
    start.setHours(0, 0, 0, 0);
    const todayStr = toDateStr(new Date());
    const result = [];

    for (let i = 0; i < span; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = toDateStr(d);
      const dd = d.getDate();
      const mm = d.getMonth() + 1;
      const yy = d.getFullYear();

      const solarKey = `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      const lunar = solarToLunar(dd, mm, yy);
      const lunarKey = `${String(lunar.month).padStart(2, '0')}-${String(lunar.day).padStart(2, '0')}`;

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
            holidays.push({ title: `${anniv.icon || '💖'} ${anniv.title}${extraNote}`, type: 'custom' });
          }
        }
      }

      if (holidayToggles?.solar !== false && HOLIDAYS.solar[solarKey]) holidays.push({ title: HOLIDAYS.solar[solarKey], type: 'solar' });
      if (holidayToggles?.lunar !== false && HOLIDAYS.lunar[lunarKey]) holidays.push({ title: HOLIDAYS.lunar[lunarKey], type: 'lunar' });
      if (holidayToggles?.international !== false && HOLIDAYS.international?.[solarKey]) holidays.push({ title: HOLIDAYS.international[solarKey], type: 'international' });
      if (holidayToggles?.japan && HOLIDAYS.japan?.[solarKey]) holidays.push({ title: HOLIDAYS.japan[solarKey], type: 'japan' });
      if (holidayToggles?.fun && HOLIDAYS.fun?.[solarKey]) holidays.push({ title: HOLIDAYS.fun[solarKey], type: 'fun' });

      result.push({ date: d, dateStr, dayNum: dd, monthNum: mm, isToday: dateStr === todayStr, lunar, holidays });
    }
    return result;
  }, [currentDate, holidayToggles, customAnniversaries, span]);

  // Việc đã xong gom theo ngày KẾ HOẠCH (Bắt đầu→Hạn) — cùng trục với việc chờ làm
  useEffect(() => {
    if (!getCompletedTasksRange || days.length === 0) return undefined;
    let stale = false;
    const startStr = days[0].dateStr;
    const endStr = days[days.length - 1].dateStr;
    getCompletedTasksRange(startStr, endStr, { byPlan: true }).then((res) => {
      if (!stale) setCompletedByDay(bucketTasksByDay(res || [], startStr, endStr));
    });
    return () => { stale = true; };
  }, [getCompletedTasksRange, days, refreshKey]);

  const pendingByDay = useMemo(
    () => (days.length ? bucketTasksByDay(pendingTasks, days[0].dateStr, days[days.length - 1].dateStr) : {}),
    [pendingTasks, days]
  );

  // Việc của 1 ngày: chờ làm + đã xong (bỏ bản "đã xong" cũ của việc vừa mở lại)
  const tasksOfDay = useMemo(() => {
    const openIds = new Set(pendingTasks.map((t) => t.id));
    return (dateStr) => [
      ...(pendingByDay[dateStr] || []),
      ...(completedByDay[dateStr] || []).filter((t) => !openIds.has(t.id)),
    ];
  }, [pendingTasks, pendingByDay, completedByDay]);

  const sections = useMemo(() => {
    const rows = buildAgendaRows(days, (day) => tasksOfDay(day.dateStr).length, (day) => day.holidays.length > 0 || tasksOfDay(day.dateStr).length > 0, today);
    const out = [];
    for (const row of rows) {
      if (row.kind === 'week') out.push({ ...row, rows: [] });
      else out[out.length - 1].rows.push(row);
    }
    return out;
  }, [days, tasksOfDay, today]);

  const late = useMemo(() => pendingTasks.filter((t) => t.due_date && t.due_date < today).sort(byDue), [pendingTasks, today]);

  const subsOf = useMemo(() => {
    const map = new Map();
    for (const t of allTasks) {
      if (!t.parent_task_id) continue;
      const s = map.get(t.parent_task_id) || { n: 0, done: 0 };
      s.n += 1;
      if (t.completed) s.done += 1;
      map.set(t.parent_task_id, s);
    }
    return map;
  }, [allTasks]);

  // Hàng đầu: "Từ hôm nay đến 30/10" · "N việc · M sự kiện"
  const head = useMemo(() => {
    const ids = new Set();
    let events = 0;
    for (const d of days) {
      for (const t of tasksOfDay(d.dateStr)) ids.add(t.id);
      events += d.holidays.length;
    }
    const first = days[0];
    const last = days[days.length - 1];
    return {
      label: `Từ ${first.dateStr === today ? 'hôm nay' : dm(first.dateStr)} đến ${dm(last.dateStr)}`,
      sub: `${ids.size} việc · ${events} sự kiện`,
    };
  }, [days, tasksOfDay, today]);

  const now = new Date();
  const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const tomorrow = shiftDateDays(1, today);
  const open = (t) => () => onSelectTask?.(t);
  const onKeyOpen = (t) => (e) => {
    if (e.key === 'Enter') onSelectTask?.(t);
  };
  const dropTo = (dateStr) => (onRescheduleTask ? dropZoneProps((id) => onRescheduleTask(id, dateStr)) : {});
  const dragOf = (t) => (onRescheduleTask && !t.completed ? { draggable: true, onDragStart: (e) => taskDragStart(e, t) } : {});

  const taskRow = (t, dateStr) => {
    const m = taskCardModel(t, today);
    const st = STATUS_META[m.st];
    const pr = PRIORITY_LABELS[m.priority] || PRIORITY_LABELS[0];
    const tm = timeOf(t, dateStr);
    const subs = subsOf.get(t.id);
    return (
      <div key={`t-${t.id}`} className="tk-ag-task" role="button" tabIndex={0} onClick={open(t)} onKeyDown={onKeyOpen(t)} {...dragOf(t)}>
        <span className={`tk-ag-task__time${tm ? '' : ' is-allday'}`}>{tm || ROLE_LABEL[taskDayRole(t, dateStr)]}</span>
        <span className="tk-ag-task__st" style={{ color: st.color }}>
          <AppIcon name={st.icon} size={isMobile ? 18 : 16} weight={st.weight} />
        </span>
        <span className={`tk-ag-task__title${m.done ? ' is-done' : m.skip ? ' is-skip' : ''}`}>{t.title}</span>
        <span className="tk-ag-task__meta">
          {m.run && (
            <span className="tk-ag-meta">
              <AppIcon name={m.run.icon} size={11.5} />
              {m.run.text}
            </span>
          )}
          {subs && (
            <span className="tk-ag-meta">
              <AppIcon name="listChecks" size={13} />
              {subs.done}/{subs.n}
            </span>
          )}
          {m.tags.map((tag) => <span key={tag} className="tk-tag-text">#{tag}</span>)}
          {m.hasPriority && (
            <span className="tk-pr-chip tk-ag-pr" style={{ color: pr.color }} title={`Ưu tiên ${pr.label}`}>
              <AppIcon name={pr.icon} size={isMobile ? 14 : 12} weight={m.priority === 5 ? 'fill' : 'regular'} />
              <span className="tk-ag-pr__label">{pr.label}</span>
            </span>
          )}
        </span>
      </div>
    );
  };

  const nowLine = (
    <div key="now" className="tk-ag-now">
      <span className="tk-ag-now__time">{nowHm}</span>
      <span className="tk-ag-now__line" />
    </div>
  );

  const dayItems = (day) => {
    const list = tasksOfDay(day.dateStr);
    const allDay = list.filter((t) => !timeOf(t, day.dateStr)).sort(byDue);
    const timed = list.filter((t) => timeOf(t, day.dateStr)).sort((a, b) => timeOf(a, day.dateStr).localeCompare(timeOf(b, day.dateStr)));
    const items = [
      ...day.holidays.map((h, i) => (
        <div key={`e-${i}`} className="tk-ag-ev">
          <span className="tk-ag-ev__time">Cả ngày</span>
          <span className="tk-ag-ev__dot" style={{ background: holidayDot(h.type) }} />
          <span className="tk-ag-ev__title">{h.title}</span>
        </div>
      )),
      ...allDay.map((t) => taskRow(t, day.dateStr)),
    ];
    // Vạch "bây giờ" chen trước việc có giờ đầu tiên sau thời điểm hiện tại (chỉ hôm nay)
    let nowDone = !day.isToday;
    for (const t of timed) {
      if (!nowDone && timeOf(t, day.dateStr) > nowHm) {
        items.push(nowLine);
        nowDone = true;
      }
      items.push(taskRow(t, day.dateStr));
    }
    if (!nowDone) items.push(nowLine);
    return { items, empty: list.length === 0 && day.holidays.length === 0 };
  };

  const dayName = (day) => (day.dateStr === today ? 'Hôm nay' : day.dateStr === tomorrow ? 'Ngày mai' : DFULL[day.date.getDay()]);

  return (
    <>
      <CalendarNavHead activeView="agenda" currentDate={currentDate} setCurrentDate={setCurrentDate} label={head.label} sub={head.sub} />
      <div className="tk-ag" role="region" aria-label="Lịch biểu">
        {late.length > 0 && (
          <div className="tk-ag-late">
            <div
              className="tk-ag-late__head"
              role="button"
              tabIndex={0}
              aria-expanded={lateOpen}
              onClick={() => setLateOpen((o) => !o)}
              onKeyDown={(e) => e.key === 'Enter' && setLateOpen((o) => !o)}
            >
              <AppIcon name="warning" size={isMobile ? 17 : 16} />
              <span className="tk-ag-late__label">{late.length} việc quá hạn</span>
              {!isMobile && <span className="tk-ag-late__sub">cũ nhất từ {dm(late[0].due_date)}</span>}
              <button
                type="button"
                className="tk-ag-late__move"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveAllLateToToday?.(late);
                }}
              >
                {!isMobile && <AppIcon name="arrowBendDownRight" size={13} />}
                {isMobile ? 'Dời sang hôm nay' : 'Dời hết sang hôm nay'}
              </button>
              <AppIcon name={lateOpen ? 'caretUp' : 'caretDown'} size={13} className="tk-ag-late__caret" />
            </div>
            {lateOpen && (
              <div className="tk-ag-late__list">
                {late.map((t) => {
                  if (isMobile) {
                    return (
                      <TaskCard key={t.id} variant="mobile" task={t} today={today} onOpen={open(t)} onStatus={open(t)} onDate={open(t)} onPriority={open(t)} />
                    );
                  }
                  const m = taskCardModel(t, today);
                  const st = STATUS_META[m.st];
                  return (
                    <div
                      key={t.id}
                      className="tk-ag-late__row"
                      role="button"
                      tabIndex={0}
                      onClick={open(t)}
                      onKeyDown={onKeyOpen(t)}
                      style={{ '--k-fg': 'var(--tk-ks-late-fg)', '--k-bg': 'var(--tk-ks-late-bg)', '--k-bd': 'var(--tk-ks-late-bd)' }}
                      {...dragOf(t)}
                    >
                      <span className="tk-ag-late__st" style={{ color: st.color }}>
                        <AppIcon name={st.icon} size={15} weight={st.weight} />
                      </span>
                      <span className="tk-ag-late__title">{t.title}</span>
                      <span className="tk-due-badge">
                        <AppIcon name={m.badge.icon} size={11.5} />
                        {m.badge.card}
                      </span>
                      <span className="tk-ag-late__days">{m.late}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {sections.map((sec) => (
          <section key={sec.key} className="tk-ag-sec">
            <div className="tk-ag-sec__head">
              <span className="tk-ag-sec__label">{sec.label}</span>
              <span className="tk-ag-sec__count">{sec.count} việc</span>
              <span className="tk-ag-sec__line" />
            </div>
            {sec.rows.map((row) => {
              if (row.kind === 'gap') {
                return (
                  <button
                    key={`g-${row.from}`}
                    type="button"
                    className="tk-ag-gap"
                    onClick={(e) => onOpenDay?.(row.from, e)}
                    {...dropTo(row.from)}
                  >
                    <AppIcon name="coffee" size={14} />
                    <span className="tk-ag-gap__label">{row.label}</span>
                    <span className="tk-ag-gap__add">
                      <AppIcon name="plus" size={isMobile ? 13 : 12} />
                      {!isMobile && 'Thêm việc'}
                    </span>
                  </button>
                );
              }
              const { day } = row;
              const { items, empty } = dayItems(day);
              const sun = day.date.getDay() === 0;
              const add = (e) => onOpenDay?.(day.dateStr, e, day.holidays.map((h) => h.title));
              return (
                <div
                  key={day.dateStr}
                  id={`agenda-${day.dateStr}`}
                  className={`tk-ag-day${day.isToday ? ' is-today' : ''}`}
                  {...dropTo(day.dateStr)}
                >
                  <div className="tk-ag-day__head">
                    <span className={`tk-ag-day__num${day.isToday ? ' is-today' : sun ? ' is-sun' : ''}`}>{day.dayNum}</span>
                    <div className="tk-ag-day__text">
                      <span className={`tk-ag-day__name${day.isToday ? ' is-today' : sun ? ' is-sun' : ''}`}>{dayName(day)}</span>
                      <span className="tk-ag-day__sub">
                        {day.dayNum}/{day.monthNum} · {day.lunar.day}/{day.lunar.month} ÂL
                      </span>
                    </div>
                    {isMobile && (
                      <button type="button" className="tk-ag-day__add-m" onClick={add} aria-label="Thêm việc vào ngày này">
                        <AppIcon name="plus" size={16} />
                      </button>
                    )}
                  </div>
                  <div className="tk-ag-day__items">
                    {items}
                    {empty && <span className="tk-ag-day__empty">Chưa có việc nào.</span>}
                    {!isMobile && (
                      <button type="button" className="tk-ag-day__add" onClick={add}>
                        <AppIcon name="plus" size={12} />
                        Thêm việc
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ))}

        <button type="button" className="tk-ag-more" onClick={() => setExtra({ from: currentDate, days: span - SPAN + 14 })}>
          <AppIcon name="caretDoubleDown" size={12} />
          Xem thêm 2 tuần
        </button>
      </div>
    </>
  );
}

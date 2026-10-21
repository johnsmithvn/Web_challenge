import { Fragment, useState, useMemo, useEffect, useRef } from 'react';
import AppIcon from './AppIcon';
import { PRIORITY_LABELS } from '../utils/taskNlpParser';
import { toDateStr } from '../utils/dateUtils';
import { solarToLunar, getZodiacHours } from '../utils/lunarUtils';
import { STATUS_META, ksStyle, statusKeyOf, taskCardModel } from '../utils/kanbanUtils';
import { sortSubtasks, subtaskDueInfo } from '../utils/subtaskUtils';
import HOLIDAYS from '../data/holidays.json';
import {
  bucketTasksByDay,
  computeDayLayout,
  holidayDot,
  slotTimeFromOffset,
  taskDragStart,
  dropZoneProps,
} from '../utils/calendarTimeUtils';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PX_PER_HOUR = 56; // lưới 56px/giờ như mockup (đường kẻ giờ vẽ bằng CSS cùng bước, xem .tk-dv-canvas)
const MARKER_MIN = 56; // mốc giờ hạn/bắt đầu cao ~50px như khối trong mockup
const LONG_PRESS_MS = 320;
// Khối dài (≥ LONG_MIN): nội dung dồn lên đầu, chỗ còn lại xếp việc con — đầu khối (giờ · tên ·
// trạng thái) cao ~BLOCK_HEAD, mỗi hàng việc con SUB_ROW (mobile cao hơn cho ngón tay).
const LONG_MIN = 96;
const BLOCK_HEAD = { desktop: 66, mobile: 82 };
const SUB_ROW = { desktop: 24, mobile: 30 };
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Giữ-rồi-kéo bằng cảm ứng (mobile không có HTML5 drag): giữ 320ms để nhấc thẻ, kéo vào
 * lưới giờ (bắt 30 phút, tự cuộn khi sát mép) hoặc thả vào "Chưa xếp giờ" để bỏ giờ.
 * Di chuyển >6px trước khi nhấc = đang cuộn → huỷ.
 * @returns {{ drag: {id, slot}|null, pressProps: (task) => object }}
 */
function useTouchTaskDrag({ enabled, scrollRef, canvasRef, unsRef, onDrop }) {
  const dragRef = useRef(null);
  const lastEndRef = useRef(0);
  const onDropRef = useRef(onDrop);
  const startRef = useRef(null);
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    if (!enabled) return undefined;

    const hit = () => {
      const d = dragRef.current;
      if (!d?.on) return;
      const inside = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return d.x >= r.left && d.x <= r.right && d.y >= r.top && d.y <= r.bottom;
      };
      let slot = null;
      if (inside(unsRef.current)) slot = d.hasTime ? 'uns' : null;
      else if (inside(scrollRef.current) && canvasRef.current) {
        const top = canvasRef.current.getBoundingClientRect().top;
        // mép trên thẻ ma (ngón tay ở giữa thẻ cao 50px), làm tròn về mốc 30 phút gần nhất
        slot = slotTimeFromOffset(d.y - 25 - top + PX_PER_HOUR / 4, PX_PER_HOUR);
      }
      d.label.textContent = slot === 'uns' ? 'Bỏ giờ' : slot || d.tm || 'Kéo vào giờ';
      if (d.slot !== slot) {
        d.slot = slot;
        setDrag({ id: d.id, slot });
      }
    };

    const clear = () => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      clearTimeout(d.timer);
      clearInterval(d.scroller);
      if (d.ghost) d.ghost.remove();
      if (d.on) setDrag(null);
    };

    const start = () => {
      const d = dragRef.current;
      if (!d || d.on) return;
      d.on = true;
      const ghost = document.createElement('div');
      ghost.className = 'tk-touch-ghost';
      ghost.style.width = `${d.w}px`;
      const label = document.createElement('span');
      label.className = 'tk-touch-ghost__time';
      label.textContent = d.tm || 'Kéo vào giờ';
      const title = document.createElement('span');
      title.className = 'tk-touch-ghost__title';
      title.textContent = d.title;
      ghost.append(label, title);
      (scrollRef.current?.closest('.tasks-workspace') || document.body).appendChild(ghost);
      d.ghost = ghost;
      d.label = label;
      try { navigator.vibrate?.(12); } catch { /* không hỗ trợ rung */ }
      setDrag({ id: d.id, slot: null });
      // Tự cuộn lưới giờ khi ngón tay sát mép trên/dưới
      d.scroller = setInterval(() => {
        const el = scrollRef.current;
        if (!el || !dragRef.current?.on) return;
        const r = el.getBoundingClientRect();
        let dy = 0;
        if (d.y >= r.top && d.y < r.top + 56) dy = -Math.ceil((r.top + 56 - d.y) / 4);
        else if (d.y > r.bottom - 120 && d.y <= r.bottom + 40) dy = Math.ceil((d.y - r.bottom + 120) / 10);
        if (dy) {
          el.scrollTop += Math.max(-14, Math.min(14, dy));
          hit();
        }
      }, 30);
      move(d.x, d.y);
    };

    const move = (x, y) => {
      const d = dragRef.current;
      if (!d) return;
      d.x = x;
      d.y = y;
      if (!d.on) {
        if (Math.hypot(x - d.x0, y - d.y0) > 6) clear();
        return;
      }
      d.ghost.style.transform = `translate(${x - 24}px, ${y - 25}px) rotate(-1.5deg) scale(1.03)`;
      hit();
    };

    const end = () => {
      const d = dragRef.current;
      if (!d) return;
      const { on, slot, id } = d;
      clear();
      if (!on) return;
      lastEndRef.current = Date.now();
      if (slot) onDropRef.current(id, slot === 'uns' ? null : slot);
    };

    const L = {
      touchmove: (e) => {
        const d = dragRef.current;
        if (!d) return;
        if (d.on && e.cancelable) e.preventDefault();
        move(e.touches[0].clientX, e.touches[0].clientY);
      },
      touchend: end,
      touchcancel: clear,
      // Nhả tay sau khi kéo không được tính là bấm mở thẻ
      click: (e) => {
        if (Date.now() - lastEndRef.current < 400) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      contextmenu: (e) => {
        if (dragRef.current) e.preventDefault();
      },
    };
    const opts = {
      touchmove: { passive: false },
      touchend: { passive: true },
      touchcancel: { passive: true },
      click: { capture: true },
      contextmenu: { capture: true },
    };
    Object.keys(L).forEach((k) => window.addEventListener(k, L[k], opts[k]));
    dragRef.current = null;
    startRef.current = start;
    return () => {
      Object.keys(L).forEach((k) => window.removeEventListener(k, L[k], opts[k]));
      clear();
    };
  }, [enabled, scrollRef, canvasRef, unsRef]);

  const pressProps = (task) => (!enabled ? {} : {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse') return;
      const prev = dragRef.current;
      if (prev) clearTimeout(prev.timer);
      const r = e.currentTarget.getBoundingClientRect();
      dragRef.current = {
        id: task.id,
        title: task.title,
        tm: task.due_time ? task.due_time.slice(0, 5) : '',
        hasTime: !!task.due_time || !!task.start_time,
        x0: e.clientX,
        y0: e.clientY,
        x: e.clientX,
        y: e.clientY,
        w: Math.max(170, Math.min(260, r.width)),
        on: false,
        slot: null,
        timer: setTimeout(() => startRef.current?.(), LONG_PRESS_MS),
      };
    },
  });

  return { drag, pressProps };
}

/**
 * CalendarDayView — view Ngày theo mockup "Kanban tối & sáng".
 *   Desktop: hàng Cả ngày + lưới giờ 56px (dải giờ hoàng đạo, khối việc, vạch hiện tại)
 *            | cột phải 320px: Chưa xếp giờ (kéo vào lưới) + bảng 12 giờ hoàng đạo.
 *   Mobile : dòng sự kiện → Chưa xếp giờ (2 việc, giữ-rồi-kéo) → lưới giờ toàn chiều rộng.
 *   Khối dài hiện việc con (tick được, bấm tên mở hộp việc con; không vừa thì "+N việc con").
 */
export default function CalendarDayView({
  pendingTasks = [],
  allTasks = [],
  onToggleSubtask,
  onOpenSubtask,
  getCompletedTasksRange,
  onSelectTask,
  onOpenDay,
  currentDate = new Date(),
  holidayToggles = { solar: true, lunar: true, international: true, japan: false, fun: true, custom: true },
  customAnniversaries = [],
  refreshKey = 0,
  onRescheduleTask,
  isMobile = false,
}) {
  const [completedTasks, setCompletedTasks] = useState([]);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  const scrollRef = useRef(null);
  const canvasRef = useRef(null);
  const unsRef = useRef(null);
  const hasAutoScrolled = useRef(false);

  // Mobile: Chưa xếp giờ gọn 2 việc; kéo bằng giữ-rồi-kéo thay cho HTML5 drag
  const [unsOpen, setUnsOpen] = useState(false);
  const htmlDrag = !!onRescheduleTask && !isMobile;

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
    scrollRef.current.scrollTop = isToday ? Math.max(0, (nowMinutes / 60) * PX_PER_HOUR - 180) : 7 * PX_PER_HOUR;
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
  const hourNow = isToday ? Math.floor(nowMinutes / 60) : null;
  const zodiacHours = useMemo(() => getZodiacHours(dd, mm, yy, hourNow), [dd, mm, yy, hourNow]);
  // Dải giờ hoàng đạo trên lưới: gộp các khung liền nhau ("Ngọ, Mùi"), Tý 23–1 tách 2 đầu ngày
  const hoangDaoBands = useMemo(() => {
    const good = zodiacHours
      .filter((zh) => zh.isHoangDao)
      .flatMap((zh) => (zh.startHour === 23
        ? [{ start: 0, end: 1, name: zh.name }, { start: 23, end: 24, name: zh.name }]
        : [{ start: zh.startHour, end: zh.endHour, name: zh.name }]))
      .sort((a, b) => a.start - b.start);
    const bands = [];
    for (const g of good) {
      const last = bands[bands.length - 1];
      if (last && last.end === g.start) {
        last.end = g.end;
        last.names.push(g.name);
      } else bands.push({ start: g.start, end: g.end, names: [g.name] });
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

  // Việc con theo task cha (cùng thứ tự với Kanban: ưu tiên → kéo thả)
  const subsByParent = useMemo(() => {
    const map = new Map();
    for (const t of allTasks) {
      if (t.parent_task_id) map.set(t.parent_task_id, [...(map.get(t.parent_task_id) || []), t]);
    }
    for (const [k, list] of map) map.set(k, sortSubtasks(list));
    return map;
  }, [allTasks]);

  // Phân bổ layout các task có giờ
  const combinedTasks = useMemo(() => {
    return [...dayPending, ...completedTasks];
  }, [dayPending, completedTasks]);

  const { allDayTasks, timedTasks } = useMemo(() => {
    return computeDayLayout(combinedTasks, dateStr, MARKER_MIN, PX_PER_HOUR);
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

    const byDueThenPriority = (a, b) => {
      const ad = a.due_date || '9999-99-99';
      const bd = b.due_date || '9999-99-99';
      if (ad !== bd) return ad.localeCompare(bd);
      return (b.priority || 0) - (a.priority || 0);
    };
    // Việc của ngày chưa có giờ trước, rồi nhóm "Quá hạn" riêng (hạn từ hôm trước — có giờ vẫn ở đây vì
    // giờ đó thuộc ngày cũ; kéo vào lưới = dời sang hôm nay). Trước đây trộn chung dưới "Chưa xếp giờ".
    return [...dayUnscheduled.sort(byDueThenPriority), ...overdueList.sort(byDueThenPriority)];
  }, [allDayTasks, pendingTasks, isToday, todayStr]);
  const isOverdue = (t) => !!t.due_date && t.due_date < todayStr;
  const overdueCount = unscheduledTasks.filter(isOverdue).length;
  const dayUnscheduledCount = unscheduledTasks.length - overdueCount;

  // Thả vào "Chưa xếp giờ" một việc ĐANG nằm ở đó (kéo lỡ tay rồi thả lại) → bỏ qua. Trước đây việc
  // quá hạn bị dời sang hôm nay + mất giờ dù không kéo đi đâu.
  const unscheduledIds = new Set(unscheduledTasks.map((t) => String(t.id)));
  const dropUnscheduled = (id) => {
    if (!unscheduledIds.has(String(id))) onRescheduleTask(id, dateStr, null);
  };
  const { drag: touchDrag, pressProps } = useTouchTaskDrag({
    enabled: !!onRescheduleTask && isMobile,
    scrollRef,
    canvasRef,
    unsRef,
    onDrop: (id, timeStr) => (timeStr === null ? dropUnscheduled(id) : onRescheduleTask(id, dateStr, timeStr)),
  });
  const shownUnscheduled = isMobile && !unsOpen ? unscheduledTasks.slice(0, 2) : unscheduledTasks;
  const ghostOpacity = (t) => (touchDrag?.id === t.id ? 0.35 : 1);

  const unscheduledPanel = (
    <div
      ref={unsRef}
      className={`tk-dv-uns${touchDrag?.slot === 'uns' ? ' is-drop-over' : ''}`}
      {...(htmlDrag ? dropZoneProps(dropUnscheduled) : {})}
    >
      <div className="tk-dv-uns__head">
        <span className="tk-dv-cap">CHƯA XẾP GIỜ</span>
        <span className="tk-dv-uns__count">{dayUnscheduledCount}</span>
        {isMobile && onRescheduleTask && (
          <span className="tk-dv-uns__hint">
            <AppIcon name="handGrabbing" size={13} />
            Giữ rồi kéo vào giờ
          </span>
        )}
      </div>
      {!isMobile && onRescheduleTask && (
        <span className="tk-dv-uns__help">Kéo việc sang lịch bên trái để xếp giờ. Kéo ngược về đây để bỏ giờ.</span>
      )}
      {shownUnscheduled.map((t, i) => {
        const m = taskCardModel(t, todayStr);
        const pr = PRIORITY_LABELS[m.priority] || PRIORITY_LABELS[0];
        // Quá hạn: hiện đủ ngày + giờ cũ ("Hôm qua, 15:00") để thấy rõ giờ đó thuộc ngày khác
        const badge = (
          <span className={`tk-due-badge${m.badge.dashed ? ' is-dashed' : ''}`} title={m.badge.text}>
            {!isMobile && <AppIcon name={m.badge.icon} size={11.5} />}
            {m.k === 'late' ? m.badge.short : m.badge.card}
          </span>
        );
        const firstOverdue = isOverdue(t) && (i === 0 || !isOverdue(shownUnscheduled[i - 1]));
        return (
          <Fragment key={t.id}>
          {firstOverdue && (
            <div className="tk-dv-uns__sub">
              <span className="tk-dv-cap">QUÁ HẠN</span>
              <span className="tk-dv-uns__count is-late">{overdueCount}</span>
              {onRescheduleTask && <span className="tk-dv-uns__subhint">kéo vào lịch để dời sang hôm nay</span>}
            </div>
          )}
          <div
            className="tk-dv-ucard"
            style={{ ...ksStyle(m.k), opacity: ghostOpacity(t) }}
            draggable={htmlDrag}
            onDragStart={(e) => taskDragStart(e, t)}
            {...pressProps(t)}
            onClick={() => onSelectTask?.(t)}
          >
            {isMobile ? (
              <>
                <span className="tk-dv-ucard__title">{t.title}</span>
                {badge}
                {onRescheduleTask && <AppIcon name="dotsSix" size={16} className="tk-dv-ucard__grip" />}
              </>
            ) : (
              <>
                <div className="tk-dv-ucard__top">
                  <AppIcon name="dotsSix" size={14} className="tk-dv-ucard__grip" />
                  <span className="tk-dv-ucard__title">{t.title}</span>
                </div>
                <div className="tk-dv-ucard__chips">
                  {badge}
                  {m.hasPriority && (
                    <span className="tk-pr-chip" style={{ color: pr.color }}>
                      <AppIcon name={pr.icon} size={12} weight={m.priority === 5 ? 'fill' : 'regular'} />
                      {pr.label}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          </Fragment>
        );
      })}
      {!isMobile && unscheduledTasks.length === 0 && <span className="tk-dv-uns__empty">Mọi việc trong ngày đã có giờ.</span>}
      {isMobile && unscheduledTasks.length > 2 && (
        <button type="button" className="tk-dv-uns__more" onClick={() => setUnsOpen((o) => !o)}>
          <AppIcon name={unsOpen ? 'caretUp' : 'caretDown'} size={12} />
          {unsOpen ? 'Thu gọn' : `Xem thêm ${unscheduledTasks.length - 2} việc`}
        </button>
      )}
    </div>
  );

  return (
    <div className="tk-dv" role="region" aria-label="Lịch ngày 24 giờ">
      {isMobile && allDayHolidays.length > 0 && (
        <div className="tk-dv-mevs">
          {allDayHolidays.map((h, i) => (
            <span key={i} className="tk-dv-mev" title={h.title}>
              <span className="tk-dv-ev__dot" style={{ background: holidayDot(h.type) }} />
              <span className="tk-dv-mev__t">{h.title}</span>
            </span>
          ))}
        </div>
      )}
      {isMobile && unscheduledTasks.length > 0 && unscheduledPanel}

      <div className="tk-dv-body">
        <div className="tk-dv-main">
          {/* Hàng Cả ngày: ngày lễ + việc cả ngày đã xong; thả việc vào đây để bỏ giờ */}
          {!isMobile && (
            <div
              className="tk-dv-allday"
              {...(htmlDrag ? dropZoneProps((id) => onRescheduleTask(id, dateStr, null)) : {})}
            >
              <span className="tk-dv-allday__label">Cả ngày</span>
              <div className="tk-dv-allday__items">
                {allDayHolidays.map((h, i) => (
                  <span key={i} className="tk-dv-ev">
                    <span className="tk-dv-ev__dot" style={{ background: holidayDot(h.type) }} />
                    {h.title}
                  </span>
                ))}
                {allDayDoneTasks.map((t) => {
                  const m = taskCardModel(t, todayStr);
                  const st = STATUS_META[m.st];
                  return (
                    <span key={t.id} className="tk-dv-done" style={ksStyle(m.k)} onClick={() => onSelectTask?.(t)} title={t.title}>
                      <AppIcon name={st.icon} size={12} weight={st.weight} />
                      <span className="tk-dv-done__t">{t.title}</span>
                    </span>
                  );
                })}
                {allDayHolidays.length === 0 && allDayDoneTasks.length === 0 && (
                  <span className="tk-dv-allday__none">Không có sự kiện cả ngày</span>
                )}
              </div>
            </div>
          )}

          <div className="tk-dv-scroll" ref={scrollRef}>
            <div className="tk-dv-grid" style={{ height: `${24 * PX_PER_HOUR}px` }}>
              <div className="tk-dv-hours">
                {HOURS.slice(1).map((h) => (
                  <span key={h} style={{ top: `${h * PX_PER_HOUR}px` }}>{hm(h * 60)}</span>
                ))}
              </div>

              <div
                ref={canvasRef}
                className="tk-dv-canvas"
                title={isMobile ? undefined : 'Bấm để thêm việc vào giờ này, kéo việc vào để xếp giờ'}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const time = slotTimeFromOffset(e.clientY - e.currentTarget.getBoundingClientRect().top, PX_PER_HOUR);
                  onOpenDay?.(dateStr, e, allDayHolidays.map((h) => h.title), time);
                }}
                {...(htmlDrag
                  ? dropZoneProps((id, e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      onRescheduleTask(id, dateStr, slotTimeFromOffset(e.clientY - rect.top, PX_PER_HOUR));
                    })
                  : {})}
              >
                {hoangDaoBands.map((b) => (
                  <span
                    key={b.start}
                    className="tk-dv-band"
                    style={{ top: `${b.start * PX_PER_HOUR}px`, height: `${(b.end - b.start) * PX_PER_HOUR}px` }}
                  >
                    {!isMobile && <span className="tk-dv-band__label">Hoàng đạo · {b.names.join(', ')}</span>}
                  </span>
                ))}

                {timedTasks.map((t) => {
                  const m = taskCardModel(t, todayStr);
                  const st = STATUS_META[m.st];
                  const pr = PRIORITY_LABELS[m.priority] || PRIORITY_LABELS[0];
                  const L = t._layout;
                  const tall = L.height >= 44;
                  const time = L.kind === 'block' ? `${hm(L.startMinutes)}–${hm(L.endMinutes)}` : `${L.kind === 'start' ? '▶ ' : ''}${hm(L.startMinutes)}`;
                  const subs = subsByParent.get(t.id) || [];
                  const subDone = subs.filter((s) => statusKeyOf(s) === 'done').length;
                  const size = isMobile ? 'mobile' : 'desktop';
                  const long = L.height >= LONG_MIN;
                  // Số hàng việc con vừa khối; thiếu chỗ thì hàng cuối là "+N việc con"
                  const fit = long ? Math.floor((L.height - BLOCK_HEAD[size]) / SUB_ROW[size]) : 0;
                  const shownSubs = subs.length > fit ? subs.slice(0, Math.max(0, fit - 1)) : subs;
                  const moreSubs = subs.length - shownSubs.length;
                  return (
                    <div
                      key={t.id}
                      className={`tk-dv-block${tall ? '' : ' is-short'}${long ? ' is-long' : ''}`}
                      draggable={!m.done && htmlDrag}
                      onDragStart={(e) => taskDragStart(e, t)}
                      {...(!m.done ? pressProps(t) : {})}
                      style={{
                        ...ksStyle(m.k),
                        top: `${L.top}px`,
                        height: `${L.height}px`,
                        left: L.left,
                        width: `calc(${L.width} - 4px)`,
                        opacity: ghostOpacity(t),
                      }}
                      onClick={() => onSelectTask?.(t)}
                      title={`${t.title} (${L.timeRangeLabel})`}
                    >
                      <div className="tk-dv-block__row">
                        <span className="tk-dv-block__time">{time}</span>
                        <span className={`tk-dv-block__title${m.done ? ' is-done' : ''}`}>{t.title}</span>
                      </div>
                      {tall && (!isMobile || long) && (
                        <div className="tk-dv-block__meta">
                          <span style={{ color: st.color }}>
                            <AppIcon name={st.icon} size={12} weight={st.weight} />
                            {st.label}
                          </span>
                          {m.hasPriority && (
                            <span style={{ color: pr.color }}>
                              <AppIcon name={pr.icon} size={12} weight={m.priority === 5 ? 'fill' : 'regular'} />
                              {pr.label}
                            </span>
                          )}
                          {subs.length > 0 && (
                            <span className={`tk-dv-block__prog${subDone === subs.length ? ' is-done' : ''}`} title="Việc con đã xong">
                              <AppIcon name="listChecks" size={12} />
                              {subDone}/{subs.length}
                            </span>
                          )}
                        </div>
                      )}
                      {fit > 0 && subs.length > 0 && (
                        <div className="tk-dv-subs">
                          {shownSubs.map((s) => {
                            const sKey = statusKeyOf(s);
                            const sDone = sKey === 'done';
                            const sp = PRIORITY_LABELS[Number(s.priority) || 0];
                            const due = subtaskDueInfo(s, t.due_date);
                            return (
                              <div key={s.id} className={`tk-dv-sub${sKey === 'doing' ? ' is-doing' : ''}`}>
                                <button
                                  type="button"
                                  className="tk-dv-sub__check"
                                  title={sDone ? 'Bỏ đánh dấu xong' : 'Đánh dấu xong'}
                                  disabled={!onToggleSubtask}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSubtask?.(s);
                                  }}
                                >
                                  <AppIcon
                                    name={sDone ? 'checkSquare' : 'square'}
                                    size={isMobile ? 17 : 15}
                                    weight={sDone ? 'fill' : 'regular'}
                                    style={{ color: sDone ? 'var(--tk-st-done)' : 'var(--tk-text-mute)' }}
                                  />
                                </button>
                                <button
                                  type="button"
                                  className={`tk-dv-sub__title${sDone ? ' is-done' : ''}`}
                                  title="Mở việc con"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onOpenSubtask) onOpenSubtask(t, s);
                                    else onSelectTask?.(t);
                                  }}
                                >
                                  {s.title}
                                </button>
                                {due && <span className={`tk-sub-due tk-sub-due--${due.tone}`} title={due.title}>{due.label}</span>}
                                {Number(s.priority) > 0 && sp && (
                                  <span className="tk-dv-sub__pr" style={{ color: sp.color }} title={`Ưu tiên: ${sp.label}`}>
                                    <AppIcon name={sp.icon} size={12} weight={Number(s.priority) === 5 ? 'fill' : 'regular'} />
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {moreSubs > 0 && (
                            <span className="tk-dv-sub__more">
                              <AppIcon name="dots" size={12} />
                              {shownSubs.length ? `+${moreSubs} việc con` : `${moreSubs} việc con`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {touchDrag?.slot && touchDrag.slot !== 'uns' && (
                  <div
                    className="tk-touch-slot"
                    style={{ top: `${(Number(touchDrag.slot.slice(0, 2)) * 60 + Number(touchDrag.slot.slice(3))) / 60 * PX_PER_HOUR}px` }}
                  >
                    {touchDrag.slot}
                  </div>
                )}

                {isToday && <span className="tk-dv-now" style={{ top: `${(nowMinutes / 60) * PX_PER_HOUR}px` }} />}
              </div>
            </div>
          </div>
        </div>

        {!isMobile && (
          <aside className="tk-dv-side">
            {unscheduledPanel}
            <div className="tk-dv-hd">
              <div className="tk-dv-hd__head">
                <span className="tk-dv-cap">GIỜ HOÀNG ĐẠO</span>
                <span className="tk-dv-hd__n">{zodiacHours.filter((zh) => zh.isHoangDao).length} giờ tốt</span>
              </div>
              <div className="tk-dv-hd__grid">
                {zodiacHours.map((zh) => (
                  <span
                    key={zh.name}
                    className={`tk-dv-hd__cell${zh.isHoangDao ? ' is-good' : ''}${zh.isNow ? ' is-now' : ''}`}
                    title={`Giờ ${zh.name} ${zh.range} · ${zh.isHoangDao ? 'hoàng đạo' : 'hắc đạo'}`}
                  >
                    <span className="tk-dv-hd__name">{zh.name}</span>
                    <span className="tk-dv-hd__range">{zh.range}</span>
                  </span>
                ))}
              </div>
              <span className="tk-dv-hd__note">Giờ tốt cũng được tô nhạt trên lịch bên trái.</span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * calendarTimeUtils.js — Các hàm tính toán thuần túy cho Lịch Tuần Time-Grid (Google Calendar style).
 * Tách biệt hoàn toàn khỏi React để có thể test bằng Node.js assert.
 */
import { toDateStr, mondayIndex } from './dateUtils.js';

/**
 * Chuyển chuỗi HH:mm hoặc HH:mm:ss sang số phút tính từ 00:00.
 * @param {string|null|undefined} timeStr - Ví dụ "14:30"
 * @returns {number|null} Số phút (0 - 1439) hoặc null nếu không hợp lệ
 */
export function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

/**
 * Task có giờ do user đặt hay không. Từ v6.21.0 "không giờ" là NULL; 23:59/00:00 là
 * giá trị giả của bản cũ (migration v6.21.0 đã đổi về NULL) — vẫn coi là không giờ
 * cho dữ liệu cache/khách còn sót. Task không giờ thuộc hàng "Cả ngày".
 * @param {string|null|undefined} dueTime - "HH:mm" hoặc "HH:mm:ss" (DB)
 * @returns {boolean}
 */
export function hasExplicitTime(dueTime) {
  if (timeToMinutes(dueTime) === null) return false;
  const hhmm = dueTime.trim().substring(0, 5);
  return hhmm !== '23:59' && hhmm !== '00:00';
}

/**
 * Danh sách nhắc giờ HÔM NAY gửi cho Service Worker (public/sw.js), mỗi nhắc 1 tag riêng:
 *   - Bắt đầu (start_date hôm nay, có giờ) → "Đến giờ làm" — trừ khi task đã sang Doing
 *     (đã bắt đầu thật). `until` = giờ Hạn cùng ngày: quá giờ đó thì SW không nhắc muộn.
 *   - Hạn (due_date hôm nay, có giờ) → "Đến hạn". Không đặt giờ thì không nhắc.
 * @param {Array<Object>} tasks - task trong state (pending + xong hôm nay)
 * @param {string} todayStr - YYYY-MM-DD địa phương
 * @returns {Array<{tag:string, taskId:string, at:string, until?:string, title:string, body:string}>}
 */
export function buildTodayReminders(tasks = [], todayStr) {
  const out = [];
  for (const t of tasks) {
    // 'skip' = đã chủ động bỏ qua → không nhắc.
    if (t.completed || t.status === 'skip') continue;
    const due = t.due_date === todayStr && hasExplicitTime(t.due_time) ? t.due_time.substring(0, 5) : null;
    const start = t.start_date === todayStr && t.start_time ? t.start_time.substring(0, 5) : null;
    if (start && t.status !== 'doing') {
      out.push({
        tag: `task-start-${t.id}`,
        taskId: t.id,
        at: start,
        ...(due && due > start ? { until: due } : {}),
        title: '⏱ Đến giờ làm',
        body: due ? `${t.title} (${start}–${due})` : t.title,
      });
    }
    if (due) {
      out.push({ tag: `task-${t.id}`, taskId: t.id, at: due, title: '📌 Nhiệm Vụ Đến Hạn', body: t.title });
    }
  }
  return out;
}

/**
 * Bắt đầu sau (hoặc trùng giờ) Hạn — khớp CHECK `user_tasks_start_before_due` dưới DB.
 * Cùng ngày mà 1 trong 2 không giờ thì hợp lệ. 'YYYY-MM-DD' / 'HH:MM' so sánh chuỗi được.
 * @param {{startDate?: string, startTime?: string, dueDate?: string, dueTime?: string}} d - '' = không đặt
 * @returns {boolean}
 */
export function isStartAfterDue({ startDate, startTime, dueDate, dueTime }) {
  if (!startDate || !dueDate) return false;
  if (startDate !== dueDate) return startDate > dueDate;
  return Boolean(startTime && dueTime) && startTime >= dueTime;
}

/**
 * Nhãn ngắn của 1 mốc (Bắt đầu / Hạn / lúc bắt đầu làm) trên thẻ task:
 * "09:00" nếu hôm nay, "6/10 09:00", "6/10"; hôm nay không giờ → "Hôm nay".
 * @param {string|null} date - YYYY-MM-DD
 * @param {string|null} time - HH:mm(:ss)
 * @param {string} todayStr - YYYY-MM-DD địa phương
 * @returns {string} '' khi không có ngày
 */
export function formatWhenShort(date, time, todayStr) {
  if (!date) return '';
  const [, m, d] = date.split('-');
  const day = date === todayStr ? '' : `${Number(d)}/${Number(m)}`;
  const hm = hasExplicitTime(time) ? time.substring(0, 5) : '';
  return [day, hm].filter(Boolean).join(' ') || 'Hôm nay';
}

/**
 * Thời gian làm thật từ started_at đến completed_at, vd "25p", "2h25p", "3 ngày 4h".
 * @param {string} fromIso
 * @param {string} toIso
 * @returns {string}
 */
export function formatSpent(fromIso, toIso) {
  const mins = Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d) return `${d} ngày${h ? ` ${h}h` : ''}`;
  if (h) return `${h}h${m ? `${m}p` : ''}`;
  return `${m}p`;
}

/**
 * Chuyển số phút sang chuỗi hiển thị 12h thân thiện (VD: 870 -> "2:30pm", 720 -> "12pm").
 * @param {number} totalMinutes
 * @returns {string}
 */
export function minutesTo12h(totalMinutes) {
  const m = Math.max(0, Math.min(1439, Math.floor(totalMinutes)));
  const hour24 = Math.floor(m / 60);
  const mins = m % 60;
  const period = hour24 >= 12 ? 'pm' : 'am';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return mins === 0 ? `${hour12}${period}` : `${hour12}:${String(mins).padStart(2, '0')}${period}`;
}

/**
 * Format dải thời gian hiển thị trên khối task (VD: "12:30 - 1:30pm" hoặc "14:00 - 14:45").
 * @param {string} dueTime - Giờ bắt đầu HH:mm
 * @param {number} durationMinutes - Thời lượng tính bằng phút (mặc định 45)
 * @returns {string}
 */
export function formatTimeRange(dueTime, durationMinutes = 45) {
  const start = timeToMinutes(dueTime);
  if (start === null) return '';
  const dur = Math.max(15, Number(durationMinutes) || 45);
  const rawEnd = start + dur;
  const end = rawEnd >= 1440 ? rawEnd % 1440 : rawEnd;
  return `${minutesTo12h(start)} - ${minutesTo12h(end)}`;
}

/**
 * Xác định trạng thái hiển thị của Task (Done / Quá hạn / Bình thường)
 * @param {Object} task
 * @param {string} todayStr - YYYY-MM-DD
 * @param {number|null} nowMinutes - Số phút từ 00:00 của hiện tại
 * @returns {'done'|'overdue'|'active'}
 */
export function getTaskVisualStatus(task, todayStr = toDateStr(new Date()), nowMinutes = null) {
  if (!task) return 'active';
  if (task.completed || task.completed_at) return 'done';
  if (!task.due_date) return 'active';

  if (task.due_date < todayStr) return 'overdue';

  // Task không đặt giờ (23:59/00:00) hạn hôm nay thì chưa quá hạn trong ngày.
  if (task.due_date === todayStr && hasExplicitTime(task.due_time) && typeof nowMinutes === 'number') {
    const taskMins = timeToMinutes(task.due_time);
    if (taskMins !== null && taskMins < nowMinutes) {
      return 'overdue';
    }
  }

  return 'active';
}

/**
 * Lấy mảng 7 ngày của tuần chứa baseDate.
 * Hỗ trợ bắt đầu từ Thứ 2 (mặc định VN/ISO) hoặc Chủ Nhật (chuẩn Google Calendar).
 * @param {Date|string} baseDate
 * @param {boolean} startOnSunday
 * @returns {Array<{ date: Date, dateStr: string, dayNum: number, weekdayName: string, isToday: boolean }>}
 */
export function getWeekDays(baseDate = new Date(), startOnSunday = false) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);

  const startDate = new Date(d);
  let weekdaysNames = [];

  if (startOnSunday) {
    // 0 = Chủ Nhật, 1 = Thứ 2...
    const sunDiff = d.getDay();
    startDate.setDate(d.getDate() - sunDiff);
    weekdaysNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  } else {
    // Thứ 2 là ngày đầu tuần
    const mIndex = mondayIndex(d);
    startDate.setDate(d.getDate() - mIndex);
    weekdaysNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  }

  const todayStr = toDateStr(new Date());
  const days = [];

  for (let i = 0; i < 7; i++) {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + i);
    const dateStr = toDateStr(current);
    days.push({
      date: current,
      dateStr,
      dayNum: current.getDate(),
      weekdayName: weekdaysNames[i],
      isToday: dateStr === todayStr,
    });
  }
  return days;
}

/**
 * Khoảng ngày task chiếm trên Lịch (v6.21.0): từ ngày Bắt đầu đến ngày Hạn. Chỉ có 1 mốc
 * → đúng ngày đó; không ngày → null. Bắt đầu sau Hạn (dữ liệu hỏng, DB đã CHECK) → ngày Hạn.
 * @param {Object} task
 * @returns {{from: string, to: string} | null}
 */
export function taskSpan(task) {
  const from = task?.start_date || task?.due_date;
  const to = task?.due_date || task?.start_date;
  if (!from) return null;
  return from <= to ? { from, to } : { from: to, to };
}

/**
 * Vai của 1 ngày với task: 'single' (task 1 ngày), 'start' / 'middle' / 'end' (task nhiều ngày).
 * @param {Object} task
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {'single'|'start'|'middle'|'end'}
 */
export function taskDayRole(task, dateStr) {
  const span = taskSpan(task);
  if (!span || span.from === span.to) return 'single';
  if (dateStr === span.from) return 'start';
  if (dateStr === span.to) return 'end';
  return 'middle';
}

/** Ký hiệu đầu chip của task nhiều ngày: ▶ ngày Bắt đầu, ↔ ngày giữa, ⏰ ngày Hạn. */
export function taskDayMark(task, dateStr) {
  return { start: '▶ ', middle: '↔ ', end: '⏰ ' }[taskDayRole(task, dateStr)] || '';
}

/**
 * Gom task vào MỌI ngày nó chiếm (taskSpan) nằm trong [from, to] — các view Lịch.
 * Vòng lặp bị chặn trong khoảng đang xem, task kéo dài cả năm cũng chỉ lặp vài chục ngày.
 * @param {Array<Object>} tasks
 * @param {string} from - YYYY-MM-DD
 * @param {string} to - YYYY-MM-DD
 * @returns {Object<string, Array<Object>>} dateStr → task[]
 */
export function bucketTasksByDay(tasks = [], from, to) {
  const map = {};
  for (const t of tasks) {
    const span = taskSpan(t);
    if (!span || span.to < from || span.from > to) continue;
    const d = new Date(`${span.from < from ? from : span.from}T00:00:00`);
    const end = span.to > to ? to : span.to;
    for (let ds = toDateStr(d); ds <= end; d.setDate(d.getDate() + 1), ds = toDateStr(d)) {
      (map[ds] ||= []).push(t);
    }
  }
  return map;
}

/**
 * Thuật toán giải quyết sự kiện trùng giờ (Overlapping Event Column Allocation).
 * Tương tự thuật toán của Google Calendar:
 * 1. Tách các task có giờ cụ thể trong ngày.
 * 2. Tìm các cụm task giao nhau về dải thời gian [start, end].
 * 3. Gán chỉ số cột `colIndex` (0, 1, ...) và tổng số cột `totalCols` cho mỗi task.
 * 4. Tính tọa độ CSS `top`, `height`, `left`, `width`.
 *
 * Loại của task trong NGÀY `dateStr` (task đã gom bằng bucketTasksByDay, v6.21.0):
 *   - Bắt đầu và Hạn cùng là ngày này, cả hai có giờ → khối thật Bắt đầu→Hạn (`kind: 'block'`).
 *   - Ngày Hạn có giờ → mốc ngắn tại giờ hạn (`kind: 'deadline'`), không phải khối
 *     thời lượng — giờ hạn không nói task kéo dài bao lâu.
 *   - Ngày Bắt đầu có giờ → mốc ngắn tại giờ bắt đầu (`kind: 'start'`) — không vẽ khối
 *     tới nửa đêm / sang ngày Hạn.
 *   - Còn lại (không giờ, ngày giữa của task nhiều ngày) → hàng Cả ngày.
 *
 * @param {Array<Object>} tasks - Danh sách task trong ngày
 * @param {string} dateStr - Ngày đang dựng (YYYY-MM-DD)
 * @param {number} markerMinutes - Chiều cao (quy ra phút) của mốc giờ hạn
 * @param {number} pxPerHour - Chiều cao 1 giờ bằng pixel (mặc định 56px)
 * @returns {{ allDayTasks: Array<Object>, timedTasks: Array<Object> }}
 */
export function computeDayLayout(tasks = [], dateStr, markerMinutes = 30, pxPerHour = 56) {
  const allDayTasks = [];
  const timed = [];

  for (const t of tasks) {
    const due = t.due_date === dateStr && hasExplicitTime(t.due_time) ? timeToMinutes(t.due_time) : null;
    const start = t.start_date === dateStr ? timeToMinutes(t.start_time) : null;
    if (start !== null && due !== null && due > start) {
      timed.push({ task: t, start, end: due, kind: 'block' });
    } else if (due !== null) {
      timed.push({ task: t, start: due, end: Math.min(1440, due + markerMinutes), kind: 'deadline' });
    } else if (start !== null) {
      timed.push({ task: t, start, end: Math.min(1440, start + markerMinutes), kind: 'start' });
    } else {
      allDayTasks.push(t);
    }
  }

  // Sắp xếp timed tasks: bắt đầu sớm xếp trước, nếu cùng giờ thì dài hơn xếp trước
  timed.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Nhóm các task thành các cụm giao nhau liên tục (connected overlapping clusters)
  const clusters = [];
  let currentCluster = [];
  let clusterEnd = -1;

  for (const ev of timed) {
    if (currentCluster.length === 0) {
      currentCluster.push(ev);
      clusterEnd = ev.end;
    } else if (ev.start < clusterEnd) {
      // Giao nhau với cụm hiện tại
      currentCluster.push(ev);
      clusterEnd = Math.max(clusterEnd, ev.end);
    } else {
      // Bắt đầu cụm mới
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterEnd = ev.end;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const pxPerMinute = pxPerHour / 60;
  const timedTasks = [];

  // Trong từng cụm, chia các cột con (sub-columns) bằng thuật toán greedy coloring
  for (const cluster of clusters) {
    const columns = []; // Mỗi phần tử là mốc thời gian kết thúc của cột đó

    for (const ev of cluster) {
      let placedCol = -1;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i] <= ev.start) {
          placedCol = i;
          columns[i] = ev.end;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = columns.length;
        columns.push(ev.end);
      }
      ev.colIndex = placedCol;
    }

    const totalCols = Math.max(1, columns.length);
    for (const ev of cluster) {
      const top = Math.round(ev.start * pxPerMinute);
      const height = Math.max(22, Math.round((ev.end - ev.start) * pxPerMinute) - 2); // Trừ 2px khoảng cách viền
      const widthPct = 100 / totalCols;
      const leftPct = ev.colIndex * widthPct;

      timedTasks.push({
        ...ev.task,
        _layout: {
          top,
          height,
          left: `${leftPct}%`,
          width: `calc(${widthPct}% - 4px)`,
          startMinutes: ev.start,
          endMinutes: ev.end,
          kind: ev.kind,
          timeRangeLabel: ev.kind === 'block'
            ? formatTimeRange(ev.task.start_time, ev.end - ev.start)
            : `${ev.kind === 'start' ? 'Bắt đầu' : 'Hạn'} ${minutesTo12h(ev.start)}`,
        },
      });
    }
  }

  return { allDayTasks, timedTasks };
}

// ── Kéo thả để đổi ngày/giờ trên các view Lịch ─────────────────────────────

/** Kiểu dữ liệu riêng cho dataTransfer — để ô lịch chỉ nhận thẻ task (không nhận file/text). */
export const TASK_DND_TYPE = 'application/x-lifehub-task';

const pad2 = (n) => String(n).padStart(2, '0');
const minToHHMM = (m) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
const dayDiff = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};

/**
 * Vị trí thả trên lưới giờ → "HH:MM", làm tròn xuống 30 phút, kẹp trong [startHour:00, 23:30].
 * @param {number} offsetY - px tính từ đỉnh lưới
 * @param {number} pxPerHour
 * @param {number} [startHour=0] - giờ ở đỉnh lưới
 */
export function slotTimeFromOffset(offsetY, pxPerHour, startHour = 0) {
  const raw = startHour * 60 + Math.floor(((offsetY / pxPerHour) * 60) / 30) * 30;
  return minToHHMM(Math.max(startHour * 60, Math.min(23 * 60 + 30, raw)));
}

/**
 * Patch updateTask khi thả task sang ngày/giờ khác.
 *   - timeStr === undefined: giữ giờ (thả vào ô Tháng / Lịch biểu).
 *   - timeStr === null: thành việc cả ngày (thả vào hàng Cả ngày / Chưa xếp giờ).
 *   - timeStr "HH:MM": khối Bắt đầu→Hạn cùng ngày thì dời cả khối, giữ thời lượng;
 *     còn lại đặt giờ Hạn.
 * Ngày Bắt đầu (nếu có) dời cùng số ngày với Hạn để không bị Bắt đầu sau Hạn.
 * @returns {Object|null} null khi không có gì thay đổi
 */
export function rescheduleTaskPatch(task, dateStr, timeStr) {
  const patch = { due_date: dateStr };
  const isBlock = !!task.start_date && task.start_date === task.due_date
    && hasExplicitTime(task.start_time) && hasExplicitTime(task.due_time);

  if (task.start_date) {
    if (task.due_date) patch.start_date = addDays(task.start_date, dayDiff(task.due_date, dateStr));
    else if (task.start_date > dateStr) patch.start_date = dateStr;
  }

  if (timeStr === null) {
    patch.due_time = null;
    if (task.start_time && patch.start_date === dateStr) patch.start_time = null;
  } else if (typeof timeStr === 'string') {
    const t = timeToMinutes(timeStr);
    if (isBlock) {
      const dur = timeToMinutes(task.due_time) - timeToMinutes(task.start_time);
      patch.start_date = dateStr;
      patch.start_time = minToHHMM(t);
      patch.due_time = minToHHMM(Math.min(23 * 60 + 59, t + dur));
    } else {
      patch.due_time = minToHHMM(t);
      const st = timeToMinutes(task.start_time);
      if (patch.start_date === dateStr && st !== null && st > t) patch.start_time = null;
    }
  }

  const same = Object.keys(patch).every((k) => {
    const a = patch[k];
    const b = task[k] ?? null;
    return k.endsWith('_time') ? (a ? a.slice(0, 5) : null) === (b ? b.slice(0, 5) : null) : a === b;
  });
  return same ? null : patch;
}

/** onDragStart cho thẻ task trên các view Lịch. */
export function taskDragStart(e, task) {
  e.stopPropagation();
  e.dataTransfer.setData(TASK_DND_TYPE, String(task.id));
  e.dataTransfer.effectAllowed = 'move';
}

/**
 * Props cho vùng thả (ô ngày, cột giờ…): chỉ nhận thẻ task, tô viền khi kéo qua.
 * @param {(taskId: string, e: DragEvent) => void} onDropTask
 */
export function dropZoneProps(onDropTask) {
  return {
    onDragOver: (e) => {
      if (!e.dataTransfer.types.includes(TASK_DND_TYPE)) return;
      e.preventDefault();
      e.currentTarget.classList.add('is-drop-over');
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('is-drop-over');
    },
    onDrop: (e) => {
      e.currentTarget.classList.remove('is-drop-over');
      const id = e.dataTransfer.getData(TASK_DND_TYPE);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      onDropTask(id, e);
    },
  };
}

// ── Lịch biểu: gom theo tuần, gộp chuỗi ngày trống ─────────────────────────

const DOW_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const dm = (dateStr) => `${Number(dateStr.slice(8, 10))}/${Number(dateStr.slice(5, 7))}`;
const mondayOf = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  return addDays(dateStr, -mondayIndex(d));
};

/** Nhãn tuần so với tuần hiện tại: Tuần này / Tuần sau / Tuần trước / Tuần d/m – d/m. */
export function agendaWeekLabel(mondayStr, todayStr) {
  const diff = Math.round(dayDiff(mondayOf(todayStr), mondayStr) / 7);
  if (diff === 0) return 'Tuần này';
  if (diff === 1) return 'Tuần sau';
  if (diff === -1) return 'Tuần trước';
  return `Tuần ${dm(mondayStr)} – ${dm(addDays(mondayStr, 6))}`;
}

/** "T2 12/10 → T4 14/10 · trống" (hoặc 1 ngày: "T2 12/10 · trống"). */
export function agendaGapLabel(from, to) {
  const lbl = (v) => `${DOW_VI[new Date(`${v}T00:00:00`).getDay()]} ${dm(v)}`;
  return `${lbl(from)}${from === to ? '' : ` → ${lbl(to)}`} · trống`;
}

/**
 * Dãy hàng của Lịch biểu: tiêu đề tuần (kèm số việc) → ngày có nội dung; các ngày trống liền nhau
 * (trừ hôm nay) gộp thành 1 hàng "trống".
 * @param {Array<{dateStr: string, isToday: boolean}>} days
 * @param {(day) => number} countOf - số việc của ngày
 * @param {(day) => boolean} hasContent - ngày có việc / sự kiện
 * @param {string} todayStr
 * @returns {Array<{kind:'week', key, label, count} | {kind:'day', day} | {kind:'gap', from, to, label}>}
 */
export function buildAgendaRows(days, countOf, hasContent, todayStr) {
  const rows = [];
  let week = null;
  let gap = null;
  for (const day of days) {
    const wk = mondayOf(day.dateStr);
    if (!week || week.key !== wk) {
      week = { kind: 'week', key: wk, label: agendaWeekLabel(wk, todayStr), count: 0 };
      rows.push(week);
      gap = null;
    }
    week.count += countOf(day);
    if (!hasContent(day) && !day.isToday) {
      if (gap) gap.to = day.dateStr;
      else {
        gap = { kind: 'gap', from: day.dateStr, to: day.dateStr };
        rows.push(gap);
      }
      continue;
    }
    gap = null;
    rows.push({ kind: 'day', day });
  }
  for (const r of rows) if (r.kind === 'gap') r.label = agendaGapLabel(r.from, r.to);
  return rows;
}

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

  if (task.due_date === todayStr && task.due_time && typeof nowMinutes === 'number') {
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
 * Thuật toán giải quyết sự kiện trùng giờ (Overlapping Event Column Allocation).
 * Tương tự thuật toán của Google Calendar:
 * 1. Tách các task có giờ cụ thể trong ngày.
 * 2. Tìm các cụm task giao nhau về dải thời gian [start, end].
 * 3. Gán chỉ số cột `colIndex` (0, 1, ...) và tổng số cột `totalCols` cho mỗi task.
 * 4. Tính tọa độ CSS `top`, `height`, `left`, `width`.
 *
 * @param {Array<Object>} tasks - Danh sách task trong ngày
 * @param {number} defaultDurationMinutes - Mặc định 45 phút nếu task không có duration
 * @param {number} pxPerHour - Chiều cao 1 giờ bằng pixel (mặc định 56px)
 * @returns {{ allDayTasks: Array<Object>, timedTasks: Array<Object> }}
 */
export function computeDayLayout(tasks = [], defaultDurationMinutes = 45, pxPerHour = 56) {
  const allDayTasks = [];
  const timed = [];

  for (const t of tasks) {
    const start = timeToMinutes(t.due_time);
    if (start === null) {
      allDayTasks.push(t);
    } else {
      const dur = Math.max(15, Number(t.duration) || defaultDurationMinutes);
      const end = Math.min(1440, start + dur);
      timed.push({
        task: t,
        start,
        end,
        duration: dur,
      });
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
      const height = Math.max(22, Math.round(ev.duration * pxPerMinute) - 2); // Trừ 2px khoảng cách viền
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
          timeRangeLabel: formatTimeRange(ev.task.due_time, ev.duration),
        },
      });
    }
  }

  return { allDayTasks, timedTasks };
}

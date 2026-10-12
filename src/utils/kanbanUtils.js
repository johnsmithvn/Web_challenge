/**
 * kanbanUtils — logic thuần của bảng Kanban (TaskKanbanView), tách khỏi React để
 * test bằng node:assert (src/__tests__/tasks/kanbanLogic.test.js).
 */
import { toDateStr } from './dateUtils.js';

/**
 * Khoảng ngày của bộ lọc thời gian. `null` = 'all' (không giới hạn).
 * @param {'all'|'today'|'7d'|'custom'} timeFilter
 * @param {string} today - YYYY-MM-DD địa phương
 * @param {{customFrom?: string, customTo?: string}} custom
 * @returns {{from: string, to: string} | null}
 */
export function getKanbanRange(timeFilter, today, custom = {}) {
  const { customFrom, customTo } = custom || {};
  if (timeFilter === 'today') return { from: today, to: today };
  if (timeFilter === '7d') {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() + 7);
    return { from: today, to: toDateStr(d) };
  }
  if (timeFilter === 'late') {
    const y = new Date(`${today}T00:00:00`);
    y.setDate(y.getDate() - 1);
    return { from: '1970-01-01', to: toDateStr(y) };
  }
  if (timeFilter === 'custom') return { from: customFrom, to: customTo };
  return null;
}

// Task không hạn xếp cuối cột.
const byDueThenPriority = (a, b) => {
  const ad = a.due_date || '';
  const bd = b.due_date || '';
  if (ad !== bd) {
    if (!ad) return 1;
    if (!bd) return -1;
    return ad.localeCompare(bd);
  }
  return (b.priority || 0) - (a.priority || 0);
};

/**
 * Chia task vào 4 cột.
 *   - To Do / Doing / Skip: task chưa xong theo `status`, lọc theo `due_date` — task
 *     không hạn chỉ hiện khi không lọc ('all'), lọc theo ngày thì không có ngày để khớp.
 *   - Done: task đã xong, lọc theo NGÀY HOÀN THÀNH địa phương. Query
 *     getCompletedTasksRange đệm ±1 ngày (lệch múi giờ) nên phải lọc lại ở đây —
 *     không thì "Hôm nay" lẫn task xong hôm qua/hôm sau.
 *
 * @param {Array<Object>} openTasks - task chưa xong (pending + skipped của useUserTasks)
 * @param {Array<Object>} completedTasks - task đã xong (fetch theo khoảng + optimistic)
 * @param {{from: string, to: string} | null} range - từ getKanbanRange
 */
export function groupKanbanColumns(openTasks = [], completedTasks = [], range = null) {
  const inRange = (d) => !range || (d >= range.from && d <= range.to);
  const todo = [];
  const doing = [];
  const skip = [];
  const doneMap = new Map();

  for (const t of completedTasks) {
    if (t.completed && t.completed_at && inRange(toDateStr(new Date(t.completed_at)))) {
      doneMap.set(t.id, t);
    }
  }

  for (const t of openTasks) {
    if (t.completed || !inRange(t.due_date)) continue;
    if (t.status === 'doing') doing.push(t);
    else if (t.status === 'skip') skip.push(t);
    else todo.push(t);
  }

  todo.sort(byDueThenPriority);
  doing.sort(byDueThenPriority);
  skip.sort(byDueThenPriority);
  const done = Array.from(doneMap.values())
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));

  return { todo, doing, skip, done };
}

/**
 * Chuẩn hóa chuỗi tiếng Việt (bỏ dấu, chuyển đ/Đ thành d, chữ thường)
 * để so khớp tìm kiếm không phân biệt dấu.
 */
export const normVi = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();

/**
 * So khớp task với từ khóa tìm kiếm:
 * - So khớp qua title, description, tags (_tags hoặc tags mảng string), và subtasks.
 * - Hỗ trợ gõ `#tennhan` để tìm chính xác theo tag.
 * - Hỗ trợ nhập nhiều từ khóa cách nhau bởi khoảng trắng (tất cả các từ đều phải xuất hiện).
 * - Bỏ qua dấu tiếng Việt (ví dụ: "hop" khớp "Họp", "di cho" khớp "Đi chợ").
 *
 * @param {Object} task
 * @param {string} query
 * @param {Array<string>} subtaskTitles - danh sách tiêu đề việc con của task
 * @returns {boolean}
 */
export function matchTaskSearch(task, query, subtaskTitles = []) {
  if (!query || !query.trim()) return true;
  const tagNames = (task._tags || task.tags || [])
    .map((tg) => (typeof tg === 'string' ? tg : tg?.name || ''))
    .filter(Boolean);
  const tagWithHash = tagNames.map((g) => '#' + g);

  const hay = normVi([
    task.title || '',
    task.description || '',
    ...subtaskTitles,
    ...tagNames,
    ...tagWithHash,
  ].join(' '));

  const words = normVi(query.trim()).split(/\s+/).filter(Boolean);
  return words.every((w) => hay.includes(w));
}

/**
 * Tính số đếm cho 4 pills lọc thời gian của Kanban:
 * - all: tổng tất cả các việc đang mở + hoàn thành hôm nay
 * - today: việc có hạn hôm nay + việc đã hoàn thành hôm nay
 * - 7d: việc có hạn trong 7 ngày tới + việc đã hoàn thành hôm nay
 * - late: việc quá hạn chưa hoàn thành (không tính skip)
 * Đồng thời áp dụng từ khóa tìm kiếm (nếu có).
 */
export function calculateKanbanCounts({
  pendingTasks = [],
  skippedTasks = [],
  completedToday = [],
  completedRecent = null,
  today,
  searchQuery = '',
  subtasksByParent = new Map(),
}) {
  const in7DaysDate = new Date(`${today}T00:00:00`);
  in7DaysDate.setDate(in7DaysDate.getDate() + 7);
  const in7Days = toDateStr(in7DaysDate);

  const filterFn = (t) => {
    if (!searchQuery || !searchQuery.trim()) return true;
    const subs = subtasksByParent.get(t.id) || [];
    return matchTaskSearch(t, searchQuery, subs);
  };

  const allPending = pendingTasks.filter(filterFn);
  const allSkipped = skippedTasks.filter(filterFn);
  const allCompletedToday = completedToday.filter(filterFn);
  // 'Tất cả' đếm đúng tập việc xong mà cột Hoàn thành đang hiện (vd 30 ngày gần nhất)
  const allCompleted = completedRecent ? completedRecent.filter(filterFn) : allCompletedToday;

  let todayCount = allCompletedToday.length;
  let next7dCount = allCompletedToday.length;
  let lateCount = 0;

  for (const t of allPending) {
    if (!t.due_date) continue;
    if (t.due_date < today) {
      lateCount++;
    } else if (t.due_date === today) {
      todayCount++;
      next7dCount++;
    } else if (t.due_date <= in7Days) {
      next7dCount++;
    }
  }

  return {
    all: allPending.length + allSkipped.length + allCompleted.length,
    today: todayCount,
    '7d': next7dCount,
    late: lateCount,
  };
}

/** Biến CSS --k-* của tình trạng thời gian k (late/today/soon/none/done/skip) — xem token --tk-ks-*. */
export const ksStyle = (k) => ({
  '--k-glow': `var(--tk-ks-${k}-glow)`,
  '--k-tint': `var(--tk-ks-${k}-tint)`,
  '--k-fg': `var(--tk-ks-${k}-fg)`,
  '--k-bg': `var(--tk-ks-${k}-bg)`,
  '--k-bd': `var(--tk-ks-${k}-bd)`,
});

/** Trạng thái việc theo mockup: icon + màu dùng chung cho thẻ, popover, ngăn chi tiết. */
export const STATUS_META = {
  todo: { label: 'Cần làm', icon: 'circle', weight: 'regular', color: 'var(--tk-st-todo)' },
  doing: { label: 'Đang làm', icon: 'circleHalf', weight: 'regular', color: 'var(--tk-st-doing)' },
  done: { label: 'Xong', icon: 'checkCircle', weight: 'fill', color: 'var(--tk-st-done)' },
  skip: { label: 'Bỏ qua', icon: 'minusCircle', weight: 'regular', color: 'var(--tk-st-skip)' },
};

/** Khoá trạng thái thống nhất (DB có thể lưu 'completed' hoặc completed=true). */
export const statusKeyOf = (task) =>
  task?.completed || task?.status === 'done' || task?.status === 'completed'
    ? 'done'
    : task?.status === 'doing' || task?.status === 'skip'
    ? task.status
    : 'todo';

// ── Mô hình thẻ việc (đúng logic card() của mockup) ───────────────────────

const VI_DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const dayDiffStr = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);

/**
 * Nhãn ngày thân thiện: Hôm nay / Ngày mai / Hôm qua / "T2 12/10" (trong 6 ngày tới) / "12 thg 10".
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} today YYYY-MM-DD
 */
export function dueDayLabel(dateStr, today) {
  const n = dayDiffStr(today, dateStr);
  if (n === 0) return 'Hôm nay';
  if (n === 1) return 'Ngày mai';
  if (n === -1) return 'Hôm qua';
  const d = new Date(`${dateStr}T00:00:00`);
  if (n > 1 && n < 7) return `${VI_DOW[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  return `${d.getDate()} thg ${d.getMonth() + 1}`;
}

/**
 * Dữ liệu hiển thị của 1 thẻ việc — dùng chung cho Kanban, Danh sách, Lịch biểu, mobile.
 *   k: tình trạng thời gian 'late' | 'today' | 'soon' | 'none' | 'done' | 'skip' (màu --tk-ks-*)
 *   badge: nhãn ngày { text (đủ, làm tooltip), short, card (gọn trên thẻ), icon, dashed }
 *   late: "trễ N ngày" | ''
 *   run: thời gian làm thực tế { icon, text } | null (đang làm: "từ d/m HH:MM", xong: thời lượng)
 * @param {Object} task
 * @param {string} today YYYY-MM-DD
 */
export function taskCardModel(task, today) {
  const st = statusKeyOf(task);
  const done = st === 'done';
  const skip = st === 'skip';
  let k = 'none';
  let late = '';
  if (done) k = 'done';
  else if (skip) k = 'skip';
  else if (task.due_date) {
    const n = dayDiffStr(today, task.due_date);
    if (n < 0) {
      k = 'late';
      late = `trễ ${-n} ngày`;
    } else k = n === 0 ? 'today' : 'soon';
  }
  const tm = task.due_time ? task.due_time.slice(0, 5) : '';
  const dT = task.due_date ? dueDayLabel(task.due_date, today) + (tm ? `, ${tm}` : '') : '';
  const doneAt = task.completed_at ? new Date(task.completed_at) : null;
  const text = {
    late: `Quá hạn · ${dT}`,
    today: `Hôm nay${tm ? ` · ${tm}` : ''}`,
    soon: dT,
    none: 'Đặt hạn',
    done: `Hoàn thành${doneAt ? ` · ${doneAt.getDate()}/${doneAt.getMonth() + 1}` : ''}`,
    skip: `Bỏ qua${task.due_date ? ` · ${dT}` : ''}`,
  }[k];
  const icon = { late: 'warning', today: 'clock', soon: 'calendar', none: 'calendar', done: 'check', skip: 'minusCircle' }[k];
  // Nhãn gọn trên thẻ (mockup mới): trễ → chỉ "15/9", sắp tới → "11/10 09:00"; câu đủ nằm ở tooltip
  const dm = task.due_date ? `${Number(task.due_date.slice(8, 10))}/${Number(task.due_date.slice(5, 7))}` : '';
  const card = k === 'late' ? dm : k === 'soon' ? `${dm}${tm ? ` ${tm}` : ''}` : text;

  let run = null;
  if (task.started_at && (st === 'doing' || done)) {
    const s = new Date(task.started_at);
    const hm = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
    if (done && task.completed_at) {
      const mins = Math.max(0, Math.round((new Date(task.completed_at) - s) / 60000));
      const d = Math.floor(mins / 1440);
      const h = Math.floor((mins % 1440) / 60);
      const m = mins % 60;
      run = { icon: 'timer', text: d ? `${d} ngày${h ? ` ${h}g` : ''}` : h ? `${h}g${m ? ` ${m}p` : ''}` : `${m} phút` };
    } else if (!done) {
      run = { icon: 'play', text: `từ ${s.getDate()}/${s.getMonth() + 1} ${hm}` };
    }
  }

  const pr = Number(task.priority) || 0;
  return {
    st,
    done,
    skip,
    k,
    late,
    badge: { text, short: text.replace(/^Quá hạn · /, ''), card, icon, dashed: k === 'none' },
    hasPriority: pr > 0 && !done,
    canSetPriority: pr === 0 && !done && !skip,
    priority: pr,
    run,
    tags: (task._tags || []).map((t) => t.name).filter(Boolean),
    repeat: !!task.recurrence_rule,
  };
}

/**
 * Chuỗi ngày làm xong hết việc (cây chuỗi ngày của kiểu Rừng tiên).
 * Một ngày được tính khi có ≥1 việc tới hạn ngày đó và tất cả đã xong; ngày không có việc thì bỏ qua
 * (không cộng, không đứt). Hôm nay còn việc dở thì chưa tính nhưng không làm đứt chuỗi.
 * Đếm lùi từ hôm nay, dừng ở ngày đầu tiên còn việc chưa xong; nhìn tối đa `maxDays` ngày.
 * @param {{ due_date?: string, done: boolean }[]} items việc cấp cao, đã bỏ việc "Bỏ qua"
 * @param {string} today YYYY-MM-DD
 * @param {number} [maxDays=60]
 * @returns {number}
 */
export function computeDoneStreak(items, today, maxDays = 60) {
  const byDay = new Map();
  for (const t of items) {
    if (!t.due_date || t.due_date > today) continue;
    const d = byDay.get(t.due_date) || { total: 0, done: 0 };
    d.total += 1;
    if (t.done) d.done += 1;
    byDay.set(t.due_date, d);
  }
  let streak = 0;
  const cur = new Date(`${today}T00:00:00`);
  for (let i = 0; i < maxDays; i++) {
    const key = toDateStr(cur);
    const d = byDay.get(key);
    if (d) {
      if (d.done === d.total) streak += 1;
      else if (i > 0) break; // hôm nay còn dở: chưa tính, đi tiếp về hôm qua
    }
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

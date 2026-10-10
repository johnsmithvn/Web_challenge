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


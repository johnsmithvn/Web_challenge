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
export function getKanbanRange(timeFilter, today, { customFrom, customTo } = {}) {
  if (timeFilter === 'today') return { from: today, to: today };
  if (timeFilter === '7d') {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() + 7);
    return { from: today, to: toDateStr(d) };
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

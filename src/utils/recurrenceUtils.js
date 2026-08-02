/**
 * recurrenceUtils — logic thuần cho task lặp lại (recurrence_rule + recurrence_parent_id).
 *
 * Tách riêng khỏi useUserTasks.js (không đụng Supabase/React) để test được bằng
 * node:assert thường, không cần mock. Xem src/__tests__/recurrenceUtils.test.js.
 */
import { toDateStr } from './dateUtils.js';

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate(); // month 0-indexed
}

function nextWeekday(fromDateStr, targetDay) {
  const d = new Date(fromDateStr);
  const current = d.getDay();
  let diff = targetDay - current;
  if (diff <= 0) diff += 7; // luôn nhảy tới lần XUẤT HIỆN TIẾP THEO, không phải hôm nay
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

/**
 * Ngày lặp hàng tháng — clamp về ngày CUỐI THÁNG nếu tháng đích không đủ ngày
 * (vd đặt lặp "ngày 31" nhưng tháng sau chỉ có 30 ngày → rơi vào ngày 30, không
 * để JS tự tràn sang ngày đầu tháng kế tiếp nữa).
 */
function nextMonthDay(fromDateStr, targetDay) {
  const d = new Date(fromDateStr);
  const today = d.getDate();
  let year = d.getFullYear();
  let month = d.getMonth();
  if (today >= targetDay) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  const clampedDay = Math.min(targetDay, daysInMonth(year, month));
  return toDateStr(new Date(year, month, clampedDay));
}

/**
 * Tính ngày đến hạn của occurrence tiếp theo.
 * @param {{type:'interval',days:number}|{type:'weekly',weekday:number}|{type:'monthly',day:number}} rule
 * @param {string} fromDateStr — ngày gốc để tính từ đó (yyyy-MM-dd)
 * @returns {string|null} — null nếu rule.type không xác định
 */
export function computeNextDueDate(rule, fromDateStr) {
  if (!rule) return null;
  if (rule.type === 'interval') return addDays(fromDateStr, rule.days);
  if (rule.type === 'weekly') return nextWeekday(fromDateStr, rule.weekday);
  if (rule.type === 'monthly') return nextMonthDay(fromDateStr, rule.day);
  return null;
}

/**
 * Cho 1 danh sách task {id, recurrence_parent_id} + 1 id bị xoá → trả về TOÀN
 * BỘ id cần xoá theo, đúng quy tắc đã chốt:
 * - Task GỐC (recurrence_parent_id rỗng) → chỉ xoá đúng nó, không cascade.
 * - Task KHÔNG PHẢI gốc (tự nó được sinh ra) → xoá nó + toàn bộ hậu duệ phía sau.
 *
 * Dùng để dọn state cục bộ (React) khớp với thật — phần xoá thật dưới DB nằm ở
 * useUserTasks.js (detach-trước-nếu-là-gốc, để CASCADE lo phần còn lại).
 *
 * @param {Array<{id:string, recurrence_parent_id:?string}>} tasks
 * @param {string} targetId
 * @returns {string[]}
 */
export function resolveDeletionIds(tasks, targetId) {
  const target = tasks.find(t => t.id === targetId);
  if (!target || !target.recurrence_parent_id) return [targetId];

  const result = [targetId];
  const collectDescendants = (id) => {
    for (const child of tasks.filter(t => t.recurrence_parent_id === id)) {
      result.push(child.id);
      collectDescendants(child.id);
    }
  };
  collectDescendants(targetId);
  return result;
}

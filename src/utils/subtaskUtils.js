/**
 * subtaskUtils — logic thuần của checklist việc con (`user_tasks.subtasks`, v6.18.0).
 * Mỗi việc con: { id, title, done, due_date: 'YYYY-MM-DD' | null }; thứ tự mảng =
 * thứ tự hiển thị. Mọi hàm trả MẢNG MỚI (không mutate) để dùng thẳng làm payload
 * updateTask và state React. Test: src/__tests__/tasks/subtaskUtils.test.js.
 */

const asList = (list) => (Array.isArray(list) ? list : []);

/** Thêm việc con vào cuối; tiêu đề rỗng → giữ nguyên danh sách. */
export function addSubtask(list, title, id = crypto.randomUUID()) {
  const clean = String(title ?? '').trim();
  if (!clean) return asList(list);
  return [...asList(list), { id, title: clean, done: false, due_date: null }];
}

export function toggleSubtask(list, id) {
  return asList(list).map((s) => (s.id === id ? { ...s, done: !s.done } : s));
}

/** Đổi tên; tên rỗng → bỏ qua (xoá phải đi qua removeSubtask cho rõ ý). */
export function renameSubtask(list, id, title) {
  const clean = String(title ?? '').trim();
  if (!clean) return asList(list);
  return asList(list).map((s) => (s.id === id ? { ...s, title: clean } : s));
}

export function setSubtaskDue(list, id, dueDate) {
  return asList(list).map((s) => (s.id === id ? { ...s, due_date: dueDate || null } : s));
}

export function removeSubtask(list, id) {
  return asList(list).filter((s) => s.id !== id);
}

/** Kéo thả: đưa phần tử ở `from` sang vị trí `to`. Index ngoài khoảng → giữ nguyên. */
export function moveSubtask(list, from, to) {
  const arr = [...asList(list)];
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
  return arr;
}

export function subtaskProgress(list) {
  const items = asList(list);
  return { done: items.filter((s) => s.done).length, total: items.length };
}

/** Việc con chưa xong có hạn trước hôm nay. */
export function isSubtaskOverdue(item, todayStr) {
  return Boolean(item && !item.done && item.due_date && item.due_date < todayStr);
}

function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Số ngày từ a đến b (YYYY-MM-DD), theo lịch địa phương. */
export function daysBetween(a, b) {
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`);
  return Math.round(ms / 86_400_000);
}

/**
 * Checklist cho kỳ lặp tiếp theo: bỏ tick hết, hạn riêng dời cùng khoảng với
 * hạn của task (task dời 7 ngày → hạn việc con cũng dời 7 ngày).
 */
export function resetSubtasksForNextOccurrence(list, shiftDays = 0) {
  return asList(list).map((s) => ({
    ...s,
    done: false,
    due_date: s.due_date ? shiftDate(s.due_date, shiftDays) : null,
  }));
}

const fmtDM = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/**
 * 1 câu ngắn mô tả thay đổi checklist cho activity log (thay vì lưu nguyên JSON).
 * null = không có gì đổi. Nhiều thay đổi (sửa trong form) → nối "; ", tối đa 3 ý.
 */
export function summarizeSubtaskChange(oldList, newList) {
  const before = asList(oldList);
  const after = asList(newList);
  const oldById = new Map(before.map((s) => [s.id, s]));
  const newIds = new Set(after.map((s) => s.id));
  const parts = [];

  for (const s of after) {
    const prev = oldById.get(s.id);
    if (!prev) { parts.push(`Thêm: ${s.title}`); continue; }
    if (prev.done !== s.done) parts.push(`${s.done ? 'Xong' : 'Bỏ tick'}: ${s.title}`);
    if (prev.title !== s.title) parts.push(`Đổi tên: ${prev.title} → ${s.title}`);
    if ((prev.due_date || null) !== (s.due_date || null)) {
      parts.push(s.due_date ? `Hạn ${fmtDM(s.due_date)}: ${s.title}` : `Bỏ hạn: ${s.title}`);
    }
  }
  for (const s of before) {
    if (!newIds.has(s.id)) parts.push(`Xoá: ${s.title}`);
  }

  if (parts.length === 0) {
    const kept = before.filter((s) => newIds.has(s.id)).map((s) => s.id).join();
    const order = after.filter((s) => oldById.has(s.id)).map((s) => s.id).join();
    return kept !== order ? 'Sắp xếp lại' : null;
  }
  return parts.length > 3 ? `${parts.slice(0, 3).join('; ')} (+${parts.length - 3})` : parts.join('; ');
}

// ── Task con liên kết (`user_tasks.parent_task_id`, v6.19.0) ────────────────
// Khác checklist ở trên: task con là row user_tasks thật, chỉ mang thêm parent_task_id.

/**
 * Danh sách task con của 1 task cha để hiện trong popup Chi tiết.
 * `fetched` = query DB theo parent_task_id (đủ cả task con đã xong ngày cũ);
 * `stateTasks` = state của useUserTasks (mới hơn: optimistic tick/sửa/tạo). Bản
 * trong state thắng; task trong state đã bị gỡ khỏi cha thì loại.
 * Sắp xếp: chưa xong trước (hạn sớm, ưu tiên cao), đã xong sau (xong gần nhất trước).
 */
export function mergeChildTasks(parentId, fetched = [], stateTasks = []) {
  const byId = new Map();
  for (const t of fetched) byId.set(t.id, t);
  for (const t of stateTasks) {
    if (t.parent_task_id === parentId) byId.set(t.id, t);
    else if (byId.has(t.id)) byId.delete(t.id);
  }
  const open = [];
  const done = [];
  for (const t of byId.values()) (t.completed ? done : open).push(t);
  open.sort((a, b) =>
    (a.due_date || '').localeCompare(b.due_date || '') || (b.priority || 0) - (a.priority || 0));
  done.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  return [...open, ...done];
}

/** Map parentId → số task con CHƯA xong, từ state (mọi task chưa xong đều nằm trong state). */
export function countOpenChildren(tasks = []) {
  const counts = new Map();
  for (const t of tasks) {
    if (t.parent_task_id && !t.completed) counts.set(t.parent_task_id, (counts.get(t.parent_task_id) || 0) + 1);
  }
  return counts;
}

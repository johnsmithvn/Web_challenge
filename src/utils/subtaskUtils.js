/**
 * subtaskUtils — logic thuần của SUBTASK (v6.20.0).
 *
 * Subtask = row `user_tasks` có `parent_task_id`: đủ chi tiết như task thường (bấm vào
 * mở popup Chi tiết) nhưng CHỈ hiện bên trong task cha — Kanban/Danh sách/Lịch/số đếm
 * bỏ qua. Thay checklist JSONB `subtasks` của v6.18.0 (cột cũ không còn dùng).
 * Test: src/__tests__/tasks/subtaskUtils.test.js.
 */

/** Subtask = task có task cha. */
export const isSubtask = (t) => Boolean(t?.parent_task_id);

/**
 * Thứ tự hiển thị trong task cha: `sort_order` (kéo thả) tăng dần; NULL (chưa từng
 * kéo thả, hoặc mới thêm) xếp sau, theo thứ tự tạo.
 */
export function sortSubtasks(list = []) {
  return [...list].sort((a, b) => {
    const ao = a.sort_order ?? Infinity;
    const bo = b.sort_order ?? Infinity;
    if (ao !== bo) return ao - bo;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });
}

/**
 * Subtask của 1 task cha để hiện trong popup Chi tiết. `fetched` = query DB (đủ cả
 * subtask của task cha đã xong ngày cũ — không có trong state); `stateTasks` = state
 * useUserTasks (mới hơn: optimistic tick/sửa/tạo) → bản trong state thắng.
 */
export function mergeSubtasks(parentId, fetched = [], stateTasks = []) {
  const byId = new Map();
  for (const t of fetched) byId.set(t.id, t);
  for (const t of stateTasks) {
    if (t.parent_task_id === parentId) byId.set(t.id, t);
    else if (byId.has(t.id)) byId.delete(t.id);
  }
  return sortSubtasks([...byId.values()]);
}

/** Map parentId → { done, total } cho badge `☑ 2/4` trên thẻ task cha. */
export function subtaskProgressByParent(tasks = []) {
  const map = new Map();
  for (const t of tasks) {
    if (!t.parent_task_id) continue;
    const p = map.get(t.parent_task_id) || { done: 0, total: 0 };
    p.total += 1;
    if (t.completed) p.done += 1;
    map.set(t.parent_task_id, p);
  }
  return map;
}

/** Kéo thả: đưa phần tử ở `from` sang vị trí `to`. Index ngoài khoảng → giữ nguyên. */
export function moveItem(list, from, to) {
  const arr = [...list];
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
  return arr;
}

/** Đánh số lại theo thứ tự mới; chỉ trả subtask có sort_order thật sự đổi (đỡ ghi DB thừa). */
export function reorderChanges(ordered = []) {
  return ordered
    .map((t, i) => ({ id: t.id, sort_order: i, prev: t.sort_order ?? null }))
    .filter((c) => c.prev !== c.sort_order)
    .map(({ id, sort_order }) => ({ id, sort_order }));
}

/** Số ngày từ a đến b (YYYY-MM-DD), theo lịch địa phương. */
export function daysBetween(a, b) {
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`);
  return Math.round(ms / 86_400_000);
}

/** Dời ngày YYYY-MM-DD đi `days` ngày; không có ngày (task không hạn) → null. */
export function shiftDate(dateStr, days) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Payload insert subtask cho kỳ lặp tiếp theo của task cha: chưa xong, Hạn và Bắt đầu
 * dời cùng khoảng với hạn task cha, giữ thứ tự. Bản copy KHÔNG mang recurrence riêng (tránh
 * mỗi kỳ cha lại đẻ thêm 1 chuỗi lặp con). Thiếu `user_id` — hook tự thêm.
 */
export function subtaskCopiesForNextOccurrence(children = [], newParentId, shiftDays = 0) {
  return sortSubtasks(children).map((c) => ({
    title: c.title,
    description: c.description ?? null,
    due_date: shiftDate(c.due_date, shiftDays),
    due_time: c.due_time ?? null,
    start_date: shiftDate(c.start_date, shiftDays),
    start_time: c.start_time ?? null,
    priority: c.priority || 0,
    parent_task_id: newParentId,
    sort_order: c.sort_order ?? null,
    completed: false,
    notified: false,
  }));
}

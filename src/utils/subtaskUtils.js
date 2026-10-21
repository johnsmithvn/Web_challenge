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

const priorityOf = (t) => Number(t?.priority) || 0;
const byPriorityDesc = (a, b) => priorityOf(b) - priorityOf(a);

/** Đã xong hoặc bỏ qua (cùng luật statusKeyOf của kanbanUtils). */
const isClosed = (t) => Boolean(t?.completed) || t?.status === 'done' || t?.status === 'completed' || t?.status === 'skip';

/** Nhóm hiển thị (v6.30.0): 0 = đang làm (lên đầu) · 1 = chưa làm · 2 = xong / bỏ qua (xuống cuối). */
export function subtaskGroup(t) {
  if (isClosed(t)) return 2;
  return t?.status === 'doing' ? 0 : 1;
}
const byGroupThenPriority = (a, b) => subtaskGroup(a) - subtaskGroup(b) || byPriorityDesc(a, b);

// Thứ tự tự xếp (không xét trạng thái): ưu tiên → kéo thả → lúc tạo
const byManualOrder = (a, b) => {
  const pd = byPriorityDesc(a, b);
  if (pd) return pd;
  const ao = a.sort_order ?? Infinity;
  const bo = b.sort_order ?? Infinity;
  if (ao !== bo) return ao - bo;
  return (a.created_at || '').localeCompare(b.created_at || '');
};

/**
 * Thứ tự hiển thị trong task cha: việc con đang làm lên đầu, xong / bỏ qua xuống cuối;
 * trong mỗi nhóm: ưu tiên cao trước (Khẩn → Không), cùng mức thì `sort_order` (kéo thả)
 * tăng dần; NULL (chưa từng kéo thả, hoặc mới thêm) xếp sau, theo thứ tự tạo.
 */
export function sortSubtasks(list = []) {
  return [...list].sort((a, b) => subtaskGroup(a) - subtaskGroup(b) || byManualOrder(a, b));
}

/**
 * Bấm "Đang làm" trên 1 việc con → danh sách { id, status } cần ghi. Mỗi task cha chỉ 1 việc
 * con đang làm: việc khác đang làm về `todo`. Bấm lại việc đang làm = về `todo`. Việc đã xong /
 * bỏ qua không đổi (bỏ đánh dấu xong trước). `siblings` = việc con cùng task cha (có thể thiếu
 * `target` nếu nó không nằm trong state).
 */
export function subtaskFocusChanges(siblings = [], target) {
  if (!target || isClosed(target)) return [];
  if (target.status === 'doing') return [{ id: target.id, status: 'todo' }];
  return [
    ...siblings.filter((s) => s.id !== target.id && s.status === 'doing' && !isClosed(s)).map((s) => ({ id: s.id, status: 'todo' })),
    { id: target.id, status: 'doing' },
  ];
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

/**
 * Kéo thả trên danh sách đã xếp (sortSubtasks): đưa `from` sang `to` rồi xếp lại (ổn định)
 * theo nhóm trạng thái + ưu tiên → việc con chỉ đổi chỗ trong nhóm cùng trạng thái & mức ưu
 * tiên; kéo quá ranh giới thì dừng ở đầu/cuối nhóm. Đổi nhóm = đổi ưu tiên / trạng thái.
 */
export function reorderByDrag(list, from, to) {
  return moveItem(list, from, to).sort(byGroupThenPriority);
}

/**
 * Index thả khi kéo bằng con trỏ: số hàng KHÁC hàng đang kéo có tâm nằm trên `y`.
 * `mids` = tâm dọc từng hàng (Infinity = hàng không hiển thị) → dùng thẳng cho moveItem.
 */
export function dropIndexAt(mids, from, y) {
  return mids.filter((m, i) => i !== from && m < y).length;
}

/** Đánh số lại theo thứ tự mới; chỉ trả subtask có sort_order thật sự đổi (đỡ ghi DB thừa). */
export function reorderChanges(ordered = []) {
  return ordered
    .map((t, i) => ({ id: t.id, sort_order: i, prev: t.sort_order ?? null }))
    .filter((c) => c.prev !== c.sort_order)
    .map(({ id, sort_order }) => ({ id, sort_order }));
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dmShort = (v) => `${Number(v.slice(8, 10))}/${Number(v.slice(5, 7))}`;
export const SUBTASK_SOON_MIN = 60; // còn ≤ 60 phút tới giờ hạn → nhắc mạnh

/**
 * Chip nhắc hạn của 1 việc con (v6.30.0). Chỉ hiện khi việc con có đặt giờ hạn hoặc hạn khác hạn
 * task cha (việc con mặc định lấy hạn task cha — hiện hết thì rối). Xong / bỏ qua → không hiện.
 * tone: 'late' (quá hạn / trễ giờ) · 'soon' (còn ≤ 60 phút) · 'today' · 'upcoming'.
 * Trả null nếu không cần chip. `now` truyền vào để test được.
 */
export function subtaskDueInfo(sub, parentDue = null, now = new Date()) {
  if (!sub?.due_date || isClosed(sub)) return null;
  const time = sub.due_time ? sub.due_time.slice(0, 5) : '';
  if (!time && sub.due_date === parentDue) return null;
  const today = ymd(now);
  const n = daysBetween(today, sub.due_date);
  const at = `${dmShort(sub.due_date)}${time ? ` ${time}` : ''}`;
  if (n < 0) return { tone: 'late', label: at, title: `Quá hạn ${-n} ngày · ${at}` };
  if (n === 0) {
    if (!time) return { tone: 'today', label: 'Hôm nay', title: 'Hạn hôm nay' };
    const [h, m] = time.split(':').map(Number);
    const left = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
    if (left < 0) return { tone: 'late', label: time, title: `Trễ giờ · hạn ${time} hôm nay` };
    if (left <= SUBTASK_SOON_MIN) return { tone: 'soon', label: `còn ${left}p`, title: `Hạn ${time} hôm nay · còn ${left} phút` };
    return { tone: 'today', label: time, title: `Hạn ${time} hôm nay` };
  }
  if (n === 1) return { tone: 'upcoming', label: `Mai${time ? ` ${time}` : ''}`, title: `Hạn ngày mai${time ? ` ${time}` : ''}` };
  return { tone: 'upcoming', label: at, title: `Hạn ${at}` };
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
  // Theo thứ tự tự xếp, không theo trạng thái kỳ cũ (bản copy đều chưa làm)
  return [...children].sort(byManualOrder).map((c) => ({
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

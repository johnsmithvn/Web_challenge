/**
 * subtaskUtils.test.js — subtask = task con ẩn trong task cha (v6.20.0).
 * Chạy: `node src/__tests__/tasks/subtaskUtils.test.js`
 */
import assert from 'node:assert/strict';
import {
  isSubtask, sortSubtasks, mergeSubtasks, subtaskProgressByParent, moveItem,
  reorderChanges, reorderByDrag, dropIndexAt, daysBetween, shiftDate, subtaskCopiesForNextOccurrence,
} from '../../utils/subtaskUtils.js';

const ids = (list) => list.map((t) => t.id);
const P = 'parent';

/* ── 1. Nhận diện + thứ tự hiển thị ─────────────────────────────── */
assert.equal(isSubtask({ parent_task_id: P }), true);
assert.equal(isSubtask({ parent_task_id: null }), false);
assert.equal(isSubtask({}), false, 'task tải trước migration (không có cột) = task thường');

const unordered = [
  { id: 'n2', sort_order: null, created_at: '2026-10-06T02:00:00Z' },
  { id: 's1', sort_order: 1, created_at: '2026-10-06T05:00:00Z' },
  { id: 'n1', created_at: '2026-10-06T01:00:00Z' },
  { id: 's0', sort_order: 0, created_at: '2026-10-06T09:00:00Z' },
];
assert.deepEqual(ids(sortSubtasks(unordered)), ['s0', 's1', 'n1', 'n2'],
  'đã kéo thả (sort_order) trước, chưa có thứ tự thì xếp sau theo lúc tạo');
{
  // v6.29.0: ưu tiên cao lên đầu; cùng mức mới xét thứ tự kéo thả.
  const mixed = [
    { id: 'none0', sort_order: 0 },
    { id: 'low1', priority: 2, sort_order: 1 },
    { id: 'urgent5', priority: 5, sort_order: 5 },
    { id: 'low0', priority: '2', sort_order: 0 },
    { id: 'nullPri', priority: null, sort_order: null, created_at: '2026-10-06T01:00:00Z' },
  ];
  assert.deepEqual(ids(sortSubtasks(mixed)), ['urgent5', 'low0', 'low1', 'none0', 'nullPri'],
    'Khẩn trước; priority chuỗi/NULL vẫn so như số');
}
console.log('isSubtask & sortSubtasks: OK');

/* ── 2. Gộp DB + state cho popup task cha ───────────────────────── */
{
  const fetched = [
    { id: 'old', parent_task_id: P, completed: true, sort_order: 2 },
    { id: 'k1', parent_task_id: P, completed: false, sort_order: 0 },
    { id: 'gone', parent_task_id: P, completed: false, sort_order: 1 },
  ];
  const state = [
    { id: 'k1', parent_task_id: P, completed: true, sort_order: 0 },   // vừa tick trong state
    { id: 'gone', parent_task_id: null, completed: false },            // không còn thuộc task cha này
    { id: 'new', parent_task_id: P, completed: false, created_at: '2026-10-06T10:00:00Z' }, // vừa tạo
    { id: 'other', parent_task_id: 'x', completed: false },
  ];
  const merged = mergeSubtasks(P, fetched, state);
  assert.deepEqual(ids(merged), ['k1', 'old', 'new']);
  assert.equal(merged[0].completed, true, 'bản trong state thắng');
}
console.log('mergeSubtasks: OK');

/* ── 3. Tiến độ cho badge trên thẻ task cha ─────────────────────── */
{
  const progress = subtaskProgressByParent([
    { id: 'a', parent_task_id: P, completed: true },
    { id: 'b', parent_task_id: P, completed: false },
    { id: 'c', parent_task_id: 'q', completed: false },
    { id: P, parent_task_id: null, completed: false },
  ]);
  assert.deepEqual(progress.get(P), { done: 1, total: 2 });
  assert.deepEqual(progress.get('q'), { done: 0, total: 1 });
  assert.equal(progress.get('a'), undefined);
}
console.log('subtaskProgressByParent: OK');

/* ── 4. Kéo thả: chỉ ghi DB những subtask đổi thứ tự ─────────────── */
{
  const list = [{ id: 'a', sort_order: 0 }, { id: 'b', sort_order: 1 }, { id: 'c', sort_order: 2 }];
  assert.deepEqual(ids(moveItem(list, 2, 0)), ['c', 'a', 'b']);
  assert.deepEqual(ids(moveItem(list, 0, 9)), ['a', 'b', 'c'], 'index ngoài khoảng → giữ nguyên');
  assert.deepEqual(reorderChanges(moveItem(list, 2, 0)), [
    { id: 'c', sort_order: 0 }, { id: 'a', sort_order: 1 }, { id: 'b', sort_order: 2 },
  ]);
  assert.deepEqual(reorderChanges(list), [], 'không đổi → không ghi');
  assert.deepEqual(
    reorderChanges([{ id: 'x', sort_order: 0 }, { id: 'y' }]),
    [{ id: 'y', sort_order: 1 }],
    'subtask chưa có thứ tự (NULL) được đánh số khi kéo thả lần đầu'
  );
}
{
  // Danh sách đã xếp theo ưu tiên: [H1 H2 | M1 | L1 L2]
  const list = sortSubtasks([
    { id: 'H1', priority: 4, sort_order: 0 }, { id: 'H2', priority: 4, sort_order: 1 },
    { id: 'M1', priority: 3, sort_order: 2 },
    { id: 'L1', priority: 1, sort_order: 3 }, { id: 'L2', priority: 1, sort_order: 4 },
  ]);
  assert.deepEqual(ids(reorderByDrag(list, 1, 0)), ['H2', 'H1', 'M1', 'L1', 'L2'], 'đổi chỗ trong cùng nhóm');
  assert.deepEqual(ids(reorderByDrag(list, 4, 0)), ['H1', 'H2', 'M1', 'L2', 'L1'],
    'kéo việc thấp lên đầu → dừng ở đầu nhóm của nó, không vượt việc ưu tiên cao');
  assert.deepEqual(ids(reorderByDrag(list, 0, 4)), ['H2', 'H1', 'M1', 'L1', 'L2'],
    'kéo việc cao xuống cuối → dừng ở cuối nhóm của nó');
  assert.deepEqual(ids(reorderByDrag(list, 2, 0)), ids(list), 'nhóm 1 việc → không đổi');
  const dropped = reorderByDrag(list, 4, 3);
  assert.deepEqual(ids(sortSubtasks(dropped.map((t, i) => ({ ...t, sort_order: i })))), ids(dropped),
    'sort_order đánh lại theo index → sortSubtasks giữ đúng thứ tự vừa thả');
  assert.deepEqual(ids(list), ['H1', 'H2', 'M1', 'L1', 'L2'], 'không sửa mảng gốc');
}
{
  // Tâm dọc 3 hàng: 10 · 30 · 50; kéo hàng 0
  assert.equal(dropIndexAt([10, 30, 50], 0, 5), 0, 'trên cùng');
  assert.equal(dropIndexAt([10, 30, 50], 0, 35), 1, 'qua tâm hàng 1 → vị trí 1');
  assert.equal(dropIndexAt([10, 30, 50], 0, 99), 2, 'dưới cùng');
  assert.equal(dropIndexAt([10, 30, 50], 2, 0), 0, 'kéo hàng cuối lên đầu');
  assert.equal(dropIndexAt([10, 30, Infinity], 0, 99), 1, 'hàng ẩn (Infinity) không tính');
}
console.log('moveItem & reorderChanges & reorderByDrag & dropIndexAt: OK');

/* ── 5. Task cha lặp: kỳ sau mang theo subtask, chưa xong, hạn dời theo ── */
assert.equal(daysBetween('2026-10-05', '2026-10-12'), 7);
assert.equal(daysBetween('2026-10-28', '2026-11-04'), 7, 'qua tháng');
assert.equal(shiftDate('2026-10-30', 7), '2026-11-06');
{
  const copies = subtaskCopiesForNextOccurrence([
    { id: 'b', title: 'B', due_date: '2026-10-06', sort_order: 1, completed: true, recurrence_rule: { type: 'interval', days: 1 } },
    { id: 'a', title: 'A', due_date: '2026-10-05', sort_order: 0, completed: true, priority: 3, description: 'ghi chú' },
  ], 'new-parent', 7);
  assert.deepEqual(copies.map((c) => [c.title, c.due_date, c.sort_order, c.completed, c.parent_task_id]), [
    ['A', '2026-10-12', 0, false, 'new-parent'],
    ['B', '2026-10-13', 1, false, 'new-parent'],
  ]);
  assert.equal(copies[0].priority, 3);
  assert.equal(copies[0].description, 'ghi chú');
  assert.equal('recurrence_rule' in copies[1], false, 'bản copy không mang chuỗi lặp riêng');
}
{
  // v6.21.0: Bắt đầu dời cùng khoảng; subtask không ngày giữ không ngày.
  const [withStart, noDate] = subtaskCopiesForNextOccurrence([
    { id: 's', title: 'S', start_date: '2026-10-04', start_time: '09:00', due_date: '2026-10-05', due_time: '10:00', sort_order: 0 },
    { id: 'n', title: 'N', due_date: null, sort_order: 1 },
  ], 'p2', 7);
  assert.deepEqual([withStart.start_date, withStart.start_time, withStart.due_date, withStart.due_time],
    ['2026-10-11', '09:00', '2026-10-12', '10:00']);
  assert.deepEqual([noDate.start_date, noDate.due_date], [null, null]);
  assert.equal('end_time' in withStart, false, 'end_time bỏ từ v6.21.0');
  assert.equal(shiftDate(null, 7), null);
}
console.log('subtaskCopiesForNextOccurrence: OK');

console.log('\n✅ subtaskUtils — subtask trong task cha PASS');

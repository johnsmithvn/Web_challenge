/**
 * subtaskUtils.test.js — checklist việc con (v6.18.0).
 * Chạy: `node src/__tests__/tasks/subtaskUtils.test.js`
 */
import assert from 'node:assert/strict';
import {
  addSubtask, toggleSubtask, renameSubtask, setSubtaskDue, removeSubtask, moveSubtask,
  subtaskProgress, isSubtaskOverdue, resetSubtasksForNextOccurrence, daysBetween,
  summarizeSubtaskChange,
} from '../../utils/subtaskUtils.js';

const titles = (list) => list.map((s) => s.title);

/* ── 1. Thêm / tick / đổi tên / hạn / xoá — luôn trả mảng mới ───── */
let list = addSubtask([], '  Soạn đề cương ', 'a');
list = addSubtask(list, 'Tìm số liệu', 'b');
list = addSubtask(list, '   ', 'x');                 // rỗng → bỏ qua
list = addSubtask(list, 'Làm slide', 'c');
assert.deepEqual(titles(list), ['Soạn đề cương', 'Tìm số liệu', 'Làm slide']);
assert.deepEqual(list[0], { id: 'a', title: 'Soạn đề cương', done: false, due_date: null });
assert.deepEqual(addSubtask(null, 'X', 'z').length, 1, 'null (task cũ trước migration) coi như []');

const ticked = toggleSubtask(list, 'b');
assert.equal(ticked[1].done, true);
assert.equal(list[1].done, false, 'không mutate mảng cũ');
assert.equal(toggleSubtask(ticked, 'b')[1].done, false);

assert.equal(renameSubtask(list, 'c', ' Làm slide 10 trang ')[2].title, 'Làm slide 10 trang');
assert.equal(renameSubtask(list, 'c', '  ')[2].title, 'Làm slide', 'tên rỗng → giữ tên cũ');
assert.equal(setSubtaskDue(list, 'a', '2026-10-07')[0].due_date, '2026-10-07');
assert.equal(setSubtaskDue(setSubtaskDue(list, 'a', '2026-10-07'), 'a', '')[0].due_date, null);
assert.deepEqual(titles(removeSubtask(list, 'b')), ['Soạn đề cương', 'Làm slide']);
console.log('add/toggle/rename/due/remove: OK');

/* ── 2. Kéo thả sắp xếp ─────────────────────────────────────────── */
assert.deepEqual(titles(moveSubtask(list, 2, 0)), ['Làm slide', 'Soạn đề cương', 'Tìm số liệu']);
assert.deepEqual(titles(moveSubtask(list, 0, 2)), ['Tìm số liệu', 'Làm slide', 'Soạn đề cương']);
assert.deepEqual(titles(moveSubtask(list, 0, 9)), titles(list), 'index ngoài khoảng → giữ nguyên');
console.log('moveSubtask: OK');

/* ── 3. Tiến độ + quá hạn ───────────────────────────────────────── */
assert.deepEqual(subtaskProgress(ticked), { done: 1, total: 3 });
assert.deepEqual(subtaskProgress(undefined), { done: 0, total: 0 });
assert.equal(isSubtaskOverdue({ done: false, due_date: '2026-10-04' }, '2026-10-05'), true);
assert.equal(isSubtaskOverdue({ done: true, due_date: '2026-10-04' }, '2026-10-05'), false, 'đã xong thì không quá hạn');
assert.equal(isSubtaskOverdue({ done: false, due_date: '2026-10-05' }, '2026-10-05'), false, 'hạn hôm nay chưa quá');
assert.equal(isSubtaskOverdue({ done: false, due_date: null }, '2026-10-05'), false);
console.log('progress & overdue: OK');

/* ── 4. Task lặp: kỳ sau bỏ tick hết, hạn riêng dời cùng khoảng ───── */
assert.equal(daysBetween('2026-10-05', '2026-10-12'), 7);
assert.equal(daysBetween('2026-10-28', '2026-11-04'), 7, 'qua tháng');
const next = resetSubtasksForNextOccurrence(
  [{ id: 'a', title: 'A', done: true, due_date: '2026-10-30' }, { id: 'b', title: 'B', done: true, due_date: null }],
  7
);
assert.deepEqual(next, [
  { id: 'a', title: 'A', done: false, due_date: '2026-11-06' },
  { id: 'b', title: 'B', done: false, due_date: null },
]);
console.log('resetSubtasksForNextOccurrence: OK');

/* ── 5. Câu tóm tắt cho activity log (không lưu nguyên JSON) ─────── */
assert.equal(summarizeSubtaskChange(list, list), null, 'không đổi → không log');
assert.equal(summarizeSubtaskChange(list, toggleSubtask(list, 'b')), 'Xong: Tìm số liệu');
assert.equal(summarizeSubtaskChange(ticked, list), 'Bỏ tick: Tìm số liệu');
assert.equal(summarizeSubtaskChange([], addSubtask([], 'Tập nói', 'n')), 'Thêm: Tập nói');
assert.equal(summarizeSubtaskChange(list, removeSubtask(list, 'c')), 'Xoá: Làm slide');
assert.equal(summarizeSubtaskChange(list, renameSubtask(list, 'a', 'Dàn ý')), 'Đổi tên: Soạn đề cương → Dàn ý');
assert.equal(summarizeSubtaskChange(list, setSubtaskDue(list, 'a', '2026-10-07')), 'Hạn 07/10: Soạn đề cương');
assert.equal(summarizeSubtaskChange(list, moveSubtask(list, 2, 0)), 'Sắp xếp lại');
assert.equal(summarizeSubtaskChange(null, []), null);
const many = summarizeSubtaskChange([], ['1', '2', '3', '4', '5'].map((t) => ({ id: t, title: t, done: false, due_date: null })));
assert.equal(many, 'Thêm: 1; Thêm: 2; Thêm: 3 (+2)');
console.log('summarizeSubtaskChange: OK');

console.log('\n✅ subtaskUtils — checklist việc con PASS');

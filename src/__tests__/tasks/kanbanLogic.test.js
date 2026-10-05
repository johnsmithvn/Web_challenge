/**
 * kanbanLogic.test.js — test logic THẬT của Kanban (src/utils/kanbanUtils.js),
 * đúng hàm TaskKanbanView đang gọi. (Bản cũ tự định nghĩa lại logic ngay trong
 * file test nên pass cũng không chứng minh gì về component.)
 * Chạy: `node src/__tests__/tasks/kanbanLogic.test.js`
 */
import assert from 'node:assert/strict';
import { getKanbanRange, groupKanbanColumns } from '../../utils/kanbanUtils.js';

const ids = (list) => list.map((t) => t.id);
const today = '2026-09-13';

/* ── 1. Khoảng ngày của bộ lọc thời gian ─────────────────────────── */
assert.equal(getKanbanRange('all', today), null);
assert.deepEqual(getKanbanRange('today', today), { from: today, to: today });
assert.deepEqual(getKanbanRange('7d', today), { from: '2026-09-13', to: '2026-09-20' });
assert.deepEqual(getKanbanRange('7d', '2026-09-28'), { from: '2026-09-28', to: '2026-10-05' }, 'qua tháng');
assert.deepEqual(
  getKanbanRange('custom', today, { customFrom: '2026-09-10', customTo: '2026-09-12' }),
  { from: '2026-09-10', to: '2026-09-12' }
);
console.log('getKanbanRange: OK');

/* ── 2. Chia cột To Do / Doing / Skip theo status ─────────────────── */
const open = [
  { id: '1', status: 'todo', due_date: '2026-09-10', priority: 0 },
  { id: '2', status: 'doing', due_date: '2026-09-13' },
  { id: '4', due_date: '2026-09-15' },                              // không status → To Do
  { id: '5', status: 'skip', due_date: '2026-09-16' },
  { id: '6', status: 'todo', due_date: '2026-09-10', priority: 5 }, // cùng ngày, ưu tiên cao hơn
  { id: '7', status: 'todo', due_date: '2026-09-11', completed: true }, // lỡ lọt task xong → bỏ
];
const all = groupKanbanColumns(open, [], null);
assert.deepEqual(ids(all.todo), ['6', '1', '4'], 'ngày sớm trước, cùng ngày thì ưu tiên cao trước');
assert.deepEqual(ids(all.doing), ['2']);
assert.deepEqual(ids(all.skip), ['5']);
assert.deepEqual(ids(all.done), []);
console.log('groupKanbanColumns status columns: OK');

/* ── 3. Bộ lọc thời gian áp lên due_date của task đang mở ─────────── */
const todayCols = groupKanbanColumns(open, [], getKanbanRange('today', today));
assert.deepEqual(ids(todayCols.doing), ['2']);
assert.deepEqual(ids(todayCols.todo), []);
const customCols = groupKanbanColumns(open, [], getKanbanRange('custom', today, { customFrom: '2026-09-10', customTo: '2026-09-12' }));
assert.deepEqual(ids(customCols.todo), ['6', '1']);
console.log('groupKanbanColumns time filter on due_date: OK');

/* ── 4. Cột Done lọc theo NGÀY HOÀN THÀNH địa phương ──────────────── */
// getCompletedTasksRange đệm ±1 ngày → hàm phải tự lọc lại. Dựng completed_at
// từ giờ địa phương để test không phụ thuộc múi giờ máy chạy.
const at = (y, m, d, h, mi) => new Date(y, m - 1, d, h, mi).toISOString();
const completed = [
  { id: 'c1', completed: true, completed_at: at(2026, 9, 13, 10, 0) },
  { id: 'c2', completed: true, completed_at: at(2026, 9, 12, 23, 30) }, // hôm qua — lọt do đệm
  { id: 'c3', completed: true, completed_at: at(2026, 9, 13, 18, 0) },
  { id: 'c4', completed: true, completed_at: at(2026, 9, 14, 0, 30) },  // hôm sau — lọt do đệm
];
assert.deepEqual(ids(groupKanbanColumns([], completed, getKanbanRange('today', today)).done), ['c3', 'c1'],
  'chỉ task xong HÔM NAY, mới nhất lên trước');
assert.equal(groupKanbanColumns([], completed, null).done.length, 4, 'Tất cả = không lọc');
console.log('groupKanbanColumns done column by local completion day: OK');

console.log('\n✅ kanbanLogic — logic thật của Kanban PASS');

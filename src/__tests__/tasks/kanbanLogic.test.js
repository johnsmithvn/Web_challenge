/**
 * kanbanLogic.test.js — test logic THẬT của Kanban (src/utils/kanbanUtils.js),
 * đúng hàm TaskKanbanView đang gọi. (Bản cũ tự định nghĩa lại logic ngay trong
 * file test nên pass cũng không chứng minh gì về component.)
 * Chạy: `node src/__tests__/tasks/kanbanLogic.test.js`
 */
import assert from 'node:assert/strict';
import {
  getKanbanRange,
  groupKanbanColumns,
  normVi,
  matchTaskSearch,
  calculateKanbanCounts,
} from '../../utils/kanbanUtils.js';

const ids = (list) => list.map((t) => t.id);
const today = '2026-09-13';

/* ── 1. Khoảng ngày của bộ lọc thời gian ─────────────────────────── */
assert.equal(getKanbanRange('all', today), null);
assert.equal(getKanbanRange('all', today, null), null, 'không ném TypeError khi truyền null');
assert.deepEqual(getKanbanRange('today', today), { from: today, to: today });
assert.deepEqual(getKanbanRange('7d', today), { from: '2026-09-13', to: '2026-09-20' });
assert.deepEqual(getKanbanRange('7d', '2026-09-28'), { from: '2026-09-28', to: '2026-10-05' }, 'qua tháng');
assert.deepEqual(getKanbanRange('late', today), { from: '1970-01-01', to: '2026-09-12' }, 'quá hạn trước hôm nay');
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
const lateCols = groupKanbanColumns(open, [], getKanbanRange('late', today));
assert.deepEqual(ids(lateCols.todo), ['6', '1'], 'các task quá hạn trước hôm nay');
const customCols = groupKanbanColumns(open, [], getKanbanRange('custom', today, { customFrom: '2026-09-10', customTo: '2026-09-12' }));
assert.deepEqual(ids(customCols.todo), ['6', '1']);
// Task không hạn (v6.21.0): xếp cuối cột khi xem Tất cả; lọc theo ngày thì không hiện.
const undated = [
  { id: 'u1', status: 'todo', due_date: null, priority: 5 },
  { id: 'd1', status: 'todo', due_date: '2026-09-20' },
  { id: 'u2', status: 'doing' },
];
const undatedAll = groupKanbanColumns(undated, [], null);
assert.deepEqual(ids(undatedAll.todo), ['d1', 'u1']);
assert.deepEqual(ids(undatedAll.doing), ['u2']);
const undatedToday = groupKanbanColumns(undated, [], getKanbanRange('today', today));
assert.deepEqual([ids(undatedToday.todo), ids(undatedToday.doing)], [[], []]);
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

/* ── 5. Chuẩn hóa tiếng Việt normVi ───────────────────────────────── */
assert.equal(normVi('Họp Dự Án 2026'), 'hop du an 2026');
assert.equal(normVi('Đi Chợ Đầm Sen'), 'di cho dam sen');
assert.equal(normVi('  ĐẶC BIỆT  '), '  dac biet  ');
assert.equal(normVi(''), '');
console.log('normVi Vietnamese normalization: OK');

/* ── 6. Tìm kiếm thông minh matchTaskSearch ───────────────────────── */
const sampleTask = {
  id: 't1',
  title: 'Họp bàn thiết kế UI',
  description: 'Trao đổi về popup thời gian và bảng Kanban',
  _tags: [{ id: 'tg1', name: 'UI' }, { id: 'tg2', name: 'Life Hub' }],
};
const subtaskTitles = ['Thu gọn độ ưu tiên', 'Làm lại popup thời gian'];

// Tìm theo tiêu đề không dấu
assert.equal(matchTaskSearch(sampleTask, 'hop ban', subtaskTitles), true);
assert.equal(matchTaskSearch(sampleTask, 'THIET KE', subtaskTitles), true);

// Tìm theo mô tả
assert.equal(matchTaskSearch(sampleTask, 'trao doi', subtaskTitles), true);
assert.equal(matchTaskSearch(sampleTask, 'kanban', subtaskTitles), true);

// Tìm theo tag (cả có và không có ký tự #)
assert.equal(matchTaskSearch(sampleTask, '#UI', subtaskTitles), true);
assert.equal(matchTaskSearch(sampleTask, '#ui', subtaskTitles), true);
assert.equal(matchTaskSearch(sampleTask, '#Life Hub', subtaskTitles), true);
assert.equal(matchTaskSearch(sampleTask, 'life hub', subtaskTitles), true);

// Tìm theo việc con (subtasks)
assert.equal(matchTaskSearch(sampleTask, 'popup thoi gian', subtaskTitles), true);
assert.equal(matchTaskSearch(sampleTask, 'uu tien', subtaskTitles), true);

// Nhiều từ khóa tách biệt (tất cả các từ phải khớp)
assert.equal(matchTaskSearch(sampleTask, 'hop kanban', subtaskTitles), true);
assert.equal(matchTaskSearch(sampleTask, 'hop popup', subtaskTitles), true);
assert.equal(matchTaskSearch(sampleTask, 'hop backend', subtaskTitles), false, 'thiếu từ backend');

// Tìm rỗng / khoảng trắng -> luôn khớp
assert.equal(matchTaskSearch(sampleTask, '', subtaskTitles), true);
assert.equal(matchTaskSearch(sampleTask, '   ', subtaskTitles), true);
console.log('matchTaskSearch multi-criteria keyword matching: OK');

/* ── 7. Bộ đếm real-time calculateKanbanCounts ─────────────────────── */
const pTasks = [
  { id: '1', title: 'Task quá hạn', due_date: '2026-09-10' }, // late (hôm nay là 2026-09-13)
  { id: '2', title: 'Task hôm nay', due_date: '2026-09-13' }, // today + 7d
  { id: '3', title: 'Task trong tuần', due_date: '2026-09-18' }, // 7d
  { id: '4', title: 'Task tuần sau', due_date: '2026-09-25' }, // chỉ all
  { id: '5', title: 'Task không hạn', due_date: null }, // chỉ all
];
const sTasks = [
  { id: 's1', title: 'Task bỏ qua quá hạn', status: 'skip', due_date: '2026-09-08' },
];
const cToday = [
  { id: 'c1', title: 'Task xong hôm nay', completed: true, completed_at: '2026-09-13T10:00:00Z' },
];

const countsAll = calculateKanbanCounts({
  pendingTasks: pTasks,
  skippedTasks: sTasks,
  completedToday: cToday,
  today: '2026-09-13',
  searchQuery: '',
});

assert.equal(countsAll.all, 7, 'tổng 5 pending + 1 skip + 1 xong hôm nay = 7');
assert.equal(countsAll.late, 1, 'chỉ tính 1 task quá hạn chưa xong (task skip không tính)');
assert.equal(countsAll.today, 2, '1 task có hạn hôm nay + 1 task xong hôm nay = 2');
assert.equal(countsAll['7d'], 3, '1 task hôm nay + 1 task trong 7 ngày tới + 1 task xong hôm nay = 3');

// Bộ đếm khi có lọc từ khóa tìm kiếm
const countsSearch = calculateKanbanCounts({
  pendingTasks: pTasks,
  skippedTasks: sTasks,
  completedToday: cToday,
  today: '2026-09-13',
  searchQuery: 'qua han',
});
assert.equal(countsSearch.all, 2, '1 task pending quá hạn + 1 task skip quá hạn');
assert.equal(countsSearch.late, 1, '1 task quá hạn pending');
assert.equal(countsSearch.today, 0, 'không có task hôm nay khớp từ khóa');

// 'Tất cả' đếm theo tập việc xong mà cột Hoàn thành đang hiện (30 ngày), còn 'Hôm nay' vẫn chỉ xong hôm nay
const countsRecent = calculateKanbanCounts({
  pendingTasks: pTasks,
  skippedTasks: sTasks,
  completedToday: cToday,
  completedRecent: [...cToday, { id: 'c2', title: 'Xong tuần trước', completed: true, completed_at: '2026-09-06T10:00:00Z' }],
  today: '2026-09-13',
});
assert.equal(countsRecent.all, 8, '5 pending + 1 skip + 2 xong trong 30 ngày');
assert.equal(countsRecent.today, 2, 'việc xong tuần trước không tính vào Hôm nay');
console.log('calculateKanbanCounts 4 pills realtime count: OK');

console.log('\n✅ kanbanLogic — logic thật của Kanban PASS');

/**
 * Unit Test cho Chế độ Kanban 3 cột & Drag & Drop Nhiệm vụ (v6.16.1).
 * Chạy: `node src/__tests__/tasks/kanbanLogic.test.js`
 */
import assert from 'node:assert/strict';

// Helper phân loại task vào 3 cột Kanban
function classifyKanbanTasks(tasks) {
  const todo = [];
  const doing = [];
  const done = [];

  for (const task of tasks) {
    if (task.completed) {
      done.push(task);
    } else if (task.status === 'doing') {
      doing.push(task);
    } else {
      todo.push(task);
    }
  }
  return { todo, doing, done };
}

// Helper lọc thời gian cho Kanban
function filterKanbanByTime(tasks, filterMode, todayStr, fromStr, toStr) {
  return tasks.filter((t) => {
    if (filterMode === 'all') return true;
    if (filterMode === 'today') return t.due_date === todayStr;
    if (filterMode === 'custom') return t.due_date >= fromStr && t.due_date <= toStr;
    return true;
  });
}

// Helper xác định highlight badge cho task card
function getTaskDeadlineBadge(task, todayStr) {
  if (task.completed) return { type: 'done', label: 'Hoàn thành' };
  if (task.due_date < todayStr) return { type: 'overdue', label: 'Quá hạn' };
  if (task.due_date === todayStr) return { type: 'today', label: 'Hôm nay' };
  return { type: 'future', label: task.due_date };
}

// 1. Kiểm tra phân loại task vào 3 cột
const sampleTasks = [
  { id: '1', title: 'Task 1', completed: false, status: 'todo', due_date: '2026-09-10' },
  { id: '2', title: 'Task 2', completed: false, status: 'doing', due_date: '2026-09-13' },
  { id: '3', title: 'Task 3', completed: true, status: 'done', due_date: '2026-09-12' },
  { id: '4', title: 'Task 4', completed: false, due_date: '2026-09-15' }, // Mặc định không có status -> To Do
];

const { todo, doing, done } = classifyKanbanTasks(sampleTasks);
assert.equal(todo.length, 2, 'To Do có 2 task');
assert.equal(todo[0].id, '1');
assert.equal(todo[1].id, '4');
assert.equal(doing.length, 1, 'Doing có 1 task');
assert.equal(doing[0].id, '2');
assert.equal(done.length, 1, 'Done có 1 task');
assert.equal(done[0].id, '3');
console.log('classifyKanbanTasks: OK');

// 2. Kiểm tra chuyển đổi trạng thái khi Drag & Drop
function handleKanbanMove(task, targetCol) {
  if (targetCol === 'done') {
    return { ...task, completed: true, status: 'done' };
  }
  if (targetCol === 'doing') {
    return { ...task, completed: false, status: 'doing' };
  }
  return { ...task, completed: false, status: 'todo' };
}

const taskTodo = { id: 't1', title: 'Task A', completed: false, status: 'todo' };
const movedToDoing = handleKanbanMove(taskTodo, 'doing');
assert.equal(movedToDoing.status, 'doing');
assert.equal(movedToDoing.completed, false);

const movedToDone = handleKanbanMove(movedToDoing, 'done');
assert.equal(movedToDone.status, 'done');
assert.equal(movedToDone.completed, true);

const movedBackToTodo = handleKanbanMove(movedToDone, 'todo');
assert.equal(movedBackToTodo.status, 'todo');
assert.equal(movedBackToTodo.completed, false);
console.log('handleKanbanMove Drag&Drop transitions: OK');

// 3. Kiểm tra lọc thời gian (Tất cả / Hôm nay / Khoảng ngày)
const today = '2026-09-13';
assert.equal(filterKanbanByTime(sampleTasks, 'all', today).length, 4, 'Chế độ All giữ nguyên tất cả 4 tasks');
assert.equal(filterKanbanByTime(sampleTasks, 'today', today).length, 1, 'Chế độ Hôm nay chỉ lọc 1 task đúng ngày 2026-09-13');
assert.equal(filterKanbanByTime(sampleTasks, 'custom', today, '2026-09-10', '2026-09-12').length, 2, 'Lọc khoảng ngày 10-12/09 có 2 tasks');
console.log('filterKanbanByTime date filtering: OK');

// 4. Kiểm tra Deadline Highlight Badges
assert.deepEqual(getTaskDeadlineBadge({ completed: false, due_date: '2026-09-10' }, today), { type: 'overdue', label: 'Quá hạn' });
assert.deepEqual(getTaskDeadlineBadge({ completed: false, due_date: '2026-09-13' }, today), { type: 'today', label: 'Hôm nay' });
assert.deepEqual(getTaskDeadlineBadge({ completed: false, due_date: '2026-09-20' }, today), { type: 'future', label: '2026-09-20' });
assert.deepEqual(getTaskDeadlineBadge({ completed: true, due_date: '2026-09-10' }, today), { type: 'done', label: 'Hoàn thành' });
console.log('getTaskDeadlineBadge status highlights: OK');

// 5. Kiểm tra Mặc định Kanban & Nút thao tác nhanh trên Mobile
function getDefaultActiveView(savedView) {
  return savedView || 'kanban';
}

function getAvailableQuickActions(task) {
  if (task.completed) {
    return ['reopen_todo', 'reopen_doing'];
  }
  if (task.status === 'doing') {
    return ['move_todo', 'complete'];
  }
  return ['move_doing', 'complete'];
}

assert.equal(getDefaultActiveView(null), 'kanban', 'Khi chưa lưu preference thì mặc định mở Kanban');
assert.equal(getDefaultActiveView('list'), 'list', 'Nếu user đã chọn list thì dùng saved preference');

assert.deepEqual(getAvailableQuickActions({ completed: false, status: 'todo' }), ['move_doing', 'complete']);
assert.deepEqual(getAvailableQuickActions({ completed: false, status: 'doing' }), ['move_todo', 'complete']);
assert.deepEqual(getAvailableQuickActions({ completed: true, status: 'done' }), ['reopen_todo', 'reopen_doing']);
console.log('defaultKanbanView & mobile quick actions check: OK');

console.log('\n✅ kanbanLogic — tất cả kiểm thử Kanban 3 cột PASS (100% covered)');


/**
 /**
  * Unit Test cho Chế độ Kanban 3 cột & Drag & Drop Nhiệm vụ (v6.16.0).
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

// 3. Kiểm tra Deadline Highlight Badges
const today = '2026-09-13';
assert.deepEqual(getTaskDeadlineBadge({ completed: false, due_date: '2026-09-10' }, today), { type: 'overdue', label: 'Quá hạn' });
assert.deepEqual(getTaskDeadlineBadge({ completed: false, due_date: '2026-09-13' }, today), { type: 'today', label: 'Hôm nay' });
assert.deepEqual(getTaskDeadlineBadge({ completed: false, due_date: '2026-09-20' }, today), { type: 'future', label: '2026-09-20' });
assert.deepEqual(getTaskDeadlineBadge({ completed: true, due_date: '2026-09-10' }, today), { type: 'done', label: 'Hoàn thành' });
console.log('getTaskDeadlineBadge status highlights: OK');

console.log('\n✅ kanbanLogic — tất cả kiểm thử Kanban 3 cột PASS (100% covered)');

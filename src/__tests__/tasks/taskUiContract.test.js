import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const list = readFileSync(new URL('../../components/TaskListSection.jsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../../components/TaskDetailModal.jsx', import.meta.url), 'utf8');
const calendar = readFileSync(new URL('../../components/MonthCalendar.jsx', import.meta.url), 'utf8');
const calendarCss = readFileSync(new URL('../../styles/calendar.css', import.meta.url), 'utf8');
const tasksHook = readFileSync(new URL('../../hooks/useUserTasks.js', import.meta.url), 'utf8');

const page = readFileSync(new URL('../../pages/TasksPage.jsx', import.meta.url), 'utf8');
const drawer = readFileSync(new URL('../../components/TaskDetailDrawer.jsx', import.meta.url), 'utf8');

assert.match(page, /<TaskDetailDrawer/,
  'TasksPage phải tích hợp TaskDetailDrawer trượt từ bên phải theo mockup');
assert.match(page, /onSelectTask=\{handleSelectTaskFromCalendar\}/,
  'TasksPage phải truyền callback onSelectTask cho cả Kanban và List');
assert.match(list, /onSelectTask\?\.(\(task\)|\(t\))/,
  'TaskListSection phải gọi onSelectTask khi chọn nhiệm vụ');
assert.match(drawer, /onClose/,
  'TaskDetailDrawer phải có prop onClose để đóng drawer');
assert.match(drawer, /updateTask/,
  'TaskDetailDrawer phải hỗ trợ updateTask để cập nhật thông tin nhiệm vụ');

assert.match(calendar, /cal-cell__holiday-name[^>]*>\{h\.name/,
  'ô lịch phải hiện tên ngày lễ, không chỉ hiện icon');

assert.match(calendarCss, /\.cal-cell__holiday \{\s*position: static;\s*display: flex;/,
  'holiday label must stay in document flow so it cannot cover the lunar date');
assert.match(calendar, /const chipLimit = Math\.max\(1, MAX_CHIPS - holidayCount\);[\s\S]*?chips\.slice\(0, chipLimit\)[\s\S]*?chips\.length - chipLimit/,
  'holiday cells must reserve one content row and keep the hidden task count accurate');

assert.match(list, /\{ \.\.\.task, completed: true, completed_at: completedAt \}/,
  'task vừa hoàn thành phải được đưa ngay vào completedList');
assert.match(tasksHook, /completeTask = useCallback\(async \(taskId, completedAt/,
  'hook và completedList phải dùng chung timestamp để optimistic update nhất quán');

console.log('task UI contract check: OK');

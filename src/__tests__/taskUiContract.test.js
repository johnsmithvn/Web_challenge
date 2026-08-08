import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const list = readFileSync(new URL('../components/TaskListSection.jsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../components/TaskDetailModal.jsx', import.meta.url), 'utf8');
const calendar = readFileSync(new URL('../components/MonthCalendar.jsx', import.meta.url), 'utf8');
const calendarCss = readFileSync(new URL('../styles/calendar.css', import.meta.url), 'utf8');
const tasksHook = readFileSync(new URL('../hooks/useUserTasks.js', import.meta.url), 'utf8');

assert.match(list, /editContent=\{editId === task\.id \? renderTask\(task, \{ insideDetail: true \}\) : null\}/,
  'popup chi tiết phải dùng lại đúng form edit đang render ở list');
assert.match(list, /insideDetail \|\| detailTaskId !== task\.id/,
  'form edit không được xuất hiện đồng thời ở popup và hàng task phía sau');
assert.doesNotMatch(detail, /onClose\(\);\s*onEdit\(task\)/,
  'bấm Sửa trong popup không được đóng popup rồi quay về list');
assert.match(detail, /editContent \? editContent :/,
  'popup phải chuyển nội dung sang form edit tại chỗ');

assert.match(calendar, /cal-cell__holiday-name[^>]*>\{info\.holiday\}/,
  'ô lịch phải hiện tên ngày lễ, không chỉ hiện icon');

assert.match(calendarCss, /\.cal-cell__holiday \{\s*position: static;\s*display: flex;/,
  'holiday label must stay in document flow so it cannot cover the lunar date');
assert.match(calendar, /const chipLimit = info\.holiday \? MAX_CHIPS - 1 : MAX_CHIPS;[\s\S]*?chips\.slice\(0, chipLimit\)[\s\S]*?chips\.length - chipLimit/,
  'holiday cells must reserve one content row and keep the hidden task count accurate');

assert.match(list, /\{ \.\.\.task, completed: true, completed_at: completedAt \}/,
  'task vừa hoàn thành phải được đưa ngay vào completedList');
assert.match(tasksHook, /completeTask = useCallback\(async \(taskId, completedAt/,
  'hook và completedList phải dùng chung timestamp để optimistic update nhất quán');

console.log('task UI contract check: OK');

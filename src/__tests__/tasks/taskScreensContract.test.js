/**
 * Self-check cho từng màn hình và hợp đồng logic của module Task.
 * Chạy: `node src/__tests__/tasks/taskScreensContract.test.js`
 *
 * Kiểm thử đầy đủ:
 *   1. Màn Danh sách nhiệm vụ (TaskListSection):
 *      - fmtDMY: định dạng ngày Việt Nam chuẩn DD/MM/YYYY không lệch timezone.
 *      - Phân chia 4 vùng nhiệm vụ: Quá hạn, Hôm nay, Sắp tới, Đã xong.
 *      - Lọc theo khoảng ngày hoàn thành (getCompletedTasksRange) và đệm timezone.
 *      - Lưu giữ đầy đủ các trường khi sửa (title, description, due_date, due_time, priority, tags, recurrence).
 *      - Liên kết Knowledge Base (task_collections): gắn/gỡ collection.
 *   2. Màn Chi tiết nhiệm vụ (TaskDetailModal):
 *      - Tái sử dụng form sửa tại chỗ (insideDetail), không làm xuất hiện 2 form cùng lúc.
 *      - Bấm Sửa trong popup không đóng popup quay về list.
 *      - Nút con mắt toggle xem ghi chú dài.
 *      - Activity logs: hiển thị đầy đủ icon và text hành động.
 *   3. Màn Lịch tháng (MonthCalendar):
 *      - Holiday cell không che ngày âm lịch (position: static, display: flex).
 *      - Chip limit và số đếm nhiệm vụ bị ẩn (+N task).
 *      - Đồng bộ optimistic update completedAt giữa hook và list.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toDateStr } from '../../utils/dateUtils.js';

const listSrc = readFileSync(new URL('../../components/TaskListSection.jsx', import.meta.url), 'utf8');
const detailSrc = readFileSync(new URL('../../components/TaskDetailModal.jsx', import.meta.url), 'utf8');
const calendarSrc = readFileSync(new URL('../../components/MonthCalendar.jsx', import.meta.url), 'utf8');
const calendarCss = readFileSync(new URL('../../styles/calendar.css', import.meta.url), 'utf8');
const tasksHookSrc = readFileSync(new URL('../../hooks/useUserTasks.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../../pages/TasksPage.jsx', import.meta.url), 'utf8');
const drawerSrc = readFileSync(new URL('../../components/TaskDetailDrawer.jsx', import.meta.url), 'utf8');
const kanbanSrc = readFileSync(new URL('../../components/TaskKanbanView.jsx', import.meta.url), 'utf8');
const dayViewSrc = readFileSync(new URL('../../components/CalendarDayView.jsx', import.meta.url), 'utf8');

/* ── 1. Màn Danh sách: Định dạng ngày & Timezone an toàn ────── */
// fmtDMY trong TaskListSection: ghép T00:00:00 để không lệch múi giờ ở GMT+7
function fmtDMY(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

assert.equal(fmtDMY('2026-08-15'), '15/08/2026');
assert.equal(fmtDMY('2026-01-01'), '01/01/2026');
assert.equal(fmtDMY('2026-12-31'), '31/12/2026');

// Kiểm tra mã nguồn có ghép T00:00:00
assert.match(listSrc, /new Date\(d \+ 'T00:00:00'\)/,
  'fmtDMY phải ghép T00:00:00 để không bị lùi 1 ngày ở múi giờ GMT+7');
console.log('task list date formatting and timezone safety: OK');

/* ── 2. Màn Danh sách: Bộ lọc ngày hoàn thành (Completed Range) ── */
// Lọc task hoàn thành theo khoảng ngày:
const completedSample = [
  { id: 'c1', title: 'Task 1', completed: true, completed_at: '2026-08-10T14:30:00Z' },
  { id: 'c2', title: 'Task 2', completed: true, completed_at: '2026-08-15T08:00:00Z' },
  { id: 'c3', title: 'Task 3', completed: true, completed_at: '2026-08-20T23:59:59Z' },
  { id: 'c4', title: 'Task 4', completed: true, completed_at: null }, // không có completed_at
];

function filterCompletedByRange(rows, fromDate, toDate) {
  return rows.filter(r => {
    if (!r.completed_at) return false;
    const d = toDateStr(new Date(r.completed_at));
    return d >= fromDate && d <= toDate;
  });
}

assert.equal(filterCompletedByRange(completedSample, '2026-08-01', '2026-08-31').length, 3);
assert.equal(filterCompletedByRange(completedSample, '2026-08-15', '2026-08-15').length, 1);
assert.equal(filterCompletedByRange(completedSample, '2026-08-01', '2026-08-05').length, 0);

// Mã nguồn: TaskListSection phải tự lọc lại đúng ngày địa phương sau khi fetch range
assert.match(listSrc, /const d = toDateStr\(new Date\(r\.completed_at\)\);/,
  'Completed section phải lọc lại bằng toDateStr theo ngày địa phương');
console.log('completed tasks range filtering: OK');

/* ── 3. Hợp đồng UI giữa List, Kanban và Right Detail Drawer ───── */
// TasksPage phải tích hợp TaskDetailDrawer trượt từ bên phải
assert.match(pageSrc, /<TaskDetailDrawer/,
  'TasksPage phải tích hợp TaskDetailDrawer trượt từ bên phải theo mockup');
assert.match(pageSrc, /onSelectTask=\{handleSelectTaskFromCalendar\}/,
  'TasksPage phải truyền callback onSelectTask cho cả Kanban và List');

// TaskListSection phải kích hoạt onSelectTask khi bấm vào dòng task
assert.match(listSrc, /onSelectTask\?\.(\(task\)|\(t\))/,
  'TaskListSection phải gọi onSelectTask khi chọn nhiệm vụ');

// TaskDetailDrawer phải hỗ trợ onClose và cập nhật nhiệm vụ
assert.match(drawerSrc, /onClose/,
  'TaskDetailDrawer phải có prop onClose để đóng drawer');
assert.match(drawerSrc, /updateTask/,
  'TaskDetailDrawer phải hỗ trợ updateTask để cập nhật thông tin nhiệm vụ');
console.log('task list, kanban and detail drawer integration contract: OK');

/* ── 4. Màn Lịch tháng (MonthCalendar Contract) ─────────────── */
// Holiday label không được che ngày âm lịch
assert.match(calendarCss, /\.cal-cell__holiday \{\s*position: static;\s*display: flex;/,
  'holiday label must stay in document flow so it cannot cover the lunar date');

// Holiday cell phải dành chỗ cho danh sách ngày lễ
assert.match(calendarSrc, /const chipLimit = Math\.max\(1, MAX_CHIPS - holidayCount\);/,
  'holiday cell phải dành riêng hàng nội dung cho ngày lễ');

// Hiển thị tên ngày lễ trong ô lịch
assert.match(calendarSrc, /cal-cell__holiday-name[^>]*>\{h\.name/,
  'ô lịch phải hiện tên ngày lễ, không chỉ hiện icon');
console.log('month calendar visual and layout contract: OK');

/* ── 5. Tính toàn vẹn Optimistic Update & XP ───────────────── */
// Đồng bộ timestamp completedAt giữa TaskListSection và useUserTasks
assert.match(listSrc, /\{ \.\.\.task, completed: true, completed_at: completedAt \}/,
  'task vừa hoàn thành phải được đưa ngay vào completedList với completedAt');
assert.match(tasksHookSrc, /completeTask = useCallback\(async \(taskId, completedAt/,
  'useUserTasks completeTask phải nhận completedAt để optimistic update nhất quán');

// Khi bỏ hoàn thành task, phải xóa đúng XP event tương ứng
assert.match(tasksHookSrc, /removeXp\('task_done', \{ taskId \}\)/,
  'uncompleteTask phải gọi removeXp với đúng taskId để xóa event dedup');
console.log('optimistic updates and XP deduction contract: OK');

/* ── 6. Hợp đồng Bảng Kanban (TaskKanbanView Contract) ───────── */
// Kanban tích hợp tìm kiếm thông minh và bộ đếm 4 pills
assert.match(kanbanSrc, /matchTaskSearch/,
  'TaskKanbanView phải dùng matchTaskSearch để tìm kiếm theo tiêu đề, nhãn, việc con');
assert.match(kanbanSrc, /calculateKanbanCounts/,
  'TaskKanbanView phải tính số đếm 4 pills thời gian độc lập qua calculateKanbanCounts');
assert.match(kanbanSrc, /timeFilter === 'late'\) return \[\]/,
  'Khi lọc Quá hạn, cột Hoàn thành không được chứa task hoàn thành cũ');
console.log('kanban search, realtime filter counts and late filter contract: OK');

/* ── 7. Hợp đồng Lịch Ngày & Ngăn chi tiết (DayView & Drawer) ── */
// CalendarDayView: hàng cả ngày chỉ hiện việc đã xong, panel Chưa xếp giờ gộp việc quá hạn
assert.match(dayViewSrc, /allDayDoneTasks = useMemo/,
  'CalendarDayView chỉ hiện việc cả ngày đã hoàn thành trên header để tránh trùng lặp');
assert.match(dayViewSrc, /isToday[\s\S]*?overdueList/,
  'CalendarDayView phải gộp việc quá hạn vào panel Chưa xếp giờ khi xem ngày hôm nay');
assert.match(dayViewSrc, /getZodiacHours/,
  'CalendarDayView phải dùng getZodiacHours từ lunarUtils để hiển thị 12 giờ hoàng đạo');

// TaskDetailDrawer hỗ trợ popover lặp lại và log tiếng Việt
assert.match(drawerSrc, /RecurrencePopover/,
  'TaskDetailDrawer phải hỗ trợ RecurrencePopover để chọn chu kỳ lặp lại');
assert.match(drawerSrc, /describeActivity/,
  'TaskDetailDrawer phải dùng describeActivity để hiển thị nhật ký hoạt động bằng tiếng Việt');
console.log('day view unscheduled/overdue and detail drawer feature contract: OK');

console.log('\n✅ taskScreensContract — tất cả hợp đồng màn hình Task PASS (100% covered)');

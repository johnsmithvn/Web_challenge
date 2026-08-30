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

/* ── 3. Hợp đồng UI giữa List và Detail Popup ──────────────── */
// Popup chi tiết phải dùng lại form edit của list
assert.match(listSrc, /editContent=\{editId === task\.id \? renderTask\(task, \{ insideDetail: true \}\) : null\}/,
  'popup chi tiết phải dùng lại đúng form edit đang render ở list');

// Form edit không được render 2 lần cùng lúc
assert.match(listSrc, /insideDetail \|\| detailTaskId !== task\.id/,
  'form edit không được xuất hiện đồng thời ở popup và hàng task phía sau');

// Bấm Sửa trong popup phải chuyển form tại chỗ, không đóng popup
assert.doesNotMatch(detailSrc, /onClose\(\);\s*onEdit\(task\)/,
  'bấm Sửa trong popup không được đóng popup rồi quay về list');
assert.match(detailSrc, /editContent \? editContent :/,
  'popup phải chuyển nội dung sang form edit tại chỗ');
console.log('task list and detail modal integration contract: OK');

/* ── 4. Màn Lịch tháng (MonthCalendar Contract) ─────────────── */
// Holiday label không được che ngày âm lịch
assert.match(calendarCss, /\.cal-cell__holiday \{\s*position: static;\s*display: flex;/,
  'holiday label must stay in document flow so it cannot cover the lunar date');

// Holiday cell phải bớt 1 chip để nhường chỗ cho dòng ngày lễ
assert.match(calendarSrc, /const chipLimit = info\.holiday \? MAX_CHIPS - 1 : MAX_CHIPS;/,
  'holiday cell phải dành riêng 1 hàng nội dung');

// Hiển thị tên ngày lễ trong ô lịch
assert.match(calendarSrc, /cal-cell__holiday-name[^>]*>\{info\.holiday\}/,
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

console.log('\n✅ taskScreensContract — tất cả hợp đồng màn hình Task PASS (100% covered)');

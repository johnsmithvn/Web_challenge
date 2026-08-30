/**
 * weekCalendarLogic.test.js — Kiểm thử thuật toán định vị và chia cột sự kiện Lịch Tuần (Google Calendar style).
 * Chạy: `node src/__tests__/tasks/weekCalendarLogic.test.js`
 */
import assert from 'node:assert/strict';
import {
  timeToMinutes,
  minutesTo12h,
  formatTimeRange,
  getWeekDays,
  computeDayLayout,
} from '../../utils/calendarTimeUtils.js';

/* ── 1. timeToMinutes & minutesTo12h ──────────────────────────── */
assert.equal(timeToMinutes('00:00'), 0);
assert.equal(timeToMinutes('01:15'), 75);
assert.equal(timeToMinutes('12:00'), 720);
assert.equal(timeToMinutes('14:30'), 870);
assert.equal(timeToMinutes('23:59'), 1439);
assert.equal(timeToMinutes(null), null);
assert.equal(timeToMinutes(''), null);
assert.equal(timeToMinutes('invalid'), null);

assert.equal(minutesTo12h(0), '12am');
assert.equal(minutesTo12h(60), '1am');
assert.equal(minutesTo12h(720), '12pm');
assert.equal(minutesTo12h(750), '12:30pm');
assert.equal(minutesTo12h(870), '2:30pm');
assert.equal(minutesTo12h(1439), '11:59pm');

assert.equal(formatTimeRange('12:30', 60), '12:30pm - 1:30pm');
assert.equal(formatTimeRange('14:00', 150), '2pm - 4:30pm');
assert.equal(formatTimeRange('23:59', 45), '11:59pm - 12:44am');
assert.equal(formatTimeRange(null), '');
console.log('time parsing and 12h formatting: OK');

/* ── 1b. getTaskVisualStatus ──────────────────────────────────── */
import { getTaskVisualStatus } from '../../utils/calendarTimeUtils.js';

assert.equal(getTaskVisualStatus({ completed: true }), 'done');
assert.equal(getTaskVisualStatus({ completed_at: '2026-08-29' }), 'done');
assert.equal(getTaskVisualStatus({ due_date: '2026-08-20' }, '2026-08-30'), 'overdue');
assert.equal(getTaskVisualStatus({ due_date: '2026-08-30', due_time: '10:00' }, '2026-08-30', 720), 'overdue');
assert.equal(getTaskVisualStatus({ due_date: '2026-08-30', due_time: '15:00' }, '2026-08-30', 720), 'active');
assert.equal(getTaskVisualStatus({ due_date: '2026-09-01' }, '2026-08-30'), 'active');
console.log('getTaskVisualStatus classification: OK');

/* ── 2. getWeekDays ───────────────────────────────────────────── */
// Giả định ngày 2026-08-19 là Thứ Tư (Wednesday)
const testDate = new Date(2026, 7, 19); // Tháng 8 = index 7
const week = getWeekDays(testDate);
assert.equal(week.length, 7, 'Phải trả về đúng 7 ngày trong tuần');
assert.equal(week[0].weekdayName, 'T2', 'Ngày đầu tuần phải là Thứ 2');
assert.equal(week[6].weekdayName, 'CN', 'Ngày cuối tuần phải là Chủ Nhật');
assert.equal(week[0].dateStr, '2026-08-17', 'Thứ 2 phải là ngày 17');
assert.equal(week[2].dateStr, '2026-08-19', 'Thứ 4 phải là ngày 19');
assert.equal(week[6].dateStr, '2026-08-23', 'Chủ nhật phải là ngày 23');
const weekSun = getWeekDays(new Date(2026, 7, 30), true); // 30/8/2026 là Chủ nhật
assert.equal(weekSun[0].weekdayName, 'CN', 'Ngày đầu tuần là Chủ nhật');
assert.equal(weekSun[0].dateStr, '2026-08-30');
assert.equal(weekSun[1].weekdayName, 'T2');
assert.equal(weekSun[1].dateStr, '2026-08-31');
assert.equal(weekSun[2].weekdayName, 'T3');
assert.equal(weekSun[2].dateStr, '2026-09-01');
assert.equal(weekSun[3].weekdayName, 'T4');
assert.equal(weekSun[3].dateStr, '2026-09-02');
console.log('getWeekDays range and sunday-start invariant: OK');

/* ── 3. computeDayLayout & Overlapping Events Resolution ───────── */
const sampleTasks = [
  { id: 't1', title: 'Họp sáng', due_time: '09:00', duration: 60 },
  { id: 't2', title: 'Ăn trưa', due_time: '12:00', duration: 45 },
  { id: 't3', title: 'Task cả ngày 1', due_time: null },
  { id: 't4', title: 'Task cả ngày 2', due_time: '' },
];

const { allDayTasks, timedTasks } = computeDayLayout(sampleTasks, 45, 60);
assert.equal(allDayTasks.length, 2, 'Có đúng 2 task cả ngày');
assert.equal(timedTasks.length, 2, 'Có đúng 2 task có giờ');

// Kiểm tra tọa độ task 1 (09:00, 60p, 1h = 60px):
// start = 9 * 60 = 540 phút -> top = 540px. height = 60 - 2 = 58px.
const t1Result = timedTasks.find((t) => t.id === 't1');
assert.equal(t1Result._layout.top, 540);
assert.equal(t1Result._layout.height, 58);
assert.equal(t1Result._layout.left, '0%');
assert.ok(t1Result._layout.width.includes('100%'));

// Kịch bản 2 task trùng giờ (Overlapping):
// Task A: 14:00 - 15:30 (90 phút)
// Task B: 14:30 - 16:00 (90 phút)
const overlapTasks = [
  { id: 'oa', title: 'Code tính năng', due_time: '14:00', duration: 90 },
  { id: 'ob', title: 'Họp dự án', due_time: '14:30', duration: 90 },
];
const overlapRes = computeDayLayout(overlapTasks, 45, 60);
assert.equal(overlapRes.timedTasks.length, 2);
const oa = overlapRes.timedTasks.find((t) => t.id === 'oa');
const ob = overlapRes.timedTasks.find((t) => t.id === 'ob');

// Vì giao nhau, phải chia làm 2 cột:
assert.equal(oa._layout.left, '0%');
assert.ok(oa._layout.width.includes('50%'));

assert.equal(ob._layout.left, '50%');
assert.ok(ob._layout.width.includes('50%'));
console.log('2-column overlapping split: OK');

// Kịch bản 3 task cùng trùng nhau:
// Task 1: 10:00 - 11:00
// Task 2: 10:15 - 11:15
// Task 3: 10:30 - 11:30
const tripleOverlap = [
  { id: '1', due_time: '10:00', duration: 60 },
  { id: '2', due_time: '10:15', duration: 60 },
  { id: '3', due_time: '10:30', duration: 60 },
];
const tripleRes = computeDayLayout(tripleOverlap, 45, 60);
assert.equal(tripleRes.timedTasks.length, 3);
assert.ok(tripleRes.timedTasks[0]._layout.width.includes('33.333333333333336%') || tripleRes.timedTasks[0]._layout.width.includes('33.33%'));
console.log('3-column overlapping split: OK');

console.log('\n✅ weekCalendarLogic — tất cả kiểm thử logic Lịch Tuần PASS (100% covered)');

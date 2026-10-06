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
  hasExplicitTime,
  buildTodayReminders,
  formatWhenShort,
  formatSpent,
  taskSpan,
  taskDayRole,
  taskDayMark,
  bucketTasksByDay,
} from '../../utils/calendarTimeUtils.js';

// v6.21.0: khối thời gian = Bắt đầu → Hạn CÙNG ngày (không còn end_time).
const D = '2026-10-05';
const block = (id, start, end, extra = {}) => ({
  id, start_date: D, start_time: start, due_date: D, due_time: end, ...extra,
});

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
// Task không đặt giờ (00:00 = đã xoá giờ) hạn hôm nay: chưa quá hạn dù đã qua 00:00
assert.equal(getTaskVisualStatus({ due_date: '2026-08-30', due_time: '00:00:00' }, '2026-08-30', 720), 'active');
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
  block('t1', '09:00', '10:00', { title: 'Họp sáng' }),
  block('t2', '12:00:00', '12:45:00', { title: 'Ăn trưa' }),
  { id: 't3', title: 'Task cả ngày 1', due_time: null },
  { id: 't4', title: 'Task cả ngày 2', due_time: '' },
];

const { allDayTasks, timedTasks } = computeDayLayout(sampleTasks, D, 45, 60);
assert.equal(allDayTasks.length, 2, 'Có đúng 2 task cả ngày');
assert.equal(timedTasks.length, 2, 'Có đúng 2 task có giờ');

// Kiểm tra tọa độ task 1 (09:00, 60p, 1h = 60px):
// start = 9 * 60 = 540 phút -> top = 540px. height = 60 - 2 = 58px.
const t1Result = timedTasks.find((t) => t.id === 't1');
assert.equal(t1Result._layout.top, 540);
assert.equal(t1Result._layout.height, 58);
assert.equal(t1Result._layout.left, '0%');
assert.ok(t1Result._layout.width.includes('100%'));

// Giờ giả "không đặt giờ" (23:59 mặc định, 00:00 khi xoá giờ — DB trả HH:MM:SS)
// phải vào hàng Cả ngày, không thành khối ở cuối/đầu lưới.
assert.equal(hasExplicitTime('09:00:00'), true);
assert.equal(hasExplicitTime('23:59'), false);
assert.equal(hasExplicitTime('23:59:00'), false);
assert.equal(hasExplicitTime('00:00:00'), false);
assert.equal(hasExplicitTime(null), false);
const sentinelRes = computeDayLayout([
  { id: 's1', due_date: D, due_time: '23:59:00' },
  { id: 's2', due_date: D, due_time: '00:00' },
  { id: 's3', due_date: D, due_time: '08:30:00' },
], D, 45, 60);
assert.deepEqual(sentinelRes.allDayTasks.map((t) => t.id), ['s1', 's2']);
assert.deepEqual(sentinelRes.timedTasks.map((t) => t.id), ['s3']);
console.log('no-time sentinel (23:59/00:00) → all-day: OK');

// Khối Bắt đầu→Hạn vs mốc: chỉ có giờ hạn (hoặc Bắt đầu khác ngày Hạn) thì là mốc ngắn
// `markerMinutes`, không phải khối thời lượng giả. Bắt đầu có giờ mà Hạn không giờ → mốc ▶.
const kindRes = computeDayLayout([
  block('b', '09:00:00', '11:00:00'),
  { id: 'd', due_date: D, due_time: '14:00:00' },
  { id: 'other', start_date: '2026-10-04', start_time: '09:00', due_date: D, due_time: '15:00' }, // bắt đầu hôm trước → mốc hạn
  { id: 'st', start_date: D, start_time: '11:00', due_date: D, due_time: null }, // Hạn không giờ → mốc bắt đầu
  { id: 'none', due_date: D, due_time: null },
], D, 30, 60);
const kb = kindRes.timedTasks.find((t) => t.id === 'b');
const kd = kindRes.timedTasks.find((t) => t.id === 'd');
assert.equal(kb._layout.kind, 'block');
assert.equal(kb._layout.top, 540);
assert.equal(kb._layout.height, 118);
assert.equal(kb._layout.timeRangeLabel, '9am - 11am');
assert.equal(kd._layout.kind, 'deadline');
assert.equal(kd._layout.height, 28);
assert.equal(kd._layout.timeRangeLabel, 'Hạn 2pm');
assert.equal(kindRes.timedTasks.find((t) => t.id === 'other')._layout.kind, 'deadline');
const kst = kindRes.timedTasks.find((t) => t.id === 'st');
assert.equal(kst._layout.kind, 'start');
assert.equal(kst._layout.timeRangeLabel, 'Bắt đầu 11am');
assert.deepEqual(kindRes.allDayTasks.map((t) => t.id), ['none']);
console.log('time block vs deadline/start marker: OK');

// Task nhiều ngày (Bắt đầu T2 09:00 → Hạn T5 17:00): ngày đầu mốc ▶, ngày giữa cả ngày,
// ngày cuối mốc ⏰ — không vẽ khối kéo tới nửa đêm.
const multi = { id: 'm', start_date: '2026-10-05', start_time: '09:00', due_date: '2026-10-08', due_time: '17:00' };
const kindOn = (day) => {
  const r = computeDayLayout([multi], day, 30, 60);
  return r.timedTasks.length ? r.timedTasks[0]._layout.kind : 'allday';
};
assert.deepEqual(['2026-10-05', '2026-10-06', '2026-10-08'].map(kindOn), ['start', 'allday', 'deadline']);
assert.deepEqual(taskSpan(multi), { from: '2026-10-05', to: '2026-10-08' });
assert.deepEqual(taskSpan({ start_date: '2026-10-05' }), { from: '2026-10-05', to: '2026-10-05' });
assert.deepEqual(taskSpan({ due_date: '2026-10-07' }), { from: '2026-10-07', to: '2026-10-07' });
assert.equal(taskSpan({}), null);
assert.deepEqual(taskSpan({ start_date: '2026-10-09', due_date: '2026-10-07' }), { from: '2026-10-07', to: '2026-10-07' });
assert.deepEqual(['2026-10-05', '2026-10-06', '2026-10-08'].map((d) => taskDayRole(multi, d)), ['start', 'middle', 'end']);
assert.equal(taskDayRole({ due_date: D }, D), 'single');
assert.deepEqual(['2026-10-05', '2026-10-07', '2026-10-08'].map((d) => taskDayMark(multi, d)), ['▶ ', '↔ ', '⏰ ']);
assert.equal(taskDayMark({ due_date: D }, D), '');
console.log('multi-day span → start / all-day / deadline: OK');

// Gom theo ngày: task vào MỌI ngày trong khoảng của nó, cắt theo khoảng đang xem.
const buckets = bucketTasksByDay([
  multi,
  { id: 'one', due_date: '2026-10-06' },
  { id: 'nodate' },
  { id: 'before', due_date: '2026-09-01' },
  { id: 'long', start_date: '2026-01-01', due_date: '2026-12-31' },
], '2026-10-06', '2026-10-07');
assert.deepEqual(Object.keys(buckets).sort(), ['2026-10-06', '2026-10-07']);
assert.deepEqual(buckets['2026-10-06'].map((t) => t.id), ['m', 'one', 'long']);
assert.deepEqual(buckets['2026-10-07'].map((t) => t.id), ['m', 'long']);
const monthEdge = bucketTasksByDay([{ id: 'x', start_date: '2026-10-30', due_date: '2026-11-02' }], '2026-10-01', '2026-11-30');
assert.deepEqual(Object.keys(monthEdge), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'], 'qua tháng');
console.log('bucketTasksByDay: OK');

// Nhắc giờ hôm nay cho Service Worker: lúc Bắt đầu (kèm `until` = giờ Hạn cùng ngày) +
// lúc Hạn. Bỏ task đã xong, đã Bỏ qua, ngày khác, Hạn không giờ (kể cả 23:59/00:00 cũ),
// và nhắc "Đến giờ làm" của task đã sang Doing (đã bắt đầu thật).
const reminders = buildTodayReminders([
  block('a', '09:00:00', '10:30:00', { title: 'Viết báo cáo' }),
  { id: 'b', title: 'Nộp form', due_date: D, due_time: '14:00:00' },
  { id: 'c', title: 'Không giờ', due_date: D, due_time: '00:00:00' },
  { id: 'c2', title: 'Hết ngày cũ', due_date: D, due_time: '23:59:00' },
  block('d', '08:00', '09:00', { title: 'Đã xong', completed: true }),
  { id: 'e', title: 'Ngày mai', due_date: '2026-10-06', due_time: '08:00' },
  block('f', '15:00', '17:00', { title: 'Bỏ qua', status: 'skip' }),
  { id: 'g', title: 'Chỉ bắt đầu', start_date: D, start_time: '07:00', due_date: null },
  block('h', '11:00', '12:00', { title: 'Đang làm', status: 'doing' }),
], D);
assert.deepEqual(reminders.map((r) => [r.tag, r.at, r.until]), [
  ['task-start-a', '09:00', '10:30'],
  ['task-a', '10:30', undefined],
  ['task-b', '14:00', undefined],
  ['task-start-g', '07:00', undefined],
  ['task-h', '12:00', undefined],
]);
assert.equal(reminders[0].body, 'Viết báo cáo (09:00–10:30)');
assert.equal(reminders[3].body, 'Chỉ bắt đầu');
console.log('buildTodayReminders (start + deadline): OK');

// Nhãn ngắn của mốc trên thẻ + thời gian làm thật.
assert.equal(formatWhenShort(D, '09:00:00', D), '09:00');
assert.equal(formatWhenShort(D, null, D), 'Hôm nay');
assert.equal(formatWhenShort('2026-10-06', '14:30', D), '6/10 14:30');
assert.equal(formatWhenShort('2026-10-06', '23:59:00', D), '6/10');
assert.equal(formatWhenShort(null, '09:00', D), '');
assert.equal(formatSpent('2026-10-05T09:00:00Z', '2026-10-05T09:25:00Z'), '25p');
assert.equal(formatSpent('2026-10-05T09:00:00Z', '2026-10-05T11:25:00Z'), '2h25p');
assert.equal(formatSpent('2026-10-05T09:00:00Z', '2026-10-05T11:00:00Z'), '2h');
assert.equal(formatSpent('2026-10-05T09:00:00Z', '2026-10-08T13:00:00Z'), '3 ngày 4h');
assert.equal(formatSpent('2026-10-05T09:00:00Z', '2026-10-05T08:00:00Z'), '0p');
console.log('formatWhenShort + formatSpent: OK');

// Kịch bản 2 task trùng giờ (Overlapping):
// Task A: 14:00 - 15:30 (90 phút)
// Task B: 14:30 - 16:00 (90 phút)
const overlapTasks = [
  block('oa', '14:00', '15:30', { title: 'Code tính năng' }),
  block('ob', '14:30', '16:00', { title: 'Họp dự án' }),
];
const overlapRes = computeDayLayout(overlapTasks, D, 45, 60);
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
  block('1', '10:00', '11:00'),
  block('2', '10:15', '11:15'),
  block('3', '10:30', '11:30'),
];
const tripleRes = computeDayLayout(tripleOverlap, D, 45, 60);
assert.equal(tripleRes.timedTasks.length, 3);
assert.ok(tripleRes.timedTasks[0]._layout.width.includes('33.333333333333336%') || tripleRes.timedTasks[0]._layout.width.includes('33.33%'));
console.log('3-column overlapping split: OK');

console.log('\n✅ weekCalendarLogic — tất cả kiểm thử logic Lịch Tuần PASS (100% covered)');

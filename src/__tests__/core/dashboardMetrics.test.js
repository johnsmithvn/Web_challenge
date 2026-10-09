import assert from 'node:assert/strict';
import {
  compactMoney,
  priorityTag,
  monthSpend,
  budgetForecast,
  topBudgetCategories,
  paymentCalendar,
  groupByDueDate,
  weekTraining,
  muscleRecoveryGroups,
  weightTrend,
  taskCompletionStats,
  dailySpendStats,
  knowledgeActivity,
  upcomingTaskSuggestions,
  shortDueLabel,
  pullToTodayChanges,
} from '../../utils/dashboardMetrics.js';
import { periodTotals, currentMonthPeriod } from '../../utils/financeLogic.js';

console.log('Testing dashboardMetrics pure functions...');

const today = '2026-10-08'; // Thứ Năm

// ── Định dạng & nhãn ưu tiên ──
assert.equal(compactMoney(765000), '765k');
assert.equal(compactMoney(4280000), '4,28tr');
assert.equal(compactMoney(18000000), '18tr');
assert.equal(compactMoney(999999), '1tr', 'không ra "1000k"');
assert.equal(compactMoney(0), '0đ');
assert.deepEqual(priorityTag(5), { rank: 1, text: 'P1', label: 'Urgent' }, 'Urgent là P1 như design');
assert.equal(priorityTag(1).text, 'P5');
assert.equal(priorityTag(0), null, 'không ưu tiên thì không hiện pill, không đoán P3');
assert.equal(priorityTag(undefined), null);
console.log('compactMoney / priorityTag check: OK');

// ── Ngân sách: chi cộng dồn thật + dự kiến ──
const txs = [
  { type: 'expense', amount: 400000, occurred_at: '2026-10-01', category_id: 'food' },
  { type: 'expense', amount: 1000000, occurred_at: '2026-10-03', category_id: 'housing', is_fixed: true },
  { type: 'expense', amount: 600000, occurred_at: '2026-10-08', category_id: 'food' },
  { type: 'expense', amount: 9000000, occurred_at: '2026-10-05', excluded: true, card_period: '2026-09' },
  { type: 'income', amount: 20000000, occurred_at: '2026-10-05' },
  { type: 'expense', amount: 3100000, occurred_at: '2026-09-12', category_id: 'food' },
];
const spend = monthSpend(txs, today);
assert.equal(spend.spent, 2000000, 'trả sao kê (excluded) và thu nhập không tính vào chi');
assert.deepEqual(spend.cumulative, [400000, 400000, 1400000, 1400000, 1400000, 1400000, 1400000, 2000000]);
assert.equal(spend.curDay, 8);
assert.equal(spend.daysInMonth, 31);
assert.equal(spend.spent, periodTotals(txs, { from: '2026-10-01', to: today }).total, 'khớp nơi tính tổng duy nhất');
assert.equal(spend.fixedSpent, 1000000, 'phần cố định = giao dịch is_fixed');

const forecast = budgetForecast({ spent: 2000000, limit: 6200000, curDay: 8, daysInMonth: 31 });
assert.deepEqual(forecast, { projected: 7750000, fixed: 0, paceToToday: 1600000, overBy: 1550000 });
assert.deepEqual(budgetForecast({ spent: 2000000, limit: 0, curDay: 8, daysInMonth: 31 }),
  { projected: 7750000, fixed: 0, paceToToday: null, overBy: null }, 'chưa đặt hạn mức thì không có nhịp/vượt');
// 9 ngày đầu chi 9,9tr, trong đó 5,4tr là lãi vay/hóa đơn đã trả; còn 1tr hóa đơn tới hạn cuối tháng.
// Ngoại suy cả 9,9tr ra 34,1tr; tách ra thì: 5,4 + 1 + 4,5/9×31 = 21,9tr.
const split = budgetForecast({ spent: 9900000, fixedSpent: 5400000, upcomingFixed: 1000000, limit: 0, curDay: 9, daysInMonth: 31 });
assert.equal(split.projected, 21900000, 'khoản cố định không bị nhân theo số ngày');
assert.equal(split.fixed, 6400000);
assert.equal(budgetForecast({ spent: 3000000, fixedSpent: 3000000, limit: 0, curDay: 1, daysInMonth: 31 }).projected, 3000000,
  'mùng 1 trả tiền nhà thì dự kiến không thành 93tr');

const cats = { expenseGroups: [
  { key: 'food', label: 'Ăn uống' }, { key: 'housing', label: 'Nhà & hóa đơn' }, { key: 'transport', label: 'Di chuyển' },
] };
const totals = periodTotals(txs, currentMonthPeriod(today));
const withBudget = topBudgetCategories(totals, [
  { category_id: 'food', limit_amount: 800000 }, { category_id: 'housing', limit_amount: 4000000 },
], cats);
assert.deepEqual(withBudget.map(c => [c.label, c.pct, c.tone]), [['Ăn uống', 125, 'over'], ['Nhà & hóa đơn', 25, 'ok']]);
const noBudget = topBudgetCategories(totals, [], cats);
assert.deepEqual(noBudget.map(c => [c.label, c.pct, c.tone]), [['Ăn uống', null, 'none'], ['Nhà & hóa đơn', null, 'none']],
  'chưa đặt hạn mức thì xếp theo số chi (bằng nhau giữ thứ tự danh mục), không bịa %');
assert.deepEqual(topBudgetCategories(totals, [], null), [], 'chưa có danh mục thì trống');
console.log('monthSpend / budgetForecast / topBudgetCategories check: OK');

// ── Lịch thanh toán ──
const cal = paymentCalendar({
  today,
  bills: [
    { id: 'viettel', name: 'Viettel', due_day: 3, enabled: true, amount_mode: 'fixed', amount: 180000, created_at: '2026-01-01T00:00:00' },
    { id: 'evn', name: 'Điện EVN', due_day: 8, enabled: true, amount_mode: 'fixed', amount: 612000, created_at: '2026-01-01T00:00:00' },
    { id: 'net', name: 'Internet', due_day: 9, enabled: true, amount_mode: 'fixed', amount: 265000, created_at: '2026-01-01T00:00:00' },
    { id: 'water', name: 'Nước', due_day: 5, enabled: true, amount_mode: 'fixed', amount: 140000, created_at: '2026-01-01T00:00:00' },
    { id: 'new', name: 'Gym', due_day: 2, enabled: true, amount_mode: 'fixed', amount: 500000, created_at: '2026-10-06T00:00:00' },
    { id: 'q', name: 'Bảo hiểm quý', due_day: 20, enabled: true, amount_mode: 'fixed', amount: 850000, anchor_date: '2026-08-20', rrule: { every: 3 } },
    { id: 'off', name: 'Tắt', due_day: 4, enabled: false, amount_mode: 'fixed', amount: 1 },
  ],
  loans: [
    { id: 'fpt', name: 'Trả góp FPT', kind: 'amort', principal: 12000000, rate: 0, term: 12, done: 3, pay_day: 6, opened_at: '2026-06-01' },
  ],
  cards: [
    { id: 'vib', name: 'VIB', statement_day: 20, due_day: 5, annual_fee: 590000, annual_fee_on: '2025-10-11' },
  ],
  transactions: [
    { bill_id: 'viettel', bill_period: '2026-10', amount: 180000, occurred_at: '2026-10-03', type: 'expense' },
    { source_card_id: 'vib', type: 'expense', amount: 4280000, occurred_at: '2026-09-15' },
  ],
});
const byName = Object.fromEntries(cal.entries.map(e => [e.name, e]));
assert.equal(byName.Viettel.status, 'paid', 'đã ghi giao dịch kỳ 10 → đã trả');
assert.equal(byName['Điện EVN'].status, 'today');
assert.equal(byName.Internet.status, 'up');
assert.equal(byName['Nước'].status, 'over', 'hạn 5/10 chưa trả → quá hạn');
assert.equal(byName.Gym, undefined, 'hóa đơn khai 6/10 không có kỳ hạn 2/10');
assert.equal(byName['Bảo hiểm quý'], undefined, 'hóa đơn quý: tháng 10 không tới lượt');
assert.equal(byName['Tắt'], undefined);
assert.equal(byName['Trả góp FPT'].status, 'over');
assert.equal(byName['Trả góp FPT'].amount, 1000000);
assert.equal(byName['Sao kê VIB'].status, 'over', 'sao kê 20/9 hạn 5/10 chưa trả');
assert.equal(byName['Sao kê VIB'].amount, 4280000);
assert.equal(byName['Phí thường niên VIB'].status, 'up');
assert.equal(cal.totalCount, 7);
assert.equal(cal.paidCount, 1);
assert.equal(cal.leftAmount, 612000 + 265000 + 140000 + 1000000 + 4280000 + 590000);
assert.equal(byName['Sao kê VIB'].expense, 0, 'sao kê không phải chi mới — khoản quẹt đã tính hôm quẹt');
assert.equal(byName['Trả góp FPT'].expense, 0, 'kỳ vay chỉ tính phần lãi (lãi suất 0 → 0)');
assert.equal(cal.upcomingFixedSpend, 612000 + 265000 + 140000 + 590000, 'hóa đơn + phí chưa trả trong tháng');
const interestLoan = paymentCalendar({ today, loans: [
  { id: 'vay', name: 'Vay', kind: 'amort', principal: 12000000, rate: 12, term: 12, done: 0, pay_day: 20, opened_at: '2026-06-01' },
] });
assert.equal(interestLoan.entries[0].expense, 120000, 'kỳ vay đầu: lãi = 12tr × 1%/tháng');
assert.equal(cal.cells.length, 35, 'tháng 10/2026 bắt đầu thứ Năm → 5 tuần');
assert.equal(cal.cells[2], null, 'thứ Tư trước ngày 1 là ô trống');
assert.equal(cal.cells[3].day, 1, 'ô thứ 4 (thứ Năm) là ngày 1');
assert.equal(cal.cells[3 + 4].status, 'over', 'ngày 5 có cả sao kê + nước quá hạn');
assert.equal(cal.cells[3 + 4].items.length, 2);
assert.equal(paymentCalendar({ today: '2026-08-08' }).cells.length, 42,
  'tháng 8/2026 bắt đầu thứ Bảy → cần 6 tuần, không mất ngày 31');
// 22/10: kỳ 20/10 vừa chốt (hạn 5/11, tháng sau); sao kê 20/9 hạn 5/10 vẫn nằm trong lịch tháng 10.
const paidCard = paymentCalendar({ today: '2026-10-22', cards: [{ id: 'vib', name: 'VIB', statement_day: 20, due_day: 5 }], transactions: [
  { source_card_id: 'vib', type: 'expense', amount: 4280000, occurred_at: '2026-09-15' },
  { card_id: 'vib', type: 'expense', excluded: true, amount: 4280000, occurred_at: '2026-10-21', card_period: '2026-10' },
] });
assert.deepEqual(paidCard.entries.map(e => [e.date, e.status]), [['2026-10-05', 'paid']],
  'trả đủ muộn (mang nhãn kỳ mới) thì sao kê cũ vẫn tính là đã trả');
assert.deepEqual(paymentCalendar({ today }).entries, [], 'không có dữ liệu thì trống, không có mẫu');
console.log('paymentCalendar check: OK');

// ── Sắp tới hạn theo ngày thật ──
const groups = groupByDueDate([
  { id: 'a', days: 1 }, { id: 'b', days: 3 }, { id: 'c', days: 1 }, { id: 'd', days: 5 }, { id: 'x', days: null },
], today);
assert.deepEqual(groups.map(g => [g.date, g.items.map(i => i.id)]),
  [['2026-10-09', ['a', 'c']], ['2026-10-11', ['b']], ['2026-10-13', ['d']]]);
assert.equal(groups[0].label, 'MAI · THỨ SÁU 9/10');
assert.equal(groups[1].label, 'CHỦ NHẬT 11/10');
console.log('groupByDueDate check: OK');

// ── Tuần tập ──
const week = weekTraining({
  today,
  routineItems: [{ weekday: 1 }, { weekday: 2 }, { weekday: 4 }, { weekday: 5 }],
  sessions: [
    { status: 'completed', local_date: '2026-10-05' },
    { status: 'abandoned', local_date: '2026-10-06' },
    { status: 'completed', local_date: '2026-10-07' },
  ],
});
assert.deepEqual(week.days.map(d => d.state), ['done', 'missed', 'done', 'today', 'plan', 'rest', 'rest']);
assert.equal(week.done, 2);
assert.equal(week.planned, 4);
console.log('weekTraining check: OK');

// ── Phục hồi cơ ──
const nowMs = new Date('2026-10-08T20:00:00').getTime();
const exerciseMap = new Map([
  ['row', { primary: 'lats', secondary: ['biceps'] }],
  ['press', { primary: 'chest', secondary: ['triceps'] }],
]);
const muscles = { lats: { name: 'Xô' }, biceps: { name: 'Tay trước' }, chest: { name: 'Ngực' }, triceps: { name: 'Tay sau' }, quads: { name: 'Đùi trước' } };
const rec = muscleRecoveryGroups({
  nowMs, exerciseMap, muscles,
  recentSets: [
    ...Array.from({ length: 6 }, () => ({ exercise_key: 'row', actual_val: 10, completed_at: '2026-10-08T18:00:00' })),
    { exercise_key: 'press', actual_val: 10, completed_at: '2026-10-07T18:00:00' },
    { exercise_key: 'press', actual_val: null, weight: null, reps: null, completed_at: '2026-10-08T19:00:00' },
  ],
});
assert.deepEqual(rec.find(g => g.id === 'low').muscles, ['Xô', 'Tay trước'], 'vừa tập 2 giờ trước → cần nghỉ');
assert.ok(rec.find(g => g.id === 'ready').muscles.includes('Đùi trước'), 'chưa tập → sẵn sàng');
assert.ok(!rec.find(g => g.id === 'low').muscles.includes('Ngực'), 'set bỏ qua không tính');
console.log('muscleRecoveryGroups check: OK');

// ── Cân nặng ──
const wt = weightTrend([
  { weight: 66.2, measured_at: '2026-09-01T07:00:00', local_date: '2026-09-01' },
  { weight: 65.4, measured_at: '2026-09-20T07:00:00', local_date: '2026-09-20' },
  { weight: 70, measured_at: '2026-10-07T07:00:00', local_date: '2026-10-07', is_outlier: true },
  { weight: 64.95, measured_at: '2026-10-08T07:00:00', local_date: '2026-10-08' },
], 63, today);
assert.equal(wt.latest, 64.95, 'bỏ lần cân lệch');
assert.equal(wt.toGoal, 1.95);
assert.deepEqual(wt.points, [65.4, 64.95], 'chỉ 30 ngày gần nhất');
assert.deepEqual(weightTrend([], null, today), { latest: null, goal: null, toGoal: null, points: [] });
console.log('weightTrend check: OK');

// ── Ô Nhiệm vụ ──
const taskStats = taskCompletionStats([
  { id: 1, completed_at: '2026-10-08T09:00:00', due_date: '2026-10-08' },
  { id: 2, completed_at: '2026-10-07T09:00:00', due_date: '2026-10-05' },
  { id: 3, completed_at: '2026-10-07T10:00:00' },
  { id: 1, completed_at: '2026-10-08T09:00:00', due_date: '2026-10-08' },
  { id: 4, completed_at: '2026-09-20T09:00:00', due_date: '2026-09-25' },
], today);
assert.equal(taskStats.done, 3, 'không đếm trùng, bỏ việc ngoài 14 ngày');
assert.equal(taskStats.onTimePct, 50, '1/2 việc có hạn xong đúng hạn');
assert.equal(taskStats.bars.length, 14);
assert.deepEqual(taskStats.bars.slice(-2), [2, 1]);
assert.equal(taskCompletionStats([], today).onTimePct, null);
console.log('taskCompletionStats check: OK');

// ── Ô Tài chính ──
const daily = dailySpendStats(txs, today);
assert.equal(daily.avgPerDay, 250000, '2tr / 8 ngày');
assert.equal(daily.prevAvgPerDay, Math.round(3100000 / 30));
assert.deepEqual(daily.bars, [400000, 0, 1000000, 0, 0, 0, 0, 600000]);
assert.equal(dailySpendStats([], today).prevAvgPerDay, null);
console.log('dailySpendStats check: OK');

// ── Ô Knowledge ──
const kn = knowledgeActivity(['2026-10-06T10:00:00', '2026-10-08T08:00:00', '2026-10-01T08:00:00', '2026-08-01T08:00:00'], today);
assert.equal(kn.thisWeek, 2, 'tuần này tính từ thứ Hai 5/10');
assert.equal(kn.bars.length, 8);
assert.deepEqual(kn.bars.slice(-2), [1, 2]);
console.log('knowledgeActivity check: OK');

// ── Nhiệm vụ hôm nay trống: gợi ý việc có hạn trong tuần ──
const suggestions = upcomingTaskSuggestions([
  { id: 'far', due_date: '2026-10-20', priority: 5 },
  { id: 'sun', due_date: '2026-10-11', priority: 1 },
  { id: 'fri-low', due_date: '2026-10-09', priority: 2 },
  { id: 'fri-high', due_date: '2026-10-09', priority: 5 },
  { id: 'done', due_date: '2026-10-10', completed: true },
  { id: 'skip', due_date: '2026-10-10', status: 'skip' },
  { id: 'sub', due_date: '2026-10-10', parent_task_id: 'p' },
  { id: 'today', due_date: today },
  { id: 'wed', due_date: '2026-10-14' },
], today);
assert.deepEqual(suggestions.map(t => t.id), ['fri-high', 'fri-low', 'sun'],
  'hạn gần trước, cùng hạn ưu tiên cao trước, tối đa 3, chỉ trong 7 ngày tới');
assert.deepEqual(upcomingTaskSuggestions([{ id: 'wed', due_date: '2026-10-14' }], today).map(t => t.id), ['wed'], '+6 ngày vẫn tính');
assert.equal(shortDueLabel('2026-10-09', today), 'Mai');
assert.equal(shortDueLabel('2026-10-11', today), 'CN 11/10');
assert.deepEqual(pullToTodayChanges({ due_date: '2026-10-10' }, today), { due_date: today });
assert.deepEqual(pullToTodayChanges({ due_date: '2026-10-10', start_date: '2026-10-01' }, today), { due_date: today },
  'bắt đầu đã qua thì giữ nguyên');
assert.deepEqual(pullToTodayChanges({ due_date: '2026-10-10', start_date: '2026-10-09', start_time: '09:00' }, today),
  { due_date: today, start_date: today }, 'bắt đầu sau hôm nay → về hôm nay, không vi phạm CHECK bắt đầu < hạn');
assert.deepEqual(pullToTodayChanges({ due_date: '2026-10-10', due_time: '08:00', start_date: '2026-10-09', start_time: '09:00' }, today),
  { due_date: today, start_date: today, start_time: null }, 'cùng ngày mà giờ bắt đầu ≥ giờ hạn thì bỏ giờ bắt đầu');
console.log('upcomingTaskSuggestions / pullToTodayChanges check: OK');

console.log('✅ dashboardMetrics pure tests passed!');

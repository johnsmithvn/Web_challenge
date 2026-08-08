/**
 * Self-check cho financeLogic — chạy: `node src/__tests__/financeLogic.test.js`
 *
 * Khoá cứng các bất biến nghiệp vụ của module chi tiêu (docs/DESIGN_FINANCE.md):
 *   - periodTotals: excluded ĐỨNG NGOÀI tổng chi; income/saving KHÔNG trừ vào chi.
 *   - comparePeriods: 3 nhánh (tháng đang chạy = cùng cửa sổ ngày; 2 tháng trọn =
 *     tổng; còn lại = mức/ngày). Nhầm nhánh là con số sai giữa màn hình.
 *   - loanSchedule: annuity đúng công thức; lãi-only tách gốc.
 *   - budgetBreakdown: 50/30/20 trên hạn mức, không trên thu nhập.
 */
import assert from 'node:assert/strict';
import {
  deriveNecessity, periodTotals, comparePeriods, matchCategory, budgetBreakdown,
  cardCycle, loanSchedule, fundBalance, spendingRhythm, listPeriodOptions,
  suggestedDailySpend, maturityWarn, groupByDate, daysInclusive, currentMonthPeriod,
} from '../utils/financeLogic.js';

// Stub cats tối giản (không import JSON để chạy được bằng node).
const CATS = {
  necessityByCat: { food: 'need', housing: 'must', entertainment: 'want' },
  expenseGroups: [
    { key: 'food', label: 'Ăn uống', color: '#e2a94e', icon: '🍜',
      subs: [{ key: 'food.parking', necessity: 'want' }, { key: 'food.rice', necessity: 'need' }] },
    { key: 'housing', label: 'Nhà', color: '#48b3a2', icon: '🏠', subs: [] },
    { key: 'entertainment', label: 'Giải trí', color: '#e58159', icon: '🎮', subs: [] },
  ],
};

/* ── deriveNecessity: sub đè cat, fallback cat, mặc định need ── */
assert.equal(deriveNecessity('food', 'food.parking', CATS), 'want', 'sub đè cat');
assert.equal(deriveNecessity('food', 'food.rice', CATS), 'need');
assert.equal(deriveNecessity('housing', null, CATS), 'must', 'fallback theo cat');
assert.equal(deriveNecessity('unknown', null, CATS), 'need', 'mặc định need');
console.log('deriveNecessity check: OK');

/* ── periodTotals: excluded & income & saving tách bạch ── */
const txs = [
  { occurred_at: '2026-08-05', type: 'expense', amount: 100000, category_id: 'food', necessity: 'need' },
  { occurred_at: '2026-08-10', type: 'expense', amount: 200000, category_id: 'housing', necessity: 'must', is_fixed: true },
  { occurred_at: '2026-08-12', type: 'expense', amount: 999000, category_id: 'finance', necessity: 'must', excluded: true }, // trả gốc — NGOÀI tổng
  { occurred_at: '2026-08-15', type: 'income', amount: 5000000 },
  { occurred_at: '2026-08-20', type: 'saving', amount: 300000, saving_dir: 'in' },
  { occurred_at: '2026-07-30', type: 'expense', amount: 50000, category_id: 'food', necessity: 'need' }, // ngoài kỳ
];
const t = periodTotals(txs, { from: '2026-08-01', to: '2026-08-31' });
assert.equal(t.total, 300000, 'total chỉ gồm 2 expense không-excluded trong kỳ');
assert.equal(t.count, 2);
assert.equal(t.fixed, 200000, 'fixed = khoản is_fixed');
assert.equal(t.income, 5000000, 'income tách riêng, KHÔNG trừ vào chi');
assert.equal(t.savingIn, 300000);
assert.equal(t.byNecessity.must, 200000, 'excluded không vào byNecessity');
assert.equal(t.byNecessity.need, 100000);
assert.equal(t.byCategory.food, 100000);
assert.equal(t.biggest.amount, 200000, 'khoản lớn nhất bỏ qua excluded');
assert.equal(t.days, 31);
console.log('periodTotals check: OK');

/* ── comparePeriods: nhánh 1 — tháng đang chạy, cùng cửa sổ ngày ── */
const cur = [
  { occurred_at: '2026-08-05', type: 'expense', amount: 100000 },
  { occurred_at: '2026-08-10', type: 'expense', amount: 200000 },
];
const prev = [
  { occurred_at: '2026-07-05', type: 'expense', amount: 150000 }, // trong cửa sổ 13 ngày
  { occurred_at: '2026-07-25', type: 'expense', amount: 500000 }, // ngoài cửa sổ → không tính
];
const c1 = comparePeriods(cur, prev, { from: '2026-08-01', to: '2026-08-31' },
  { from: '2026-07-01', to: '2026-07-31' }, '2026-08-13');
assert.equal(c1.mode, 'window');
assert.equal(c1.dayN, 13);
assert.equal(c1.curValue, 300000);
assert.equal(c1.prevValue, 150000, 'kỳ trước chỉ tính tới cùng cửa sổ 13 ngày');
assert.equal(c1.deltaPct, 100);

/* nhánh 2 — hai tháng dương lịch đã trọn (hôm nay ở tháng khác) → so tổng */
const c2 = comparePeriods(
  [{ occurred_at: '2026-06-10', type: 'expense', amount: 400000 }],
  [{ occurred_at: '2026-05-10', type: 'expense', amount: 200000 }],
  { from: '2026-06-01', to: '2026-06-30' }, { from: '2026-05-01', to: '2026-05-31' }, '2026-08-13');
assert.equal(c2.mode, 'total');
assert.equal(c2.curValue, 400000);

/* nhánh 3 — năm chưa trọn → mức trung bình mỗi ngày */
const c3 = comparePeriods(
  [{ occurred_at: '2026-03-10', type: 'expense', amount: 365000 }],
  [{ occurred_at: '2025-03-10', type: 'expense', amount: 730000 }],
  { from: '2026-01-01', to: '2026-12-31' }, { from: '2025-01-01', to: '2025-12-31' }, '2026-08-13');
assert.equal(c3.mode, 'avgPerDay');
console.log('comparePeriods check: OK');

/* ── matchCategory ── */
assert.deepEqual(matchCategory('cà phê 35k'), { categoryId: 'food', subId: 'food.coffee' });
assert.deepEqual(matchCategory('đổ xăng 50'), { categoryId: 'transport', subId: 'transport.fuel' });
assert.equal(matchCategory('abcxyz không khớp'), null);
console.log('matchCategory check: OK');

/* ── budgetBreakdown: 50/30/20 trên hạn mức ── */
const bt = periodTotals([
  { occurred_at: '2026-08-05', type: 'expense', amount: 300000, category_id: 'food', necessity: 'need' },
  { occurred_at: '2026-08-06', type: 'expense', amount: 500000, category_id: 'housing', necessity: 'must' },
  { occurred_at: '2026-08-07', type: 'expense', amount: 200000, category_id: 'entertainment', necessity: 'want' },
], { from: '2026-08-01', to: '2026-08-31' });
const bb = budgetBreakdown(bt, [
  { category_id: 'food', limit_amount: 1000000 },
  { category_id: 'housing', limit_amount: 2000000 },
  { category_id: 'entertainment', limit_amount: 500000 },
], CATS);
assert.equal(bb.totalLimit, 3500000);
assert.equal(bb.totalSpent, 1000000);
assert.equal(bb.levels.must.limit, 2000000, 'housing → must');
assert.equal(bb.levels.need.limit, 1000000, 'food → need');
assert.equal(bb.levels.want.spent, 200000, 'entertainment → want');
assert.equal(bb.cutable, 200000, 'cắt được = nhóm muốn có');
const foodRow = bb.categories.find(c => c.categoryId === 'food');
assert.equal(foodRow.pct, 30);
console.log('budgetBreakdown check: OK');

/* ── cardCycle: chốt ≠ đến hạn, đếm ngược ── */
const cc = cardCycle({ statement_day: 5, due_day: 25 }, '2026-08-13');
assert.equal(cc.statement, '2026-08-05', 'chốt gần nhất ≤ hôm nay');
assert.equal(cc.due, '2026-08-25');
assert.equal(cc.daysUntilDue, 12);
assert.equal(cc.overdue, false);
// due_day ≤ statement_day → đến hạn rơi sang tháng sau
const cc2 = cardCycle({ statement_day: 25, due_day: 15 }, '2026-08-28');
assert.equal(cc2.statement, '2026-08-25');
assert.equal(cc2.due, '2026-09-15');
console.log('cardCycle check: OK');

/* ── loanSchedule: interest vs amort ── */
const li = loanSchedule({ kind: 'interest', principal: 100000000, rate: 12, term: 12, due_at: '2027-08-01' });
assert.equal(li.monthlyInterest, 1000000, 'lãi tháng = P*12%/12');
assert.equal(li.principalDue, 100000000);
const la = loanSchedule({ kind: 'amort', principal: 12000000, rate: 0, term: 12 });
assert.equal(la.monthlyPayment, 1000000, 'rate 0 → chia đều');
const la2 = loanSchedule({ kind: 'amort', principal: 100000000, rate: 12, term: 24, done: 0 });
assert.ok(la2.monthlyPayment > 4700000 && la2.monthlyPayment < 4720000, 'annuity ~4.707tr');
console.log('loanSchedule check: OK');

/* ── fundBalance: bình quân gia quyền ── */
const fb = fundBalance([{ amount: 100000000, rate: 6 }, { amount: 100000000, rate: 4 }]);
assert.equal(fb.total, 200000000);
assert.equal(fb.weightedRate, 5);
assert.deepEqual(fundBalance([]), { total: 0, weightedRate: 0 });
console.log('fundBalance check: OK');

/* ── spendingRhythm: đơn vị ngày vs tháng ── */
const rDay = spendingRhythm([
  { occurred_at: '2026-08-01', type: 'expense', amount: 100000 },
  { occurred_at: '2026-08-03', type: 'expense', amount: 300000 },
], { from: '2026-08-01', to: '2026-08-03', unit: 'day' });
assert.equal(rDay.rows.length, 3, '3 ngày liên tục kể cả ngày 0đ');
assert.equal(rDay.avg, 200000, 'trung bình chỉ tính ngày có chi');
const rMonth = spendingRhythm([
  { occurred_at: '2026-01-15', type: 'expense', amount: 100000 },
  { occurred_at: '2026-03-15', type: 'expense', amount: 100000 },
], { from: '2026-01-01', to: '2026-03-31', unit: 'month' });
assert.equal(rMonth.rows.length, 3, 'Jan/Feb/Mar');
console.log('spendingRhythm check: OK');

/* ── listPeriodOptions: đúng 15 mục ── */
const opts = listPeriodOptions('2026-08-13');
assert.equal(opts.length, 15, '12 tháng + 2 năm + tất cả');
assert.equal(opts[7].from, '2026-08-01', 'tháng 8');
assert.equal(currentMonthPeriod('2026-08-13').from, '2026-08-01');
console.log('listPeriodOptions check: OK');

/* ── phụ trợ ── */
assert.equal(suggestedDailySpend(3000000, 1000000, '2026-08-13', '2026-08-31').daysLeft, 19);
assert.equal(maturityWarn('2026-09-01', '2026-08-13').warn, true, '≤45 ngày → cảnh báo');
assert.equal(maturityWarn('2027-01-01', '2026-08-13').warn, false);
assert.equal(daysInclusive('2026-08-01', '2026-08-31'), 31);
assert.equal(groupByDate([{ occurred_at: '2026-08-01' }, { occurred_at: '2026-08-03' }])[0].date, '2026-08-03', 'mới nhất trước');
console.log('misc check: OK');

console.log('\n✅ financeLogic — tất cả self-check PASS');

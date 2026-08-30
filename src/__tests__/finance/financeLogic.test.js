/**
 * Self-check cho financeLogic — chạy: `node src/__tests__/financeLogic.test.js`
 *
 * Khoá cứng các bất biến nghiệp vụ của module chi tiêu (docs/DESIGN_FINANCE.md):
 *   - periodTotals: excluded ĐỨNG NGOÀI tổng chi; income/saving KHÔNG trừ vào chi.
 *   - comparePeriods: 3 nhánh (tháng đang chạy = cùng cửa sổ ngày; 2 tháng trọn =
 *     tổng; còn lại = mức/ngày). Nhầm nhánh là con số sai giữa màn hình.
 *   - loanSchedule: annuity đúng công thức; lãi-only tách gốc.
 *   - budgetBreakdown: 50/30/20 trên hạn mức, không trên thu nhập.
 *   - billCycle / billPeriods / billPeriodForDate: chu kỳ đa tháng và ngày trả chuẩn xác.
 *   - NL_DICT / matchCategory: đoán đúng 100% taxonomy quy tắc.
 *   - floatInterest / blendedRate / fundBalance: tính lãi float và quỹ tiết kiệm.
 */
import assert from 'node:assert/strict';
import {
  NECESSITY_ORDER,
  deriveNecessity,
  ymd,
  parseYmd,
  addDaysStr,
  daysInclusive,
  monthStart,
  monthEnd,
  dueDateInMonth,
  daysUntilDue,
  nextDueDate,
  shiftMonth,
  billCycle,
  billPeriods,
  billPeriodForDate,
  billSettled,
  listPeriodOptions,
  periodFromKey,
  currentMonthPeriod,
  periodTotals,
  comparePeriods,
  NL_DICT,
  matchCategory,
  budgetBreakdown,
  suggestedDailySpend,
  cardCycle,
  nextAnnualFee,
  cardBalance,
  cardStatementSummary,
  floatInterest,
  loanSchedule,
  lendingInterest,
  forfeitedInterest,
  billAmountEstimate,
  fundBalance,
  blendedRate,
  maturityWarn,
  spendingRhythm,
  groupByDate,
} from '../../utils/financeLogic.js';

// Stub cats tối giản (không import JSON để chạy được bằng node).
const CATS = {
  necessityByCat: { food: 'want', housing: 'must', entertainment: 'want', transport: 'must' },
  expenseGroups: [
    {
      key: 'food', label: 'Ăn uống', color: '#e2a94e', icon: '🍜',
      subs: [
        { key: 'food.parking', necessity: 'must' },
        { key: 'food.rice', necessity: 'want' },
        { key: 'food.other' }, // không có necessity để test fallback
      ],
    },
    { key: 'housing', label: 'Nhà', color: '#48b3a2', icon: '🏠', subs: [] },
    { key: 'entertainment', label: 'Giải trí', color: '#e58159', icon: '🎮', subs: [] },
    { key: 'transport', label: 'Đi lại', color: '#4d9df5', icon: '🛵', subs: [] },
  ],
};

/* ── 1. Date helpers thuần ─────────────────────────────────── */
// ymd
assert.equal(ymd(new Date(2026, 0, 5)), '2026-01-05', 'tháng và ngày 1 chữ số phải pad 0');
assert.equal(ymd(new Date(2026, 11, 31)), '2026-12-31');

// parseYmd
const pDate = parseYmd('2026-08-15');
assert.equal(pDate.getFullYear(), 2026);
assert.equal(pDate.getMonth(), 7); // 0-indexed
assert.equal(pDate.getDate(), 15);
assert.equal(pDate.getHours(), 0, 'giờ phải là 00:00:00');

// addDaysStr
assert.equal(addDaysStr('2026-02-28', 1), '2026-03-01', 'năm thường 2026 qua ngày 1/3');
assert.equal(addDaysStr('2024-02-28', 1), '2024-02-29', 'năm nhuận 2024 có 29/2');
assert.equal(addDaysStr('2026-01-01', -1), '2025-12-31', 'lùi 1 ngày qua năm trước');
assert.equal(addDaysStr('2026-08-15', 0), '2026-08-15', 'cộng 0 ngày giữ nguyên');

// daysInclusive
assert.equal(daysInclusive('2026-08-01', '2026-08-01'), 1, 'cùng ngày = 1 ngày');
assert.equal(daysInclusive('2026-08-01', '2026-08-31'), 31, 'cả tháng 8 có 31 ngày');
assert.equal(daysInclusive('2026-02-01', '2026-02-28'), 28, 'tháng 2/2026 có 28 ngày');
assert.equal(daysInclusive('2024-02-01', '2024-02-29'), 29, 'tháng 2/2024 có 29 ngày');

// monthStart & monthEnd
assert.equal(monthStart(2026, 0), '2026-01-01');
assert.equal(monthStart(2026, 11), '2026-12-01');
assert.equal(monthEnd(2026, 0), '2026-01-31');
assert.equal(monthEnd(2026, 1), '2026-02-28');
assert.equal(monthEnd(2024, 1), '2024-02-29', 'năm nhuận tháng 2 kết thúc ngày 29');
assert.equal(monthEnd(2026, 3), '2026-04-30');
assert.equal(monthEnd(2026, 11), '2026-12-31');

// shiftMonth
assert.equal(shiftMonth('2026-08-15', 3), '2026-11-01', 'tiến 3 tháng');
assert.equal(shiftMonth('2026-08-15', 5), '2027-01-01', 'tiến qua năm mới');
assert.equal(shiftMonth('2026-02-10', -2), '2025-12-01', 'lùi qua năm cũ');
assert.equal(shiftMonth('2026-08-15', 0), '2026-08-01', 'shift 0 tháng ra mùng 1 tháng này');
console.log('date pure helpers check: OK');

/* ── 2. deriveNecessity & NECESSITY_ORDER ───────────────────── */
assert.deepEqual(NECESSITY_ORDER, ['must', 'want']);
assert.equal(deriveNecessity('food', 'food.parking', CATS), 'must', 'sub đè cat');
assert.equal(deriveNecessity('food', 'food.rice', CATS), 'want');
assert.equal(deriveNecessity('food', 'food.other', CATS), 'want', 'sub không có necessity fallback theo cat');
assert.equal(deriveNecessity('housing', null, CATS), 'must', 'fallback theo cat');
assert.equal(deriveNecessity('unknown', null, CATS), 'want', 'mặc định want');
assert.equal(deriveNecessity('food', null, null), 'want', 'cats null mặc định want');
assert.equal(deriveNecessity('food', 'food.parking', null), 'want', 'cats null không tra được sub');
console.log('deriveNecessity check: OK');

/* ── 3. periodTotals: excluded, income, saving và edge cases ── */
// Mảng rỗng
const emptyTotal = periodTotals([], { from: '2026-08-01', to: '2026-08-31' });
assert.equal(emptyTotal.total, 0);
assert.equal(emptyTotal.count, 0);
assert.equal(emptyTotal.income, 0);
assert.equal(emptyTotal.savingIn, 0);
assert.equal(emptyTotal.savingOut, 0);
assert.equal(emptyTotal.fixed, 0);
assert.equal(emptyTotal.biggest, null);
assert.deepEqual(emptyTotal.byCategory, {});
assert.deepEqual(emptyTotal.byNecessity, { must: 0, want: 0 });
assert.equal(emptyTotal.days, 31);

const txs = [
  { occurred_at: '2026-08-01', type: 'expense', amount: 100000, category_id: 'food', necessity: 'want' }, // đúng ngày biên from
  { occurred_at: '2026-08-10', type: 'expense', amount: 200000, category_id: 'housing', necessity: 'must', is_fixed: true },
  { occurred_at: '2026-08-12', type: 'expense', amount: 999000, category_id: 'finance', necessity: 'must', excluded: true }, // trả gốc — NGOÀI tổng
  { occurred_at: '2026-08-15', type: 'income', amount: 5000000 },
  { occurred_at: '2026-08-16', type: 'income', amount: 2000000, excluded: true }, // income excluded không vào tổng thu
  { occurred_at: '2026-08-20', type: 'saving', amount: 300000, saving_dir: 'in' },
  { occurred_at: '2026-08-31', type: 'expense', amount: 50000, category_id: 'food', necessity: 'want' }, // đúng ngày biên to
  { occurred_at: '2026-07-31', type: 'expense', amount: 80000, category_id: 'food', necessity: 'want' }, // trước kỳ
  { occurred_at: '2026-09-01', type: 'expense', amount: 90000, category_id: 'food', necessity: 'want' }, // sau kỳ
  { occurred_at: '2026-08-18', type: 'expense', amount: 40000 }, // thiếu category_id và necessity -> fallback 'other' & 'want'
];
const t = periodTotals(txs, { from: '2026-08-01', to: '2026-08-31' });
assert.equal(t.total, 390000, 'total chỉ gồm 4 expense không-excluded trong kỳ');
assert.equal(t.count, 4);
assert.equal(t.txCount, 8, 'txCount đếm mọi transaction trong kỳ kể cả income/saving/excluded');
assert.equal(t.fixed, 200000, 'fixed = khoản is_fixed');
assert.equal(t.income, 5000000, 'income tách riêng, excluded=true không tính, KHÔNG trừ vào chi');
assert.equal(t.savingIn, 300000);
assert.equal(t.byNecessity.must, 200000, 'excluded không vào byNecessity');
assert.equal(t.byNecessity.want, 190000, 'gồm 100k + 50k + 40k fallback want');
assert.equal(t.byCategory.food, 150000);
assert.equal(t.byCategory.housing, 200000);
assert.equal(t.byCategory.other, 40000, 'không có category_id vào nhóm other');
assert.equal(t.biggest.amount, 200000, 'khoản lớn nhất bỏ qua excluded');
assert.equal(t.days, 31);

// Option savingAsExpense
const withSaving = periodTotals(txs, { from: '2026-08-01', to: '2026-08-31' }, { savingAsExpense: true });
assert.equal(withSaving.total, 690000, 'tiền gửi quỹ được tính như chi khi bật tuỳ chọn (390k + 300k)');
assert.equal(withSaving.count, 5);
assert.equal(withSaving.byNecessity.must, 500000, 'tiền để dành luôn thuộc mức bắt buộc (+300k)');
assert.equal(withSaving.byCategory.finance, 300000, 'tiền để dành vào nhóm tài chính');

const savingEx = periodTotals([
  { occurred_at: '2026-08-20', type: 'saving', amount: 100000, saving_dir: 'in', excluded: true },
  { occurred_at: '2026-08-21', type: 'saving', amount: 150000, saving_dir: 'out' },
  { occurred_at: '2026-08-22', type: 'saving', amount: 200000, saving_dir: 'in', is_fixed: true, category_id: 'custom_cat' },
], { from: '2026-08-01', to: '2026-08-31' }, { savingAsExpense: true });
assert.equal(savingEx.savingOut, 150000);
assert.equal(savingEx.total, 200000, 'saving excluded và saving out không được tính vào chi');
assert.equal(savingEx.fixed, 200000, 'saving is_fixed tính vào fixed');
assert.equal(savingEx.byCategory.custom_cat, 200000);
console.log('periodTotals check: OK');

/* ── 4. comparePeriods: 3 nhánh & edge cases mẫu số 0 ──────── */
const cur = [
  { occurred_at: '2026-08-05', type: 'expense', amount: 100000 },
  { occurred_at: '2026-08-10', type: 'expense', amount: 200000 },
];
const prev = [
  { occurred_at: '2026-07-05', type: 'expense', amount: 150000 }, // trong cửa sổ 13 ngày
  { occurred_at: '2026-07-25', type: 'expense', amount: 500000 }, // ngoài cửa sổ → không tính
];

// Nhánh 1: tháng đang chạy, cùng cửa sổ ngày
const c1 = comparePeriods(cur, prev, { from: '2026-08-01', to: '2026-08-31' },
  { from: '2026-07-01', to: '2026-07-31' }, '2026-08-13');
assert.equal(c1.mode, 'window');
assert.equal(c1.dayN, 13);
assert.equal(c1.curValue, 300000);
assert.equal(c1.prevValue, 150000, 'kỳ trước chỉ tính tới cùng cửa sổ 13 ngày');
assert.equal(c1.deltaPct, 100);

// Nhánh 1 kẹp ngày khi ngày refStr lớn hơn độ dài kỳ trước (vd: 31/08 so với tháng 2)
const c1Clamp = comparePeriods(
  [{ occurred_at: '2026-03-31', type: 'expense', amount: 300000 }],
  [{ occurred_at: '2026-02-28', type: 'expense', amount: 100000 }],
  { from: '2026-03-01', to: '2026-03-31' },
  { from: '2026-02-01', to: '2026-02-28' },
  '2026-03-31'
);
assert.equal(c1Clamp.prevValue, 100000, 'winEnd kẹp về cuối tháng 2 (28/02)');

// Nhánh 2: hai tháng dương lịch đã trọn → so tổng
const c2 = comparePeriods(
  [{ occurred_at: '2026-06-10', type: 'expense', amount: 400000 }],
  [{ occurred_at: '2026-05-10', type: 'expense', amount: 200000 }],
  { from: '2026-06-01', to: '2026-06-30' }, { from: '2026-05-01', to: '2026-05-31' }, '2026-08-13');
assert.equal(c2.mode, 'total');
assert.equal(c2.curValue, 400000);
assert.equal(c2.prevValue, 200000);
assert.equal(c2.deltaPct, 100);

// Nhánh 3: năm chưa trọn → mức trung bình mỗi ngày
const c3 = comparePeriods(
  [{ occurred_at: '2026-03-10', type: 'expense', amount: 365000 }],
  [{ occurred_at: '2025-03-10', type: 'expense', amount: 730000 }],
  { from: '2026-01-01', to: '2026-12-31' }, { from: '2025-01-01', to: '2025-12-31' }, '2026-08-13');
assert.equal(c3.mode, 'avgPerDay');
assert.equal(c3.curValue, 1000); // 365.000 / 365
assert.equal(c3.prevValue, 2000); // 730.000 / 365
assert.equal(c3.deltaPct, -50);

// Mẫu số 0 -> deltaPct là null (tránh chia cho 0)
const cZero = comparePeriods(
  [{ occurred_at: '2026-06-10', type: 'expense', amount: 100000 }],
  [],
  { from: '2026-06-01', to: '2026-06-30' }, { from: '2026-05-01', to: '2026-05-31' }, '2026-08-13');
assert.equal(cZero.deltaPct, null, 'prev = 0 thì không tính được deltaPct');
console.log('comparePeriods check: OK');

/* ── 5. matchCategory & NL_DICT: kiểm thử toàn bộ 17 rules ──── */
assert.equal(matchCategory(null), null);
assert.equal(matchCategory(''), null);
assert.equal(matchCategory('không liên quan abc 123'), null);

// Rule 1: food / food.drinks
assert.deepEqual(matchCategory('cà phê sữa 35k'), { categoryId: 'food', subId: 'food.drinks' });
assert.deepEqual(matchCategory('coffee sáng'), { categoryId: 'food', subId: 'food.drinks' });
assert.deepEqual(matchCategory('trà sữa gongcha'), { categoryId: 'food', subId: 'food.drinks' });
assert.deepEqual(matchCategory('uống trà đá'), { categoryId: 'food', subId: 'food.drinks' });

// Rule 2: food / food.eatout
assert.deepEqual(matchCategory('ăn sáng xôi'), { categoryId: 'food', subId: 'food.eatout' });
assert.deepEqual(matchCategory('ăn trưa văn phòng'), { categoryId: 'food', subId: 'food.eatout' });
assert.deepEqual(matchCategory('ăn tối nhà hàng'), { categoryId: 'food', subId: 'food.eatout' });
assert.deepEqual(matchCategory('cơm sườn 45k'), { categoryId: 'food', subId: 'food.eatout' });
assert.deepEqual(matchCategory('bún chả'), { categoryId: 'food', subId: 'food.eatout' });
assert.deepEqual(matchCategory('phở bò tái'), { categoryId: 'food', subId: 'food.eatout' });
assert.deepEqual(matchCategory('bữa phụ chiều'), { categoryId: 'food', subId: 'food.eatout' });

// Rule 3: food / food.grocery
assert.deepEqual(matchCategory('đi chợ mua rau'), { categoryId: 'food', subId: 'food.grocery' });
assert.deepEqual(matchCategory('siêu thị coopmart'), { categoryId: 'food', subId: 'food.grocery' });
assert.deepEqual(matchCategory('mua rau củ'), { categoryId: 'food', subId: 'food.grocery' });
assert.deepEqual(matchCategory('mua thịt bò'), { categoryId: 'food', subId: 'food.grocery' });

// Rule 4: food / food.snack
assert.deepEqual(matchCategory('ăn vặt bánh tráng'), { categoryId: 'food', subId: 'food.snack' });
assert.deepEqual(matchCategory('snack oishi'), { categoryId: 'food', subId: 'food.snack' });
assert.deepEqual(matchCategory('bánh ngọt'), { categoryId: 'food', subId: 'food.snack' });
assert.deepEqual(matchCategory('kẹo dẻo'), { categoryId: 'food', subId: 'food.snack' });

// Rule 5: transport / transport.fuel
assert.deepEqual(matchCategory('đổ xăng 50k'), { categoryId: 'transport', subId: 'transport.fuel' });
assert.deepEqual(matchCategory('thay dầu nhớt'), { categoryId: 'transport', subId: 'transport.fuel' });

// Rule 6: transport / transport.parking
assert.deepEqual(matchCategory('gửi xe máy 5k'), { categoryId: 'transport', subId: 'transport.parking' });
assert.deepEqual(matchCategory('giữ xe ô tô'), { categoryId: 'transport', subId: 'transport.parking' });
assert.deepEqual(matchCategory('vé bãi xe'), { categoryId: 'transport', subId: 'transport.parking' });

// Rule 7: transport / transport.taxi
assert.deepEqual(matchCategory('đi grab bike'), { categoryId: 'transport', subId: 'transport.taxi' });
assert.deepEqual(matchCategory('taxi mai linh'), { categoryId: 'transport', subId: 'transport.taxi' });
assert.deepEqual(matchCategory('xe ôm về nhà'), { categoryId: 'transport', subId: 'transport.taxi' });
assert.deepEqual(matchCategory('gojek giao hàng'), { categoryId: 'transport', subId: 'transport.taxi' });

// Rule 8: housing / housing.electric
assert.deepEqual(matchCategory('tiền điện tháng 8'), { categoryId: 'housing', subId: 'housing.electric' });
assert.deepEqual(matchCategory('hóa đơn điện'), { categoryId: 'housing', subId: 'housing.electric' });
assert.deepEqual(matchCategory('đóng tiền điện'), { categoryId: 'housing', subId: 'housing.electric' });

// Rule 9: housing / housing.water
assert.deepEqual(matchCategory('tiền nước sinh hoạt'), { categoryId: 'housing', subId: 'housing.water' });
assert.deepEqual(matchCategory('hóa đơn nước'), { categoryId: 'housing', subId: 'housing.water' });

// Rule 10: subscription / housing.internet
assert.deepEqual(matchCategory('cước internet'), { categoryId: 'subscription', subId: 'housing.internet' });
assert.deepEqual(matchCategory('đóng wifi'), { categoryId: 'subscription', subId: 'housing.internet' });
assert.deepEqual(matchCategory('cáp mạng fpt'), { categoryId: 'subscription', subId: 'housing.internet' });
assert.deepEqual(matchCategory('gói viettel'), { categoryId: 'subscription', subId: 'housing.internet' });

// Rule 11: housing / housing.rent
assert.deepEqual(matchCategory('tiền nhà tháng này'), { categoryId: 'housing', subId: 'housing.rent' });
assert.deepEqual(matchCategory('thuê nhà trọ'), { categoryId: 'housing', subId: 'housing.rent' });
assert.deepEqual(matchCategory('thuê phòng'), { categoryId: 'housing', subId: 'housing.rent' });

// Rule 12: personal / subscription.streaming
assert.deepEqual(matchCategory('netflix 260k'), { categoryId: 'personal', subId: 'subscription.streaming' });
assert.deepEqual(matchCategory('spotify tháng'), { categoryId: 'personal', subId: 'subscription.streaming' });
assert.deepEqual(matchCategory('youtube premium'), { categoryId: 'personal', subId: 'subscription.streaming' });
assert.deepEqual(matchCategory('đăng ký gói học'), { categoryId: 'personal', subId: 'subscription.streaming' });
assert.deepEqual(matchCategory('subscri dịch vụ'), { categoryId: 'personal', subId: 'subscription.streaming' });

// Rule 13: health / health.medicine
assert.deepEqual(matchCategory('thuốc hạ sốt'), { categoryId: 'health', subId: 'health.medicine' });
assert.deepEqual(matchCategory('khám tổng quát'), { categoryId: 'health', subId: 'health.medicine' });
assert.deepEqual(matchCategory('viện phí bệnh viện'), { categoryId: 'health', subId: 'health.medicine' });
assert.deepEqual(matchCategory('tiền bác sĩ'), { categoryId: 'health', subId: 'health.medicine' });

// Rule 14: personal / entertainment.events
assert.deepEqual(matchCategory('vé xem phim'), { categoryId: 'personal', subId: 'entertainment.events' });
assert.deepEqual(matchCategory('vé sự kiện âm nhạc'), { categoryId: 'personal', subId: 'entertainment.events' });

// Rule 15: personal / entertainment.game
assert.deepEqual(matchCategory('nạp game steam'), { categoryId: 'personal', subId: 'entertainment.game' });

// Rule 16: personal / entertainment.travel
assert.deepEqual(matchCategory('đi du lịch hè'), { categoryId: 'personal', subId: 'entertainment.travel' });

// Rule 17: personal / shopping.clothes
assert.deepEqual(matchCategory('mua quần áo'), { categoryId: 'personal', subId: 'shopping.clothes' });
assert.deepEqual(matchCategory('áo sơ mi'), { categoryId: 'personal', subId: 'shopping.clothes' });
assert.deepEqual(matchCategory('giày thể thao'), { categoryId: 'personal', subId: 'shopping.clothes' });
assert.deepEqual(matchCategory('mua sắm cuối tuần'), { categoryId: 'personal', subId: 'shopping.clothes' });
assert.deepEqual(matchCategory('đơn shopee'), { categoryId: 'personal', subId: 'shopping.clothes' });
assert.deepEqual(matchCategory('sale lazada'), { categoryId: 'personal', subId: 'shopping.clothes' });

assert.equal(NL_DICT.length, 17, 'đủ 17 rules phân loại tự nhiên');
console.log('matchCategory check: OK');

/* ── 6. budgetBreakdown & suggestedDailySpend ──────────────── */
const bt = periodTotals([
  { occurred_at: '2026-08-05', type: 'expense', amount: 300000, category_id: 'food', necessity: 'want' },
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
assert.equal(bb.remaining, 2500000);
assert.equal(bb.pct, 29); // 1000000 / 3500000 ~ 28.57 -> 29
assert.equal(bb.cutable, 500000, 'cắt được = nhóm tùy chọn (food 300k + entertainment 200k)');

const foodRow = bb.categories.find(c => c.categoryId === 'food');
assert.equal(foodRow.pct, 30);
assert.equal(foodRow.limit, 1000000);
assert.equal(foodRow.spent, 300000);

const transRow = bb.categories.find(c => c.categoryId === 'transport');
assert.equal(transRow.limit, 0);
assert.equal(transRow.spent, 0);
assert.equal(transRow.pct, null, 'limit = 0 thì pct = null');

// Vượt ngân sách
const overTotals = { total: 4000000, byCategory: {}, byNecessity: { want: 1000000 } };
const bbOver = budgetBreakdown(overTotals, [{ category_id: 'food', limit_amount: 2000000 }], CATS);
assert.equal(bbOver.remaining, -2000000, 'âm khi vượt ngân sách');
assert.equal(bbOver.pct, 200);

// Không có hạn mức nào
const bbNoBudget = budgetBreakdown(bt, [], CATS);
assert.equal(bbNoBudget.totalLimit, 0);
assert.equal(bbNoBudget.pct, null);

// suggestedDailySpend
assert.equal(suggestedDailySpend(3000000, 1000000, '2026-08-13', '2026-08-31').daysLeft, 19);
assert.equal(suggestedDailySpend(3000000, 1000000, '2026-08-13', '2026-08-31').perDay, Math.round(2000000 / 19));
assert.equal(suggestedDailySpend(1000000, 2000000, '2026-08-13', '2026-08-31').perDay, 0, 'chi quá hạn mức thì khuyên tiêu 0đ/ngày');
assert.equal(suggestedDailySpend(1000000, 500000, '2026-08-31', '2026-08-31').daysLeft, 1);
assert.equal(suggestedDailySpend(1000000, 500000, '2026-08-31', '2026-08-31').perDay, 500000);
console.log('budgetBreakdown check: OK');

/* ── 7. Thẻ tín dụng & Float ───────────────────────────────── */
const cc = cardCycle({ statement_day: 5, due_day: 25 }, '2026-08-13');
assert.equal(cc.statement, '2026-08-05', 'chốt gần nhất ≤ hôm nay');
assert.equal(cc.due, '2026-08-25');
assert.equal(cc.daysUntilDue, 12);
assert.equal(cc.overdue, false);

// due_day ≤ statement_day → đến hạn rơi sang tháng sau
const cc2 = cardCycle({ statement_day: 25, due_day: 15 }, '2026-08-28');
assert.equal(cc2.statement, '2026-08-25');
assert.equal(cc2.due, '2026-09-15');

// Thẻ có grace period thay vì due_day cố định
const ccGrace = cardCycle({ statement_day: 5, grace: 20 }, '2026-08-13');
assert.equal(ccGrace.statement, '2026-08-05');
assert.equal(ccGrace.due, '2026-08-25', '5 + 20 = ngày 25 cùng tháng');

// Thẻ không có due_day và không có grace -> mặc định sDay + 15
const ccDefault = cardCycle({ statement_day: 10 }, '2026-08-13');
assert.equal(ccDefault.due, '2026-08-25');

// Overdue check
const ccOverdue = cardCycle({ statement_day: 1, due_day: 10 }, '2026-08-15');
assert.equal(ccOverdue.overdue, true, 'hôm nay 15 đã qua hạn ngày 10');

const cardTxs = [
  { occurred_at: '2026-07-06', type: 'expense', amount: 100000, source_card_id: 'card-1' },
  { occurred_at: '2026-08-05', type: 'expense', amount: 200000, source_card_id: 'card-1' },
  { occurred_at: '2026-08-06', type: 'expense', amount: 400000, source_card_id: 'card-1' },
  { occurred_at: '2026-08-10', type: 'expense', amount: 50000, excluded: true,
    card_id: 'card-1', card_period: '2026-08' },
  { occurred_at: '2026-08-11', type: 'expense', amount: 999999, excluded: true, source_card_id: 'card-1' }, // trả gốc hoặc giao dịch excluded không tính vào purchases
];
const statement = cardStatementSummary({ id: 'card-1', statement_day: 5, due_day: 25 }, cardTxs, '2026-08-13');
assert.equal(statement.previousStatement, '2026-07-05');
assert.equal(statement.statementTotal, 300000, 'sao kê chỉ lấy giao dịch sau chốt trước đến hết ngày chốt này');
assert.equal(statement.paid, 50000);
assert.equal(statement.outstanding, 250000);
assert.equal(cardBalance('card-1', cardTxs), 650000, 'dư nợ chạy gồm cả giao dịch sau ngày chốt, trừ payment');
assert.equal(cardBalance('card-none', cardTxs), 0, 'thẻ chưa từng chi tiêu dư nợ 0đ');

// Trả thừa sao kê -> outstanding = 0, không âm
const cardTxsOverpaid = [
  { occurred_at: '2026-08-02', type: 'expense', amount: 100000, source_card_id: 'card-2' },
  { occurred_at: '2026-08-10', type: 'expense', amount: 200000, excluded: true, card_id: 'card-2', card_period: '2026-08' },
];
assert.equal(cardStatementSummary({ id: 'card-2', statement_day: 5, due_day: 25 }, cardTxsOverpaid, '2026-08-13').outstanding, 0);

// floatInterest
assert.equal(floatInterest(100_000_000, 30, 6), Math.round(100_000_000 * 0.06 * (30 / 365)));
assert.equal(floatInterest(0, 30, 6), 0);
assert.equal(floatInterest(100_000_000, 0, 6), 0);
assert.equal(floatInterest(100_000_000, 30, 0), 0);
assert.equal(floatInterest(null, 30, 6), 0);
console.log('card statement and float check: OK');

/* ── 8. nextAnnualFee ──────────────────────────────────────── */
assert.equal(nextAnnualFee(null, '2026-08-15'), null, 'không khai ngày thu → không nhắc');
assert.equal(nextAnnualFee('2020-09-12', null), null);
const feeLater = nextAnnualFee('2020-09-12', '2026-08-15');
assert.equal(feeLater.date, '2026-09-12', 'năm cũ trong DB không dùng, luôn tính lại theo hôm nay');
assert.equal(feeLater.days, 28);
const feeRolled = nextAnnualFee('2020-03-10', '2026-08-15');
assert.equal(feeRolled.date, '2027-03-10', 'qua ngày thu năm nay → nhảy sang năm sau');
assert.equal(nextAnnualFee('2026-08-15', '2026-08-15').days, 0, 'thu đúng hôm nay');
assert.equal(nextAnnualFee('2027-01-05', '2026-08-15').date, '2027-01-05', 'ngày thu đầu tiên nằm ở tương lai');
assert.equal(nextAnnualFee('2024-02-29', '2026-08-15').date, '2027-02-28', '29/2 ở năm thường lùi về 28/2');
console.log('nextAnnualFee check: OK');

/* ── 9. loanSchedule: interest vs amort ────────────────────── */
const li = loanSchedule({ kind: 'interest', principal: 100000000, rate: 12, term: 12, due_at: '2027-08-01', done: 2 });
assert.equal(li.monthlyInterest, 1000000, 'lãi tháng = P*12%/12');
assert.equal(li.principalDue, 100000000);
assert.deepEqual(li.progress, { done: 2, total: 12 });

const la = loanSchedule({ kind: 'amort', principal: 12000000, rate: 0, term: 12, done: 6 });
assert.equal(la.monthlyPayment, 1000000, 'rate 0 → chia đều');
assert.equal(la.principalRemaining, 6000000, 'đã trả 6 kỳ còn lại 6 triệu');
assert.deepEqual(la.progress, { done: 6, total: 12 });

const laDone = loanSchedule({ kind: 'amort', principal: 12000000, rate: 0, term: 12, done: 12 });
assert.equal(laDone.principalRemaining, 0, 'đã trả hết term thì dư nợ gốc = 0');

const la2 = loanSchedule({ kind: 'amort', principal: 100000000, rate: 12, term: 24, done: 0 });
assert.ok(la2.monthlyPayment > 4700000 && la2.monthlyPayment < 4720000, 'annuity ~4.707tr');
assert.equal(la2.interestPart + la2.principalPart, la2.monthlyPayment, 'mỗi kỳ tách đúng lãi + gốc');
assert.ok(la2.interestPart > 0 && la2.principalPart > 0);

// Kiểm tra kỳ tiếp theo của amort có interestPart giảm dần và principalPart tăng dần
const la2AfterDone = loanSchedule({ kind: 'amort', principal: 100000000, rate: 12, term: 24, done: 5 });
assert.ok(la2AfterDone.principalRemaining < 100000000);
assert.ok(la2AfterDone.interestPart < la2.interestPart, 'dư nợ giảm thì lãi phải trả kỳ này giảm');
assert.ok(la2AfterDone.principalPart > la2.principalPart, 'phần trả gốc tăng tương ứng');
console.log('loanSchedule check: OK');

/* ── 10. billAmountEstimate: fixed vs ask ──────────────────── */
assert.equal(billAmountEstimate({ id: 'bill-fixed', amount_mode: 'fixed', amount: 260000 }, []), 260000);
assert.equal(billAmountEstimate({ id: 'bill-fixed', amount_mode: 'fixed' }, []), 0, 'thiếu amount thì 0đ');
assert.equal(billAmountEstimate({ id: 'bill-ask', amount_mode: 'ask' }, []), 0, 'chưa có tx nào thì 0đ');
assert.equal(billAmountEstimate({ id: 'bill-ask', amount_mode: 'ask' }, [
  { bill_id: 'bill-ask', occurred_at: '2026-08-01', amount: 180000 },
]), 180000, '1 kỳ thì lấy đúng kỳ đó');
assert.equal(billAmountEstimate({ id: 'bill-ask', amount_mode: 'ask' }, [
  { bill_id: 'bill-ask', occurred_at: '2026-08-01', amount: 180000 },
  { bill_id: 'bill-ask', occurred_at: '2026-07-01', amount: 150000 },
  { bill_id: 'bill-ask', occurred_at: '2026-06-01', amount: 120000 },
  { bill_id: 'bill-ask', occurred_at: '2026-05-01', amount: 999999 },
]), 150000, 'hóa đơn biến đổi chỉ lấy trung bình 3 kỳ gần nhất');
console.log('billAmountEstimate check: OK');

/* ── 11. fundBalance & blendedRate ─────────────────────────── */
const fb = fundBalance([{ amount: 100000000, rate: 6 }, { amount: 100000000, rate: 4 }]);
assert.equal(fb.total, 200000000);
assert.equal(fb.weightedRate, 5);
assert.deepEqual(fundBalance([]), { total: 0, weightedRate: 0 });
assert.equal(blendedRate([{ amount: 100000000, rate: 7 }, { amount: 100000000, rate: 5 }]), 6);
assert.equal(blendedRate([]), 0);
console.log('fundBalance check: OK');

/* ── 12. spendingRhythm: đơn vị ngày vs tháng ──────────────── */
const rDay = spendingRhythm([
  { occurred_at: '2026-08-01', type: 'expense', amount: 100000 },
  { occurred_at: '2026-08-03', type: 'expense', amount: 300000 },
  { occurred_at: '2026-08-02', type: 'expense', amount: 999999, excluded: true }, // excluded không vào
], { from: '2026-08-01', to: '2026-08-03', unit: 'day' });
assert.equal(rDay.rows.length, 3, '3 ngày liên tục kể cả ngày 0đ');
assert.equal(rDay.rows[1].amount, 0, 'ngày 02/08 không có chi tiêu hợp lệ nên 0đ');
assert.equal(rDay.avg, 133333, 'trung bình tính trên mọi ngày trong kỳ, kể cả ngày 0đ');

const rMonth = spendingRhythm([
  { occurred_at: '2026-01-15', type: 'expense', amount: 100000 },
  { occurred_at: '2026-03-15', type: 'expense', amount: 100000 },
], { from: '2026-01-01', to: '2026-03-31', unit: 'month' });
assert.equal(rMonth.rows.length, 3, 'Jan/Feb/Mar');
assert.equal(rMonth.rows[1].amount, 0, 'Tháng 2 = 0đ');

const rSaving = spendingRhythm([
  { occurred_at: '2026-08-01', type: 'saving', amount: 50000, saving_dir: 'in' },
  { occurred_at: '2026-08-01', type: 'saving', amount: 90000, saving_dir: 'out' }, // rút quỹ không tính
], { from: '2026-08-01', to: '2026-08-01', unit: 'day' }, { savingAsExpense: true });
assert.equal(rSaving.rows[0].amount, 50000);
console.log('spendingRhythm check: OK');

/* ── 13. listPeriodOptions & periodFromKey ─────────────────── */
const opts = listPeriodOptions('2026-08-13');
assert.equal(opts.length, 15, '12 tháng + 2 năm + tất cả');
assert.equal(opts[0].from, '2026-08-01', 'tháng hiện tại đứng đầu');
assert.equal(opts[11].from, '2025-09-01', 'đủ 12 tháng lùi liên tục qua năm trước');
assert.equal(currentMonthPeriod('2026-08-13').from, '2026-08-01');
assert.deepEqual(periodFromKey('2024-02', '2026-08-13'), {
  key: '2024-02', label: 'Tháng 2/2024', from: '2024-02-01', to: '2024-02-29', unit: 'day',
}, 'picker phải mở được tháng bất kỳ, kể cả năm nhuận');
assert.equal(periodFromKey('year-2023', '2026-08-13').to, '2023-12-31');
assert.equal(periodFromKey('key-hỏng', '2026-08-13').key, '2026-08', 'khóa hỏng fallback tháng hiện tại');

assert.equal(listPeriodOptions('2026-08-13', '2025-01-01').at(-1).from, '2025-01-01',
  '"Tất cả" phải bắt đầu từ mốc cửa sổ đã fetch');
assert.equal(periodFromKey('all', '2026-08-13', '2025-01-01').from, '2025-01-01');
assert.equal(listPeriodOptions('2026-08-13').at(-1).from, '2000-01-01',
  'không truyền mốc thì giữ hành vi cũ');
assert.ok(listPeriodOptions('2026-08-13').find(o => o.key === 'year-2025').from >= '2025-01-01');
console.log('listPeriodOptions check: OK');

/* ── 14. Phụ trợ: maturityWarn, groupByDate ─────────────────── */
assert.equal(maturityWarn(null, '2026-08-13'), null);
assert.equal(maturityWarn('2026-09-01', '2026-08-13').warn, true, '≤45 ngày → cảnh báo');
assert.equal(maturityWarn('2026-09-27', '2026-08-13').warn, true, 'đúng 45 ngày → cảnh báo');
assert.equal(maturityWarn('2026-09-28', '2026-08-13').warn, false, '46 ngày → không cảnh báo');
assert.equal(maturityWarn('2026-08-10', '2026-08-13').warn, false, 'đã quá hạn (ngày âm) → không cảnh báo');
assert.equal(maturityWarn('2027-01-01', '2026-08-13').warn, false);

assert.deepEqual(groupByDate([]), []);
const grouped = groupByDate([
  { id: 1, occurred_at: '2026-08-01' },
  { id: 2, occurred_at: '2026-08-03' },
  { id: 3, occurred_at: '2026-08-01' },
]);
assert.equal(grouped.length, 2);
assert.equal(grouped[0].date, '2026-08-03', 'mới nhất trước');
assert.equal(grouped[0].items.length, 1);
assert.equal(grouped[1].date, '2026-08-01');
assert.equal(grouped[1].items.length, 2);
console.log('misc check: OK');

/* ── 15. Ngày đến hạn: dueDateInMonth, daysUntilDue, nextDueDate */
assert.equal(dueDateInMonth(31, '2026-02-10'), '2026-02-28', 'tháng 2 thường → 28');
assert.equal(dueDateInMonth(31, '2024-02-10'), '2024-02-29', 'năm nhuận → 29');
assert.equal(dueDateInMonth(31, '2026-04-10'), '2026-04-30', 'tháng 30 ngày → 30');
assert.equal(dueDateInMonth(5, '2026-08-13'), '2026-08-05');
assert.equal(dueDateInMonth(null, '2026-08-13'), null, 'không có ngày trả thì không có hạn');
assert.equal(dueDateInMonth(5, null), null);

assert.equal(daysUntilDue(31, '2026-02-10'), 18, 'còn 18 ngày tới 28/02');
assert.equal(daysUntilDue(13, '2026-08-13'), 0, 'đúng ngày → 0');
assert.equal(daysUntilDue(5, '2026-08-13'), -8, 'quá hạn 8 ngày → âm');
assert.equal(daysUntilDue(null, '2026-08-13'), null);

assert.equal(nextDueDate(5, '2026-08-13'), '2026-09-05', 'qua ngày 5 rồi → kỳ tháng sau');
assert.equal(nextDueDate(15, '2026-08-13'), '2026-08-15', 'chưa tới thì vẫn ở tháng này');
assert.equal(nextDueDate(13, '2026-08-13'), '2026-08-13', 'đúng hôm nay vẫn là kỳ này');
assert.equal(nextDueDate(31, '2026-01-31'), '2026-01-31');
assert.equal(nextDueDate(31, '2026-02-01'), '2026-02-28', 'nhảy sang tháng 2 phải kẹp về 28');
assert.equal(nextDueDate(null, '2026-08-13'), null);
console.log('dueDateInMonth/daysUntilDue check: OK');

/* ── 16. billCycle: hóa đơn nhiều tháng một lần ────────────── */
assert.deepEqual(billCycle({ due_day: 15 }, '2026-08-13'),
  { period: '2026-08', due: '2026-08-15', days: 2, thisMonth: true });
assert.equal(billCycle({ due_day: 5 }, '2026-08-13').days, -8, 'quá hạn vẫn âm để màn Hóa đơn tô đỏ');
assert.equal(billCycle({ due_day: null }, '2026-08-13'), null);

const q = { due_day: 5, anchor_date: '2026-08-01', rrule: { type: 'monthly', day: 5, every: 3 } };
assert.equal(billCycle(q, '2026-08-13').thisMonth, true, 'đúng tháng mốc → là kỳ');
assert.equal(billCycle(q, '2026-08-13').days, -8, 'kỳ này quá hạn vẫn báo quá hạn');
const skipMonth = billCycle(q, '2026-09-13');
assert.equal(skipMonth.thisMonth, false, 'tháng 9 không phải kỳ của chu kỳ 3 tháng');
assert.equal(skipMonth.due, '2026-11-05', 'nhảy thẳng tới kỳ kế, không phải tháng sau');
assert.equal(billCycle(q, '2026-11-01').thisMonth, true, 'tháng 11 = mốc + 3 tháng');

assert.equal(billCycle({ due_day: 20, anchor_date: '2026-10-20', rrule: { every: 3 } }, '2026-08-13').due,
  '2026-10-20', 'ngày bắt đầu nằm ở tương lai');
assert.equal(billCycle({ due_day: 31, anchor_date: '2026-08-01', rrule: { every: 3 } }, '2026-09-13').due,
  '2026-11-30', 'ngày cố định thắng ngày bắt đầu');
assert.equal(billCycle({ due_day: 10, anchor_date: '2026-03-10', rrule: { every: 12 } }, '2026-08-13').due,
  '2027-03-10', 'theo năm');
assert.equal(billCycle({ due_day: 5, rrule: { every: 3 } }, '2026-08-13').thisMonth, true, 'thiếu anchor coi như hằng tháng');

const missed = billCycle(q, '2026-09-13', () => false);
assert.equal(missed.period, '2026-08', 'kỳ tháng 8 chưa trả → vẫn là kỳ đang tính');
assert.ok(missed.days < 0, 'và phải báo quá hạn');
assert.equal(missed.thisMonth, false);
assert.equal(billCycle(q, '2026-09-13', p => p === '2026-08').period, '2026-11',
  'kỳ cũ xong rồi mới nhảy tới kỳ kế');
assert.equal(billCycle(q, '2026-09-13').period, '2026-11',
  'không truyền isSettled thì giữ nguyên hành vi cũ');

assert.equal(billCycle({ due_day: 20, anchor_date: '2026-10-20', rrule: { every: 3 } }, '2026-08-13', () => false).due,
  '2026-10-20');

const settled = billSettled({ id: 'b1', skipped_periods: ['2026-05'] },
  [{ bill_id: 'b1', bill_period: '2026-08' }, { bill_id: 'b2', bill_period: '2026-11' }]);
assert.equal(settled('2026-08'), true, 'đã ghi giao dịch');
assert.equal(settled('2026-05'), true, 'đã bỏ kỳ');
assert.equal(settled('2026-11'), false, 'giao dịch của hóa đơn khác không tính');
console.log('billCycle check: OK');

/* ── 17. billPeriods: danh sách các kỳ lùi ──────────────────── */
assert.deepEqual(
  billPeriods({ rrule: { every: 1 } }, '2026-08', 4),
  ['2026-08', '2026-07', '2026-06', '2026-05'],
  'hóa đơn tháng lùi đều 1 tháng'
);
assert.deepEqual(
  billPeriods({ rrule: { every: 3 } }, '2026-10', 3),
  ['2026-10', '2026-07', '2026-04'],
  'hóa đơn quý lùi đúng 3 tháng một bước'
);
assert.deepEqual(
  billPeriods({ rrule: { every: 12 } }, '2026-08', 2),
  ['2026-08', '2025-08'],
  'hóa đơn năm lùi 12 tháng'
);
assert.deepEqual(
  billPeriods({}, '2026-02', 3),
  ['2026-02', '2026-01', '2025-12'],
  'không khai rrule lùi qua năm mới'
);
assert.equal(billPeriods({ rrule: { every: 1 } }, '2026-08').length, 6, 'mặc định count = 6');
console.log('billPeriods check: OK');

/* ── 18. billPeriodForDate: ngày trả rơi vào kỳ nào ─────────── */
const netflix = { due_day: 25, anchor_date: '2026-07-25', rrule: { type: 'monthly', day: 25, every: 3 } };
assert.equal(billPeriodForDate(netflix, '2026-07-25'), '2026-07', 'trả đúng ngày mốc');
assert.equal(billPeriodForDate(netflix, '2026-08-02'), '2026-07', 'trả muộn 8 ngày vẫn là kỳ vừa rồi');
assert.equal(billPeriodForDate(netflix, '2026-10-20'), '2026-10', 'trả sớm 5 ngày là kỳ sắp tới');
assert.equal(billPeriodForDate(netflix, '2026-09-01'), '2026-07',
  'giữa hai kỳ mà gần kỳ cũ hơn → kỳ cũ, không nhảy sang kỳ chưa tới');

const monthly = { due_day: 28 };
assert.equal(billPeriodForDate(monthly, '2026-08-02'), '2026-07', 'hạn 28/07, trả 02/08 → kỳ 07');
assert.equal(billPeriodForDate(monthly, '2026-08-26'), '2026-08', 'trả sớm 2 ngày → kỳ 08');
assert.equal(billPeriodForDate({ due_day: 5 }, '2026-08-02'), '2026-08',
  'hạn ngày 5, trả ngày 2 là trả sớm cho kỳ này');
assert.equal(billPeriodForDate({ due_day: null }, '2026-08-02'), null);
assert.equal(billPeriodForDate(monthly, null), null);
console.log('billPeriodForDate check: OK');

/* ── 19. lendingInterest: lãi cho vay theo ngày ─────────────── */
const lend = { principal: 100_000_000, rate: 12, lent_on: '2026-01-01', due_on: '2026-07-01' };

assert.deepEqual(
  lendingInterest({ ...lend, rate: 0 }, [], '2026-03-01'),
  { rate: 0, balance: 100_000_000, to: '2026-07-01', days: 181,
    earned: 0, expected: 0, forfeited: 0, dueNow: 0, total: 100_000_000 },
  'không lãi thì tổng sẽ nhận đúng bằng gốc'
);

const plain = lendingInterest(lend, [], '2026-03-01');
assert.equal(plain.days, 181, '01/01 → 01/07 là 181 ngày');
assert.equal(plain.expected, 5_950_685, '100tr · 12%/năm · 181 ngày');
assert.equal(plain.total, 105_950_685, 'tổng sẽ nhận = gốc + lãi tới hẹn');
assert.equal(plain.earned, 1_939_726, 'tới 01/03 mới phát sinh 59 ngày lãi');
assert.ok(plain.earned < plain.expected, 'chưa tới hẹn thì lãi đã phát sinh phải nhỏ hơn lãi tới hẹn');

assert.ok(lendingInterest({ ...lend, due_on: '2026-12-31' }, [], '2026-03-01').expected > plain.expected,
  'hẹn xa hơn → lãi tới hẹn nhiều hơn');

// Trả 50tr ngày 01/04: từ hôm đó lãi chỉ chạy trên 50tr còn lại
const partial = lendingInterest(lend, [{ occurred_at: '2026-04-01', amount: 50_000_000 }], '2026-05-01');
assert.equal(partial.balance, 50_000_000);
assert.equal(partial.expected, 4_454_795, '90 ngày trên 100tr + 91 ngày trên 50tr');
assert.ok(partial.expected < plain.expected, 'trả bớt gốc thì lãi tới hẹn giảm');

// Trả hết gốc -> balance = 0
const fullyPaid = lendingInterest(lend, [{ occurred_at: '2026-04-01', amount: 100_000_000 }], '2026-07-01');
assert.equal(fullyPaid.balance, 0);

// Quá hẹn: lãi vẫn chạy tới hôm nay
const late = lendingInterest({ ...lend, due_on: '2026-02-01' }, [], '2026-03-01');
assert.equal(late.to, '2026-03-01');
assert.equal(late.earned, late.expected, 'quá hẹn thì lãi đã phát sinh chính là lãi phải nhận');

assert.equal(lendingInterest({ ...lend, due_on: null }, [], '2026-03-01').to, '2026-03-01');

const backwards = lendingInterest(lend, [{ occurred_at: '2025-12-01', amount: 50_000_000 }], '2026-01-01');
assert.equal(backwards.earned, 0);
assert.equal(backwards.balance, 50_000_000);

/* Cục lãi mất do rút tiết kiệm trước hạn */
const broke = { principal: 100_000_000, rate: 9, lent_on: '2026-08-17',
  due_on: '2026-09-16', forfeited_interest: 3_772_603 };
const b = lendingInterest(broke, [], '2026-08-17');
assert.equal(b.forfeited, 3_772_603);
assert.equal(b.expected, 739_726, 'lãi 30 ngày cho vay vẫn tính riêng theo rate');
assert.equal(b.total, 104_512_329, 'tổng = gốc + lãi kỳ vay + cục lãi mất');
assert.equal(b.dueNow, b.earned + b.forfeited, 'tất toán hôm nay: lãi tới hôm nay + cả cục');
assert.equal(lendingInterest({ ...broke, due_on: '2026-12-16' }, [], '2026-08-17').forfeited, 3_772_603);
assert.equal(lendingInterest(lend, [], '2026-03-01').forfeited, 0, 'không khai thì bằng 0');
console.log('lendingInterest check: OK');

/* ── 20. forfeitedInterest: số điền sẵn khi đập sổ ─────────── */
const deposit = { amount: 100_000_000, rate: 9, opened_at: '2026-03-17' };
assert.equal(forfeitedInterest(deposit, '2026-08-17'), 3_772_603, 'gửi 153 ngày ở 9%/năm');
assert.equal(forfeitedInterest(deposit, '2026-03-17'), 0, 'rút ngay ngày gửi thì chưa mất gì');
assert.equal(forfeitedInterest(deposit, '2026-03-01'), 0, 'ngày rút trước ngày gửi không ra số âm');
assert.equal(forfeitedInterest({ ...deposit, opened_at: null }, '2026-08-17'), 0,
  'sổ không khai ngày gửi thì app không đoán');
assert.equal(forfeitedInterest({ ...deposit, rate: 0 }, '2026-08-17'), 0);
assert.equal(forfeitedInterest(null, '2026-08-17'), 0);
assert.equal(forfeitedInterest(deposit, null), 0);
console.log('forfeitedInterest check: OK');

console.log('\n✅ financeLogic — tất cả self-check PASS (100% functions & rules covered)');

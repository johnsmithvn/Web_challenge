import assert from 'node:assert/strict';
import {
  buildHubItems,
  weekBounds,
  groupHubItems,
  hubTotals,
  calendarDays,
  shortMoney,
  periodHistory,
} from '../../utils/recurringHub.js';

// ── 1. Test weekBounds ────────────────────────────────────────────────────────
// 1.1 Thứ 7: 2026-10-10 -> tuần này hết 2026-10-11, tuần sau 12-18
const wb1 = weekBounds('2026-10-10');
assert.equal(wb1.thisWeekEnd, '2026-10-11');
assert.equal(wb1.nextWeekStart, '2026-10-12');
assert.equal(wb1.nextWeekEnd, '2026-10-18');
assert.equal(wb1.monthEnd, '2026-10-31');

// 1.2 CN: 2026-10-11 -> tuần này chỉ còn hôm nay (2026-10-11)
const wb2 = weekBounds('2026-10-11');
assert.equal(wb2.thisWeekEnd, '2026-10-11');
assert.equal(wb2.nextWeekStart, '2026-10-12');
assert.equal(wb2.nextWeekEnd, '2026-10-18');

// 1.3 Thứ 4 cuối tháng: 2026-10-28 -> tuần này bị cắt về 2026-10-31, tuần sau rỗng (null)
const wb3 = weekBounds('2026-10-28');
assert.equal(wb3.thisWeekEnd, '2026-10-31');
assert.equal(wb3.nextWeekStart, null);
assert.equal(wb3.nextWeekEnd, null);

// ── 2. Test calendarDays ──────────────────────────────────────────────────────
// Tháng 2 năm thường (2025): 28 ngày; due_day: 31 rơi về ngày 28
const febItems = [
  {
    id: 'b1',
    kind: 'bill',
    name: 'Điện',
    ev: { day: 28, due: '2025-02-28', amount: 500000, state: 'due' },
  },
];
const daysFeb = calendarDays(febItems, '2025-02-15');
assert.equal(daysFeb.length, 28);
const day28 = daysFeb.find(d => d.day === 28);
assert.ok(day28, 'Phải có ngày 28 trong tháng 2');
assert.equal(day28.chips.length, 1);
assert.equal(day28.chips[0].id, 'b1');

// ── 3. Test buildHubItems & groupHubItems ─────────────────────────────────────
const mockFin = {
  today: '2026-10-10',
  bills: [
    // Hóa đơn quý không tới lượt tháng 10 (bắt đầu từ tháng 9, chu kỳ 3 tháng: 09/26 -> kỳ kế 12/26)
    {
      id: 'b_quarter_future',
      name: 'Bảo hiểm xe',
      enabled: true,
      amount: 1200000,
      due_day: 15,
      anchor_date: '2026-09-15',
      rrule: { every: 3 },
    },
    // Hóa đơn quý lỡ từ tháng 7 (anchor_date 2026-07-05, chu kỳ 3 tháng, ngày 5 < ngày 10) -> overdue: true
    {
      id: 'b_quarter_late',
      name: 'Nước lọc quý',
      enabled: true,
      amount: 300000,
      due_day: 5,
      anchor_date: '2026-07-05',
      rrule: { every: 3 },
    },
    // Hóa đơn tháng 10 nhưng đã bỏ kỳ
    {
      id: 'b_skipped',
      name: 'Netflix',
      enabled: true,
      amount: 260000,
      due_day: 5,
      skipped_periods: ['2026-10'],
    },
    // Hóa đơn enabled: false -> không có trong items
    {
      id: 'b_disabled',
      name: 'Gym cũ',
      enabled: false,
      amount: 500000,
      due_day: 1,
    },
    // Hóa đơn finished_at -> không có trong items
    {
      id: 'b_finished',
      name: 'Trả góp xong',
      enabled: true,
      finished_at: '2026-09-01',
      amount: 1000000,
      due_day: 10,
    },
    // Hóa đơn đến hạn tuần này (2026-10-11)
    {
      id: 'b_this_week',
      name: 'Internet',
      enabled: true,
      amount: 220000,
      due_day: 11,
    },
  ],
  cards: [
    // Thẻ có sao kê cũ còn nợ (cardCarryOver)
    {
      id: 'c1',
      name: 'VPBank StepUp',
      statement_day: 20,
      due_day: 5,
      credit_limit: 50000000,
    },
  ],
  loans: [],
  goals: [
    // Quỹ không có auto_deposit -> ev = null
    {
      id: 'g_manual',
      name: 'Quỹ khẩn cấp',
      goal: 100000000,
    },
  ],
  lendings: [],
  transactions: [
    // Giao dịch tháng 9 của hóa đơn quý b_quarter_future đã xong -> kỳ kế rơi vào 12/2026
    {
      id: 'tx_b_qf',
      bill_id: 'b_quarter_future',
      bill_period: '2026-09',
      type: 'expense',
      amount: 1200000,
      occurred_at: '2026-09-15',
    },
    // Giao dịch tháng trước của thẻ c1 tạo carry over
    {
      id: 'tx_c1',
      source_card_id: 'c1',
      type: 'expense',
      amount: 2500000,
      occurred_at: '2026-08-15',
    },
    // Giao dịch tháng 7 của hóa đơn quý lỡ -> không có, nên b_quarter_late vẫn nợ
  ],
  deposits: [],
};

const items = buildHubItems(mockFin);

// 3.1 Hóa đơn disabled & finished không có trong items
assert.equal(items.some(i => i.id === 'b_disabled'), false, 'Hóa đơn disabled không được có trong items');
assert.equal(items.some(i => i.id === 'b_finished'), false, 'Hóa đơn finished không được có trong items');

// 3.2 Hóa đơn quý không tới lượt tháng này -> ev = null
const bQuarterFuture = items.find(i => i.id === 'b_quarter_future');
assert.ok(bQuarterFuture);
assert.equal(bQuarterFuture.ev, null, 'Hóa đơn quý chưa tới lượt phải có ev = null');

// 3.3 Hóa đơn quý lỡ từ tháng 7 -> overdue: true
const bQuarterLate = items.find(i => i.id === 'b_quarter_late');
assert.ok(bQuarterLate);
assert.ok(bQuarterLate.ev);
assert.equal(bQuarterLate.overdue, true, 'Hóa đơn quý lỡ từ tháng 7 phải báo overdue: true');
assert.equal(bQuarterLate.ev.state, 'due');

// 3.4 Hóa đơn đã bỏ kỳ -> state 'skip'
const bSkipped = items.find(i => i.id === 'b_skipped');
assert.ok(bSkipped);
assert.ok(bSkipped.ev);
assert.equal(bSkipped.ev.state, 'skip', 'Hóa đơn đã bỏ kỳ phải có state: skip');

// 3.5 Thẻ có cardCarryOver -> amount = outstanding + carry
const card1 = items.find(i => i.id === 'c1');
assert.ok(card1);
assert.ok(card1.ev);
assert.equal(card1.ev.amount, 2500000, 'Số tiền thẻ phải tính cả carry over');

// 3.6 Quỹ không có auto_deposit -> ev = null
const goalManual = items.find(i => i.id === 'g_manual');
assert.ok(goalManual);
assert.equal(goalManual.ev, null, 'Quỹ không có auto_deposit phải có ev = null');

// ── 4. Test groupHubItems ────────────────────────────────────────────────────
const groups = groupHubItems(items, '2026-10-10', 'all');

// Nhóm overdue phải chứa b_quarter_late và c1 (do c1 có carry due vào 05/09 hoặc 05/10 đã qua)
const overdueGrp = groups.find(g => g.key === 'overdue');
assert.ok(overdueGrp, 'Phải có nhóm overdue');
assert.ok(overdueGrp.items.some(i => i.id === 'b_quarter_late'));

// Nhóm done phải chứa b_skipped
const doneGrp = groups.find(g => g.key === 'done');
assert.ok(doneGrp, 'Phải có nhóm done');
assert.ok(doneGrp.items.some(i => i.id === 'b_skipped'));

// Nhóm none phải chứa b_quarter_future và g_manual
const noneGrp = groups.find(g => g.key === 'none');
assert.ok(noneGrp, 'Phải có nhóm none');
assert.ok(noneGrp.items.some(i => i.id === 'b_quarter_future'));
assert.ok(noneGrp.items.some(i => i.id === 'g_manual'));

// Filter 'bill' không trả item kind khác
const billGroups = groupHubItems(items, '2026-10-10', 'bill');
for (const grp of billGroups) {
  for (const it of grp.items) {
    assert.equal(it.kind, 'bill', 'Filter bill không được chứa kind khác');
  }
}

// ── 5. Test hubTotals ────────────────────────────────────────────────────────
const totals = hubTotals(items);
// hubTotals.all.value = tổng amount các item state === 'due'
const expectedDueSum = items
  .filter(i => i.ev && i.ev.state === 'due')
  .reduce((s, i) => s + i.ev.amount, 0);
assert.equal(totals.all.value, expectedDueSum, 'hubTotals.all.value phải bằng tổng amount các item due');

// ── 4. Hồi quy sau review ──────────────────────────────────────────────────────
const regFin = {
  today: '2026-10-10',
  bills: [],
  cards: [
    // Chốt 08/10 → hạn 05/11: còn nợ nhưng hạn nằm tháng sau → không phải "CUỐI THÁNG"
    { id: 'c_next', name: 'VIB', statement_day: 8, due_day: 5, credit_limit: 10000000 },
  ],
  loans: [
    // Chỉ trả lãi, đã đủ 12 kỳ lãi nhưng gốc chưa tất toán → vẫn phải còn trong hub
    { id: 'l_wait', name: 'Thấu chi', kind: 'interest', principal: 400000000, rate: 4.8, term: 12, done: 12, pay_day: 2 },
    // Trả đều đã đủ kỳ → hết nghĩa vụ
    { id: 'l_done', name: 'Vay xe', kind: 'amort', principal: 10000000, rate: 6, term: 12, done: 12, pay_day: 2 },
  ],
  goals: [
    { id: 'g_auto', name: 'Quỹ An Gia', goal: 30000000, auto_deposit: { amount: 2000000, day: 31 } },
  ],
  lendings: [],
  transactions: [
    { id: 'tx_vib', source_card_id: 'c_next', type: 'expense', amount: 500000, occurred_at: '2026-10-01' },
  ],
  deposits: [
    // Nơi gửi gắn quỹ bằng fund_id (cột thật trong finance_deposits)
    { id: 'd1', fund_id: 'g_auto', amount: 3000000 },
  ],
};
const regItems = buildHubItems(regFin);
const vib = regItems.find(i => i.id === 'c_next');
assert.equal(vib.ev.due, '2026-11-05');
const regGroups = groupHubItems(regItems, regFin.today);
assert.ok(regGroups.find(g => g.key === 'none').items.some(i => i.id === 'c_next'), 'hạn tháng sau rơi vào nhóm không có kỳ');
assert.ok(!regGroups.some(g => g.key === 'later' && g.items.some(i => i.id === 'c_next')));
assert.ok(regItems.some(i => i.id === 'l_wait'), 'vay chỉ trả lãi chờ tất toán gốc không được biến mất');
assert.ok(!regItems.some(i => i.id === 'l_done'), 'vay trả đều đủ kỳ là xong');
const gAuto = regItems.find(i => i.id === 'g_auto');
assert.equal(gAuto.progress.pct, 10, 'tiến độ quỹ đọc nơi gửi theo fund_id');
assert.equal(gAuto.ev.day, 31, 'tháng 10 có ngày 31');
assert.equal(buildHubItems({ ...regFin, today: '2026-11-10' }).find(i => i.id === 'g_auto').ev.day, 30,
  'ngày gửi 31 rơi về 30 ở tháng 30 ngày để chip lịch không mất');

// ── 5. Ô KPI theo từng loại, tiến độ dòng, lịch sử 6 kỳ (bản chốt) ────────────
assert.equal(shortMoney(35000000), '35 tr');
assert.equal(shortMoney(128920000), '128,92 tr');
assert.equal(shortMoney(1250000000), '1,25 tỷ');
assert.equal(shortMoney(450000), '450k');

const regTotals = hubTotals(regItems, '2026-10');
// Vay: ô hiện dư nợ gốc (l_wait còn 400tr), không phải "còn phải trả tháng này" = 0đ
assert.equal(regTotals.loan.value, 400000000);
assert.equal(regTotals.save.value, 3000000, 'quỹ: đang gửi');
assert.equal(regTotals.save.cap, '10% mục tiêu 30 tr');
assert.equal(regTotals.all.sub, 'còn phải chi tháng 10');

const lendFin = { ...regFin, cards: [], loans: [], goals: [],
  lendings: [{ id: 'm', name: 'Chị Mai', principal: 10000000, lent_on: '2026-08-01' }],
  transactions: [{ id: 'r1', lending_id: 'm', type: 'income', excluded: true, amount: 4000000, occurred_at: '2026-09-01' }] };
const lendTotals = hubTotals(buildHubItems(lendFin), '2026-10');
assert.equal(lendTotals.lend.value, 6000000, 'cho vay: còn phải thu');
assert.equal(lendTotals.lend.cap, 'đã thu 4 tr / 10 tr');

// Hóa đơn thường: thanh tiến độ = ngày đã trôi trong chu kỳ, vàng khi còn ≤ 6 ngày
const near = items.find(i => i.id === 'b_this_week');   // hạn 11/10, hôm nay 10/10
assert.equal(near.progress.label, '29/30 ngày chu kỳ');
assert.equal(near.progress.tone, 'warn');
assert.equal(items.find(i => i.id === 'b_skipped').progress.label, 'bỏ kỳ này');

const hist = periodHistory({ id: 'b9', kind: 'bill' }, [
  ...['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
    .map((p, i) => ({ id: p, bill_id: 'b9', bill_period: p, amount: (i + 1) * 100000 })),
  { id: 'x', bill_id: 'other', bill_period: '2026-09', amount: 999 },
]);
assert.equal(hist.bars.length, 6, 'chỉ 6 kỳ gần nhất');
assert.equal(hist.bars[0].period, '2026-04');
assert.equal(hist.avg, 450000);
assert.equal(periodHistory({ id: 'c', kind: 'card' }, []), null, 'thẻ không có biểu đồ kỳ');

console.log('recurringHub check: OK');

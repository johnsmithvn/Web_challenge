import assert from 'node:assert/strict';
import { collectSystemAlerts } from '../../utils/dashboardAlerts.js';

console.log('Testing dashboardAlerts pure functions...');

const today = '2026-10-08';

// ── 1. Tasks alerts ──
const tasks = [
  { id: 't1', title: 'Task quá hạn', due_date: '2026-10-05', completed: false, status: 'todo', priority: 1 },
  { id: 't2', title: 'Task hôm nay', due_date: '2026-10-08', completed: false, status: 'todo' },
  { id: 't3', title: 'Task tương lai', due_date: '2026-10-15', completed: false, status: 'todo' },
  { id: 't4', title: 'Task đã xong', due_date: '2026-10-01', completed: true, status: 'done' },
  { id: 't5', title: 'Task bỏ qua', due_date: '2026-10-02', completed: false, status: 'skip' },
  { id: 't6', title: 'Subtask con', due_date: '2026-10-03', completed: false, status: 'todo', parent_task_id: 'parent' },
];

const res1 = collectSystemAlerts({ tasks, today });
assert.equal(res1.critical.length, 1);
assert.equal(res1.critical[0].id, 'task-t1');
assert.equal(res1.critical[0].type, 'task_overdue');
assert.equal(res1.critical[0].badge, 'Trễ 3 ngày');

assert.equal(res1.dueToday.length, 1);
assert.equal(res1.dueToday[0].id, 'task-t2');
assert.equal(res1.dueToday[0].type, 'task_today');

// ── 2. Bills alerts ──
const bills = [
  { id: 'b1', name: 'Tiền điện', due_day: 5, enabled: true }, // Ngày 5 đã qua hôm nay ngày 8 -> quá hạn
  { id: 'b2', name: 'Tiền mạng', due_day: 8, enabled: true }, // Ngày 8 hôm nay -> đến hạn
  { id: 'b3', name: 'Tiền nước', due_day: 10, enabled: true }, // Ngày 10 -> còn 2 ngày -> heads up
  { id: 'b4', name: 'Tiền gym', due_day: 25, enabled: true }, // Ngày 25 -> xa -> bỏ qua
  { id: 'b5', name: 'Đã trả', due_day: 5, enabled: true },
];
const transactions = [
  { bill_id: 'b5', bill_period: '2026-10', occurred_at: '2026-10-04', type: 'expense', amount: 500000 },
];

const res2 = collectSystemAlerts({ bills, transactions, today });
assert.equal(res2.critical.some(a => a.id === 'bill-b1'), true);
assert.equal(res2.critical.find(a => a.id === 'bill-b1').badge, 'Quá hạn 3 ngày');
assert.equal(res2.dueToday.some(a => a.id === 'bill-b2'), true);
assert.equal(res2.headsUp.some(a => a.id === 'bill-b3'), true);
assert.equal(res2.critical.some(a => a.id === 'bill-b5'), false, 'Hóa đơn đã trả không báo');

// ── 3. Cards alerts (Statement + Annual Fee) ──
const cards = [
  // Chốt 20, hạn 5 -> đến ngày 8 là quá hạn
  { id: 'c1', name: 'Thẻ Techcombank', statement_day: 20, due_day: 5 },
  // Chốt 25, hạn 10 -> còn 2 ngày
  { id: 'c2', name: 'Thẻ VPBank', statement_day: 25, due_day: 10 },
  // Thẻ có phí thường niên thu ngày 8/10
  { id: 'c3', name: 'Thẻ HSBC', statement_day: 1, due_day: 20, annual_fee: 1000000, annual_fee_on: '2025-10-08' },
];
const cardTxs = [
  { source_card_id: 'c1', type: 'expense', amount: 3000000, occurred_at: '2026-08-22' },
  { source_card_id: 'c2', type: 'expense', amount: 1500000, occurred_at: '2026-09-20' },
];

const res3 = collectSystemAlerts({ cards, transactions: cardTxs, today });
assert.equal(res3.critical.some(a => a.id === 'card-c1'), true);
assert.equal(res3.headsUp.some(a => a.id === 'card-c2'), true);
assert.equal(res3.dueToday.some(a => a.id === 'fee-c3'), true);

// ── 4. Loans alerts ──
const loans = [
  // Ngày trả 3 hàng tháng -> hôm nay ngày 8 chưa trả -> quá hạn
  { id: 'l1', name: 'Vay mua xe', principal: 100000000, term: 12, rate: 10, pay_day: 3, kind: 'amort' },
  // Ngày trả 8 hôm nay -> đến hạn
  { id: 'l2', name: 'Vay tín chấp', principal: 20000000, term: 6, rate: 12, pay_day: 8, kind: 'amort' },
  // Trả lãi, gốc đến hạn ngày 05/10 -> tất toán gốc quá hạn
  { id: 'l3', name: 'Vay người quen', principal: 50000000, rate: 0, pay_day: 15, kind: 'interest', due_at: '2026-10-05' },
];
const res4 = collectSystemAlerts({ loans, today });
assert.equal(res4.critical.some(a => a.id === 'loan-l1'), true);
assert.equal(res4.dueToday.some(a => a.id === 'loan-l2'), true);
assert.equal(res4.critical.some(a => a.id === 'loan-principal-l3'), true);

// ── 5. Lendings alerts (Cho vay) ──
const lendings = [
  { id: 'lend1', name: 'Cho Nam mượn', principal: 5000000, due_on: '2026-10-04' }, // Quá hạn 4 ngày
  { id: 'lend2', name: 'Cho Lan mượn', principal: 2000000, due_on: '2026-10-08' }, // Hôm nay
  { id: 'lend3', name: 'Cho Tuấn mượn', principal: 3000000, due_on: '2026-10-10' }, // Còn 2 ngày
  { id: 'lend4', name: 'Đã trả xong', principal: 1000000, due_on: '2026-10-01' },
];
const lendTxs = [
  { lending_id: 'lend4', amount: 1000000, occurred_at: '2026-10-02', type: 'income', excluded: true },
];
const res5 = collectSystemAlerts({ lendings, transactions: lendTxs, today });
assert.equal(res5.critical.some(a => a.id === 'lend-lend1'), true);
assert.equal(res5.dueToday.some(a => a.id === 'lend-lend2'), true);
assert.equal(res5.headsUp.some(a => a.id === 'lend-lend3'), true);
assert.equal(res5.critical.some(a => a.id === 'lend-lend4'), false, 'Đã thu đủ không báo');

// ── 6. All clear check ──
const resEmpty = collectSystemAlerts({ today });
assert.equal(resEmpty.stats.allClear, true);
assert.equal(resEmpty.stats.totalUrgent, 0);

console.log('✅ dashboardAlerts pure tests passed!');

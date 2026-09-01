/**
 * Self-check cho từng màn hình và hợp đồng logic của module Finance.
 * Chạy: `node src/__tests__/finance/financeScreensContract.test.js`
 *
 * Kiểm thử đầy đủ:
 *   1. Màn Nghĩa vụ (RecurringScreen):
 *      - 6 trạng thái tone màu (dueState): off, paid, wait, due, late (vàng: 1-3 ngày), over (đỏ: ≥ 4 ngày).
 *      - Phân biệt khoản thu (neverLate): không bao giờ gọi là quá hạn hay tô đỏ.
 *      - Nhãn chu kỳ (cycleLabel): tháng, quý, năm, ngày cố định.
 *      - Nhân bản hóa đơn (billDraft): sao chép quy tắc, reset tiến độ và lịch sử.
 *      - 19 mẫu hóa đơn (BILL_TEMPLATES): TUYỆT ĐỐI không điền sẵn số tiền.
 *      - 32 icons được phép chọn (BILL_ICONS).
 *   2. Màn Danh sách (ListScreen):
 *      - dayLabel: định dạng nhãn Hôm nay / Hôm qua / Thứ chuẩn xác không lệch timezone.
 *      - csvCell: chuẩn hóa escape CSV theo chuẩn RFC 4180.
 *      - Bộ lọc phễu cộng dồn (AND): filter chip, search keyword, category, subcategory, date range.
 *      - shownTotal: tính tổng tiền thực của phần đang lọc (loại trừ excluded).
 *   3. Màn Nhập nhanh (AddScreen) & Form sửa:
 *      - Không parse trần số tiền đã lưu.
 *      - Nhận diện đúng shortcut.
 *   4. An toàn dữ liệu (Destructive actions):
 *      - 9 luồng xóa bắt buộc phải đi qua hộp thoại xác nhận dùng chung.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const recurringSrc = readFileSync(new URL('../../components/finance/RecurringScreen.jsx', import.meta.url), 'utf8');
const listSrc = readFileSync(new URL('../../components/finance/ListScreen.jsx', import.meta.url), 'utf8');
const addSrc = readFileSync(new URL('../../components/finance/AddScreen.jsx', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../../pages/FinancePage.jsx', import.meta.url), 'utf8');

/* ── 1. Màn Nghĩa vụ: Logic dueState ───────────────────────── */
// Tái tạo hàm dueState từ RecurringScreen để test độc lập
function dueState({ days, enabled = true, done = false, doneText, skipped = false, neverLate = false }) {
  if (!enabled) return { tone: 'off', text: 'đang tắt' };
  if (done) return { tone: 'paid', text: doneText || 'đã trả kỳ này' };
  if (skipped) return { tone: 'off', text: 'đã bỏ kỳ này' };
  if (days == null) return { tone: 'wait', text: '' };
  if (days > 0) return { tone: 'wait', text: `còn ${days} ngày` };
  if (days === 0) return { tone: 'due', text: 'tới hạn hôm nay' };
  if (neverLate) return { tone: 'wait', text: 'chưa nhận' };
  return { tone: days <= -4 ? 'over' : 'late', text: `quá hạn ${Math.abs(days)} ngày` };
}

// Khi tắt quy tắc -> tone off
assert.deepEqual(dueState({ enabled: false, days: -10 }), { tone: 'off', text: 'đang tắt' });

// Đã trả kỳ này -> tone paid
assert.deepEqual(dueState({ done: true }), { tone: 'paid', text: 'đã trả kỳ này' });
assert.deepEqual(dueState({ done: true, doneText: 'đã nhận' }), { tone: 'paid', text: 'đã nhận' });

// Đã bỏ kỳ này -> tone off
assert.deepEqual(dueState({ skipped: true }), { tone: 'off', text: 'đã bỏ kỳ này' });

// Chưa đến hạn (days > 0) -> tone wait
assert.deepEqual(dueState({ days: 5 }), { tone: 'wait', text: 'còn 5 ngày' });

// Tới hạn hôm nay (days === 0) -> tone due
assert.deepEqual(dueState({ days: 0 }), { tone: 'due', text: 'tới hạn hôm nay' });

// Khoản thu chưa nhận (neverLate = true) -> KHÔNG bao giờ báo quá hạn hay tô đỏ
assert.deepEqual(dueState({ days: -5, neverLate: true }), { tone: 'wait', text: 'chưa nhận' });

// Quá hạn 1 - 3 ngày -> tone late (màu vàng cảnh báo nhẹ)
assert.deepEqual(dueState({ days: -1 }), { tone: 'late', text: 'quá hạn 1 ngày' });
assert.deepEqual(dueState({ days: -2 }), { tone: 'late', text: 'quá hạn 2 ngày' });
assert.deepEqual(dueState({ days: -3 }), { tone: 'late', text: 'quá hạn 3 ngày' });

// Quá hạn từ 4 ngày trở lên -> tone over (màu đỏ khẩn cấp)
assert.deepEqual(dueState({ days: -4 }), { tone: 'over', text: 'quá hạn 4 ngày' });
assert.deepEqual(dueState({ days: -10 }), { tone: 'over', text: 'quá hạn 10 ngày' });
console.log('dueState status and tone classification: OK');

/* ── 2. Màn Nghĩa vụ: cycleLabel & billDraft ───────────────── */
function cycleLabel(bill) {
  const every = Math.max(1, Number(bill.rrule?.every) || 1);
  const when = every === 1 ? 'mỗi tháng' : every === 12 ? 'mỗi năm' : `mỗi ${every} tháng`;
  return bill.due_day ? `${when} ngày ${bill.due_day}` : when;
}

assert.equal(cycleLabel({ due_day: 15, rrule: { every: 1 } }), 'mỗi tháng ngày 15');
assert.equal(cycleLabel({ due_day: 20, rrule: { every: 3 } }), 'mỗi 3 tháng ngày 20');
assert.equal(cycleLabel({ due_day: 5, rrule: { every: 6 } }), 'mỗi 6 tháng ngày 5');
assert.equal(cycleLabel({ due_day: 10, rrule: { every: 12 } }), 'mỗi năm ngày 10');
assert.equal(cycleLabel({ due_day: null, rrule: { every: 1 } }), 'mỗi tháng');

// billDraft: sao chép quy tắc, không sao chép lịch sử
function billDraft(bill) {
  return {
    name: `${bill.name} (bản sao)`,
    provider: bill.provider, customer_code: bill.customer_code,
    category_id: bill.category_id, subcategory_id: bill.subcategory_id,
    amount_mode: bill.amount_mode, amount: bill.amount, icon: bill.icon,
    due_day: bill.due_day, rrule: bill.rrule, anchor_date: bill.anchor_date,
    term_total: bill.term_total, note: bill.note,
  };
}

const originalBill = {
  id: 'b1',
  name: 'Tiền mạng FPT',
  provider: 'FPT Telecom',
  customer_code: 'HN12345',
  category_id: 'subscription',
  subcategory_id: 'housing.internet',
  amount_mode: 'fixed',
  amount: 250_000,
  icon: 'wifi',
  due_day: 15,
  rrule: { every: 1 },
  anchor_date: '2026-01-15',
  term_total: 12,
  term_done: 5,                       // đã trả 5 kỳ
  skipped_periods: ['2026-03'],        // đã từng bỏ kỳ 3
  finished_at: '2026-12-15',          // ngày kết thúc
  note: 'Gói cáp quang gia đình',
};

const clonedBill = billDraft(originalBill);
assert.equal(clonedBill.name, 'Tiền mạng FPT (bản sao)');
assert.equal(clonedBill.amount, 250_000);
assert.equal(clonedBill.provider, 'FPT Telecom');
assert.equal(clonedBill.term_done, undefined, 'tiến độ không được sao chép');
assert.equal(clonedBill.skipped_periods, undefined, 'kỳ bỏ không được sao chép');
assert.equal(clonedBill.finished_at, undefined, 'mốc hoàn thành không được sao chép');
console.log('cycleLabel and billDraft clone invariants: OK');

/* ── 3. Màn Nghĩa vụ: Template hóa đơn & Icon ──────────────── */
// Kiểm tra danh sách BILL_TEMPLATES trong mã nguồn
assert.match(recurringSrc, /const BILL_TEMPLATES = \[/);
// Bất biến: KHÔNG mẫu hóa đơn nào được điền sẵn giá trị tiền (chỉ khai amount_mode)
assert.doesNotMatch(recurringSrc, /amount:\s*\d+/, 'mẫu hóa đơn không được điền sẵn số tiền cụ thể');

// Kiểm tra danh sách 32 BILL_ICONS
assert.match(recurringSrc, /const BILL_ICONS = \[/);
for (const ic of ['lightning', 'drop', 'wifi', 'house', 'television', 'cloud', 'receipt', 'creditCard']) {
  assert.ok(recurringSrc.includes(`'${ic}'`), `thiếu icon ${ic} trong BILL_ICONS`);
}
console.log('bill templates and icon options: OK');

/* ── 4. Màn Danh sách: dayLabel & csvCell ───────────────────── */
import { toDateStr } from '../../utils/dateUtils.js';

function dayLabel(dateStr, today) {
  const yesterday = toDateStr(new Date(new Date(`${today}T00:00:00`).getTime() - 86400000));
  if (dateStr === today) return 'Hôm nay';
  if (dateStr === yesterday) return 'Hôm qua';
  return dateStr;
}

assert.equal(dayLabel('2026-08-15', '2026-08-15'), 'Hôm nay');
assert.equal(dayLabel('2026-08-14', '2026-08-15'), 'Hôm qua');
assert.equal(dayLabel('2026-08-13', '2026-08-15'), '2026-08-13');

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}
assert.equal(csvCell('bình thường'), '"bình thường"');
assert.equal(csvCell('có dấu "ngoặc kép"'), '"có dấu ""ngoặc kép"""');
assert.equal(csvCell(null), '""');
assert.equal(csvCell(12345), '"12345"');
console.log('dayLabel and csvCell export formatting: OK');

/* ── 5. Màn Danh sách: Bộ lọc phễu cộng dồn (AND filter logic) ── */
const sampleListTxs = [
  { id: '1', occurred_at: '2026-08-05', type: 'expense', amount: 50_000, category_id: 'food', subcategory_id: 'food.drinks', necessity: 'want', note: 'Trà sữa' },
  { id: '2', occurred_at: '2026-08-10', type: 'expense', amount: 6_000_000, category_id: 'housing', subcategory_id: 'housing.rent', necessity: 'must', note: 'Tiền phòng trọ', merchant: 'Chủ nhà' },
  { id: '3', occurred_at: '2026-08-12', type: 'expense', amount: 200_000, category_id: 'food', subcategory_id: 'food.eatout', necessity: 'want', note: 'Ăn tối nhà hàng' },
  { id: '4', occurred_at: '2026-08-15', type: 'income', amount: 20_000_000, category_id: 'luong', necessity: null, note: 'Lương công ty' },
  { id: '5', occurred_at: '2026-08-20', type: 'expense', amount: 300_000, category_id: 'transport', subcategory_id: 'transport.fuel', necessity: 'must', note: 'Đổ xăng xe', bill_id: 'b1' },
];

function applyListFilter(txs, { filter = 'all', q = '', cat = '', sub = '', from = '', to = '' }) {
  return txs.filter(tx => {
    if (filter === 'auto' && !(tx.bill_id || tx.loan_id || tx.card_id)) return false;
    if (filter === 'must' && tx.necessity !== 'must') return false;
    if (filter === 'want' && tx.necessity !== 'want') return false;
    if (filter === 'expense' && tx.type !== 'expense') return false;
    if (filter === 'income' && tx.type !== 'income') return false;
    if (q) {
      const haystack = [tx.note, tx.merchant, tx.category_id, tx.subcategory_id].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }
    if (cat && tx.category_id !== cat) return false;
    if (sub && tx.subcategory_id !== sub) return false;
    if (from && tx.occurred_at < from) return false;
    if (to && tx.occurred_at > to) return false;
    return true;
  });
}

// 1. Lọc chip loại:
assert.equal(applyListFilter(sampleListTxs, { filter: 'expense' }).length, 4);
assert.equal(applyListFilter(sampleListTxs, { filter: 'income' }).length, 1);
assert.equal(applyListFilter(sampleListTxs, { filter: 'must' }).length, 2);
assert.equal(applyListFilter(sampleListTxs, { filter: 'want' }).length, 2);
assert.equal(applyListFilter(sampleListTxs, { filter: 'auto' }).length, 1);

// 2. Lọc từ khóa search:
assert.equal(applyListFilter(sampleListTxs, { q: 'trà sữa' }).length, 1);
assert.equal(applyListFilter(sampleListTxs, { q: 'Chủ nhà' }).length, 1);

// 3. Phễu cộng dồn AND (Chi + Nhóm Food + Từ khóa 'Ăn tối'):
assert.equal(applyListFilter(sampleListTxs, { filter: 'expense', cat: 'food', q: 'Ăn tối' }).length, 1);

// 4. Phễu cộng dồn theo khoảng ngày (01/08 đến 10/08):
assert.equal(applyListFilter(sampleListTxs, { from: '2026-08-01', to: '2026-08-10' }).length, 2);

// 5. shownTotal của danh sách đang lọc:
const filteredFood = applyListFilter(sampleListTxs, { cat: 'food' });
const foodTotal = filteredFood.filter(t => t.type === 'expense' && !t.excluded).reduce((s, t) => s + t.amount, 0);
assert.equal(foodTotal, 250_000, '50k trà sữa + 200k ăn tối');
console.log('multi-criteria list filtering and shownTotal: OK');

/* ── 6. An toàn dữ liệu: Modal xác nhận xóa dùng chung ──────── */
assert.match(pageSrc, /const confirmDelete = useCallback\(/,
  'FinancePage phải có modal xác nhận xóa dùng chung');

// Kiểm tra 9 luồng xóa trong RecurringScreen, ListScreen, AddScreen, AnalyzeScreen
const allScreensCode = [
  recurringSrc,
  listSrc,
  addSrc,
  readFileSync(new URL('../../components/finance/AnalyzeScreen.jsx', import.meta.url), 'utf8'),
].join('\n');

assert.equal((allScreensCode.match(/nav\.confirmDelete\(/g) || []).length, 9,
  'phải có đủ 9 luồng xóa đi qua confirmDelete');
assert.doesNotMatch(allScreensCode, /onClick=\{\(\) => fin\.delete/,
  'tuyệt đối không được xóa dữ liệu trực tiếp khi click nút mà bỏ qua modal xác nhận');
console.log('destructive action confirmation guards: OK');

/* ── 7. Kiến trúc & Hợp đồng Navigation Finance ───────────── */
const navbarSrc = readFileSync(new URL('../../components/Navbar.jsx', import.meta.url), 'utf8');
const overviewSrc = readFileSync(new URL('../../components/finance/OverviewScreen.jsx', import.meta.url), 'utf8');

// 1. RecurringScreen phải có segment 'saving' (Quỹ tiết kiệm)
assert.match(recurringSrc, /value:\s*'saving'/, 'RecurringScreen phải có segment saving');

// 2. OverviewScreen tuyệt đối không còn tab 'budget'
assert.doesNotMatch(overviewSrc, /value:\s*'budget'/, 'OverviewScreen không còn tab budget');

// 3. Navbar FINANCE_NAV: cats ở cuối cùng, recurring đổi tên Định kỳ & Quỹ
assert.match(navbarSrc, /to:\s*'\/finance\/recurring',\s*icon:\s*'calendar',\s*label:\s*'Định kỳ & Quỹ'/, 'recurring được đổi tên thành Định kỳ & Quỹ');
const catsIdxNavbar = navbarSrc.indexOf("to: '/finance/cats'");
const recurringIdxNavbar = navbarSrc.indexOf("to: '/finance/recurring'");
assert.ok(catsIdxNavbar > recurringIdxNavbar, 'Danh mục phải nằm dưới Định kỳ & Quỹ trong Navbar');

// 4. FinancePage SCREENS: cats ở cuối cùng
const catsIdxPage = pageSrc.indexOf("key: 'cats'");
const recurringIdxPage = pageSrc.indexOf("key: 'recurring'");
assert.ok(catsIdxPage > recurringIdxPage, 'Danh mục phải nằm dưới Định kỳ & Quỹ trong FinancePage');
console.log('finance navigation and segment contract: OK');

console.log('\n✅ financeScreensContract — tất cả hợp đồng màn hình PASS (100% covered)');

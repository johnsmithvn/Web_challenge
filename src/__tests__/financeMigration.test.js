import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../data/migration_v6.0.0_finance.sql', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../hooks/useFinance.js', import.meta.url), 'utf8');
const recurring = readFileSync(new URL('../components/finance/RecurringScreen.jsx', import.meta.url), 'utf8');
const list = readFileSync(new URL('../components/finance/ListScreen.jsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../pages/FinancePage.jsx', import.meta.url), 'utf8');
const billNote = readFileSync(new URL('../../data/migration_v6.3.0_finance_bill_note.sql', import.meta.url), 'utf8');
const lending = readFileSync(new URL('../../data/migration_v6.4.0_finance_lending.sql', import.meta.url), 'utf8');
const detach = readFileSync(new URL('../../data/migration_v6.9.0_finance_rule_detach.sql', import.meta.url), 'utf8');
const forfeited = readFileSync(new URL('../../data/migration_v6.9.1_finance_lending_forfeited.sql', import.meta.url), 'utf8');
const destructiveScreens = [
  list,
  recurring,
  readFileSync(new URL('../components/finance/AddScreen.jsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../components/finance/AnalyzeScreen.jsx', import.meta.url), 'utf8'),
].join('\n');

const TABLES = [
  'finance_cards', 'finance_bills', 'finance_loans', 'finance_saving_goals',
  'finance_deposits', 'finance_income_rules', 'finance_shortcuts', 'finance_budgets',
  'finance_category_overrides', 'finance_transactions', 'finance_transaction_tags',
];
const RPCS = [
  'finance_pay_bill', 'finance_skip_bill_period', 'finance_receive_income',
  'finance_record_loan_payment', 'finance_pay_card_statement',
  'finance_request_saving_withdrawal', 'finance_move_saving',
];

assert.match(sql, /^-- Finance v6\.0\.0/m);
assert.match(sql, /BEGIN;[\s\S]*COMMIT;/, 'migration phải chạy trong một transaction DDL');
assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS finance_/, 'clean rebuild không được giữ schema Finance cũ');
assert.equal((sql.match(/\$\$/g) || []).length % 2, 0, 'dollar-quoted function body phải đóng đủ cặp');

for (const table of TABLES) {
  assert.match(sql, new RegExp(`CREATE TABLE ${table} \\(`), `thiếu bảng ${table}`);
  assert.match(sql, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`), `thiếu RLS ${table}`);
}

for (const rpc of RPCS) {
  assert.match(sql, new RegExp(`CREATE FUNCTION ${rpc}\\(`), `thiếu RPC ${rpc}`);
  assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION ${rpc}\\(`), `thiếu quyền authenticated cho ${rpc}`);
  assert.match(hook, new RegExp(`callFinanceRpc\\('${rpc}'`), `useFinance chưa gọi ${rpc}`);
}

for (const column of [
  'attachments JSONB', 'bill_period TEXT', 'income_rule_id UUID', 'income_period TEXT',
  'loan_period TEXT', 'loan_part TEXT', 'card_period TEXT', 'task_id UUID', 'inbox_item_id UUID',
]) {
  assert.ok(sql.includes(column), `finance_transactions thiếu ${column}`);
}

assert.match(sql, /amount BIGINT NOT NULL CHECK \(amount > 0\)/, 'giao dịch phải có số tiền dương');
assert.match(sql, /matures_at DATE GENERATED ALWAYS AS/, 'ngày đáo hạn phải tự tính từ ngày gửi và kỳ hạn');
assert.match(sql, /finance_valid_subcategories\(subs\)/, 'mục con phải được kiểm tra cấu trúc ở database');
assert.match(sql, /finance_valid_income_category\(category_id\)/, 'nguồn thu phải thuộc đúng 7 khóa đóng');
assert.match(sql, /ARRAY\['luong', 'thuong', 'ngoai', 'dautu', 'banha', 'duoctang', 'hoantien'\]/,
  '7 khóa nguồn thu phải khớp taxonomy handoff');
assert.match(sql, /lock_mode = 'term' AND lock_until IS NOT NULL/,
  'quỹ kỳ hạn phải có ngày mở khóa');
assert.match(sql, /v_available := NOW\(\) \+ INTERVAL '48 hours'/, 'rút sớm quỹ kỳ hạn chỉ tạo ma sát 48 giờ');
assert.match(sql, /v_goal\.lock_until > CURRENT_DATE/, 'quỹ hết ngày khóa phải được xử lý như khóa mềm');
assert.match(sql, /'expense', 'finance', 'finance\.principal', TRUE/,
  'trả gốc vay phải có danh mục hợp lệ và đứng ngoài tổng chi');
assert.match(sql, /'expense', 'finance', 'finance\.card', TRUE/,
  'trả sao kê phải có danh mục hợp lệ và đứng ngoài tổng chi');
assert.match(sql, /unique_finance_tx_bill_period/, 'phải chống trả trùng hóa đơn theo kỳ');
assert.match(sql, /p_bill_period TEXT DEFAULT NULL/, 'kỳ nghĩa vụ phải tách khỏi ngày trả thật');
assert.match(sql, /v_period := COALESCE\(p_bill_period, TO_CHAR\(p_occurred_at, 'YYYY-MM'\)\)/,
  'thanh toán phải ưu tiên kỳ nghĩa vụ do màn hiện tại truyền vào');
assert.match(sql, /A paid bill period cannot be skipped/, 'không được bỏ một kỳ đã thanh toán');
assert.match(sql, /WHEN skipped_periods \? p_period THEN skipped_periods/,
  'bỏ kỳ phải idempotent, không thêm trùng kỳ');
assert.match(sql, /WHERE value <> v_period/, 'thanh toán một kỳ đã bỏ phải gỡ trạng thái bỏ kỳ');
// Kỳ của hóa đơn KHÔNG phải lúc nào cũng là tháng đang chạy: chu kỳ 3 tháng ở tháng
// không tới lượt thì kỳ nằm phía trước. Mọi đường đọc/ghi kỳ phải đi qua billCycle.
assert.match(recurring, /\(b\.skipped_periods \|\| \[\]\)\.includes\(cyc\.period\)/,
  'màn Hóa đơn phải đọc trạng thái bỏ kỳ của ĐÚNG kỳ hóa đơn, không phải tháng đang chạy');
assert.match(recurring, /fin\.skipBillPeriod\(bill\.id, periodOf\(bill\)\)/,
  'nút Bỏ kỳ này phải gọi RPC đúng kỳ của hóa đơn — quý/năm không rơi vào tháng này');
// billCycle phải nhận CẢ trạng thái đã trả: thiếu nó thì một kỳ quý bị lỡ sẽ bị nhảy qua.
assert.match(recurring, /const cycleOf = \(bill\) => billCycle\(bill, fin\.today, billSettled\(bill, fin\.transactions\)\)/,
  'kỳ hóa đơn chỉ được suy từ billCycle + billSettled, không lấy đại today.slice(0,7)');
assert.match(recurring, /const periodOf = \(bill\) => cycleOf\(bill\)\.period/,
  'ghi/bỏ kỳ phải dùng đúng kỳ mà dòng hóa đơn đang hiển thị');
assert.match(recurring, /const actionable = b\.enabled && !paid && !skipped/,
  'hóa đơn tắt, đã trả hoặc đã bỏ không được hiện thao tác thanh toán');
// Bỏ kỳ phải có đường quay lại: RPC skip chỉ THÊM vào skipped_periods, đường gỡ duy nhất
// trong DB là finance_pay_bill — mà nút Thanh toán bị ẩn khi đã bỏ kỳ. Không có nút gỡ
// thì bấm nhầm là kẹt tới tháng sau.
assert.match(recurring, /skipped_periods: rest/,
  'màn Hóa đơn phải có đường bỏ đánh dấu một kỳ đã lỡ bỏ');
assert.match(sql, /THEN skipped_periods[\s\S]{0,40}ELSE skipped_periods \|\| JSONB_BUILD_ARRAY/,
  'RPC bỏ kỳ chỉ thêm, không tự gỡ — việc gỡ do UI làm qua UPDATE own-row');
assert.match(page, /const confirmDelete = useCallback\(/,
  'Finance phải có một luồng xác nhận xóa dùng chung');
// 9 luồng xóa: giao dịch · hóa đơn · khoản thu · vay · thẻ · CHO VAY · quỹ · nơi gửi · shortcut.
// Con số này chỉ được tăng khi thêm một loại dữ liệu mới có nút xóa, không bao giờ giảm.
assert.equal((destructiveScreens.match(/nav\.confirmDelete\(/g) || []).length, 9,
  'mọi nút xóa dữ liệu Finance phải đi qua xác nhận dùng chung');
assert.doesNotMatch(destructiveScreens, /onClick=\{\(\) => fin\.delete/,
  'không được xóa dữ liệu Finance trực tiếp từ nút bấm');
assert.match(list, /if \(await fin\.deleteTransaction\(tx\.id\)\) onClose\(\)/,
  'chi tiết giao dịch chỉ được đóng khi xóa thành công');
assert.match(sql, /p_income_period TEXT DEFAULT NULL/, 'kỳ thu định kỳ phải tách khỏi ngày nhận thật');
assert.match(sql, /p_loan_period TEXT DEFAULT NULL/, 'kỳ trả vay phải tách khỏi ngày trả thật');
assert.match(hook, /p_income_period: period \|\| today\.slice\(0, 7\)/,
  'useFinance phải truyền kỳ thu đang chạy');
assert.match(hook, /p_loan_period: period \|\| today\.slice\(0, 7\)/,
  'useFinance phải truyền kỳ vay đang chạy');
assert.match(recurring, /t\.loan_period === period && t\.loan_part === 'principal'/,
  'màn Khoản vay phải khóa kỳ đã ghi');
assert.match(billNote, /ADD COLUMN IF NOT EXISTS note TEXT/,
  'ghi chú hóa đơn phải là cột nullable thêm bằng migration riêng, idempotent');
assert.match(lending, /lending_id IS NOT NULL/,
  'excluded phải mở đúng thêm một trường hợp: giao dịch thu về của khoản cho vay');
assert.match(lending, /'income', 'hoantien', TRUE/,
  'thu về từ khoản cho vay là income NHƯNG excluded — nếu tính là thu nhập thì tỉ lệ tiết kiệm sai');
assert.match(lending, /ON DELETE SET NULL/,
  'xóa khoản cho vay không được xóa lịch sử các lần đã thu');
assert.match(lending, /IF v_got \+ p_amount > v_lend\.principal THEN/,
  'không cho thu về nhiều hơn số đã cho mượn');
assert.match(lending, /finance_lendings WHERE id = NEW\.lending_id AND user_id = NEW\.user_id/,
  'khóa ngoại mới phải được ownership guard kiểm');
assert.match(lending, /REVOKE ALL ON TABLE finance_lendings FROM anon/,
  'anon không được truy cập bảng cho vay');
assert.doesNotMatch(sql, /v_bill\.note/,
  'ghi chú của hóa đơn KHÔNG được sao chép xuống giao dịch — mỗi kỳ sẽ mang một bản sao giống hệt');
assert.match(sql, /unique_finance_tx_income_period/, 'phải chống nhận trùng thu nhập theo kỳ');
assert.match(sql, /unique_finance_tx_loan_part_period/, 'phải chống ghi trùng từng phần khoản vay');
assert.match(sql, /finance_transaction_reference_guard/, 'phải kiểm ownership của mọi liên kết');
// ── v6.9.0: xóa quy tắc chỉ gỡ liên kết, không xóa giao dịch ────────────────
assert.match(detach, /BEGIN;[\s\S]*COMMIT;/, 'migration phải chạy trong một transaction DDL');
assert.match(detach,
  /ARRAY\['bill_id', 'income_rule_id', 'loan_id', 'card_id', 'source_card_id'\][\s\S]*ON DELETE SET NULL/,
  'năm khóa ngoại quy tắc phải chuyển sang SET NULL — RESTRICT làm lệnh xóa hỏng hoàn toàn');
// `loan_part`/`card_period` là bằng chứng duy nhất còn lại sau khi quy tắc bị xóa, cho phép
// giao dịch tiếp tục excluded. Soi id thay vì soi chúng = trả gốc vay bị tính thành chi tiêu.
assert.match(detach,
  /ADD CONSTRAINT finance_tx_excluded_scope CHECK \(\s*excluded = FALSE\s*OR loan_part = 'principal'\s*OR card_period IS NOT NULL\s*OR lending_id IS NOT NULL/,
  'excluded phải nhận diện qua loan_part/card_period, không qua loan_id/card_id');
assert.match(detach, /saving_goal_id' AND c\.confdeltype = 'r'/,
  'quỹ tiết kiệm phải giữ RESTRICT: giao dịch type=saving không tồn tại nếu mất quỹ');
// ── v6.9.1: lãi mất do rút tiết kiệm trước hạn ──────────────────────────────
// Cột này phải là TIỀN TUYỆT ĐỐI cộng vào tổng phải thu, không phải một tỉ lệ: tổn
// thất xảy ra một lần lúc đập sổ, nhân nó với số ngày cho vay là con số vô nghĩa.
assert.match(forfeited, /BEGIN;[\s\S]*COMMIT;/, 'migration phải chạy trong một transaction DDL');
assert.match(forfeited, /ADD COLUMN IF NOT EXISTS forfeited_interest BIGINT NOT NULL DEFAULT 0/,
  'phải additive và idempotent: khoản cho vay cũ mang 0 và hành xử y như trước');
assert.match(forfeited, /CHECK \(forfeited_interest >= 0\)/, 'không cho số âm');
// `[^)]*` để chỗ ô tiền truyền thêm option parse (vd `amountOpts` tắt auto-K khi đang SỬA)
// mà không vỡ test: điều cần chặn là form KHÔNG gửi cột này, không phải chữ ký của call.
assert.match(recurring, /forfeited_interest: parseCurrencyInput\(f\.forfeited_interest[^)]*\) \|\| 0/,
  'form cho vay phải gửi cột mới, không thì ô nhập là trang trí');

// Bốn nút xóa quy tắc phải ĐỌC kết quả. Trước v6.9.0 vay/thẻ/cho vay thất bại im lặng:
// bấm Xóa, database từ chối, UI không nói gì.
for (const fn of ['deleteBill', 'deleteLoan', 'deleteCard', 'deleteLending']) {
  assert.match(recurring, new RegExp(`if \\(!await fin\\.${fn}\\(`),
    `nút xóa phải xử lý khi ${fn} thất bại, không im lặng`);
}

assert.match(sql, /security_invoker = TRUE/, 'tagged_items phải chạy bằng quyền người gọi');
assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*FROM anon;/, 'anon không được truy cập bảng Finance');

console.log('financeMigration contract check: OK');

/* ── Taxonomy: sub hệ thống và sub đã đổi nhóm cha ────────────────────────── */
const cats = JSON.parse(readFileSync(new URL('../data/finance-categories.json', import.meta.url), 'utf8'));
const add = readFileSync(new URL('../components/finance/AddScreen.jsx', import.meta.url), 'utf8');
const subs = cats.expenseGroups.flatMap(group => (group.subs || []).map(sub => ({ ...sub, group: group.key })));

// `subLabel()` tra key trên TOÀN BỘ nhóm, nên key trùng nhau sẽ trả nhãn của nhóm khác.
assert.equal(new Set(subs.map(sub => sub.key)).size, subs.length, 'key sub phải duy nhất trên cả taxonomy');

// Hai sub này chỉ do RPC ghi, kèm excluded=TRUE. Gõ tay được là đếm trùng: mua 20tr rồi
// ghi thêm "trả sao kê 20tr" thành chi 40tr.
for (const key of ['finance.principal', 'finance.card']) {
  assert.ok(subs.find(sub => sub.key === key)?.systemOnly === true,
    `${key} phải giữ cờ systemOnly`);
}

// Ba ô chọn sub lúc GHI phải đi qua pickableSubs: nó bỏ sub systemOnly nhưng LUÔN giữ giá
// trị dòng đang sửa — sub có thể đã đổi nhóm cha mà giữ nguyên key, dropdown trống thì bấm
// lưu là xóa mất danh mục con của dòng cũ.
for (const [name, src] of [['ListScreen', list], ['RecurringScreen', recurring], ['AddScreen', add]]) {
  assert.match(src, /pickableSubs\(/, `${name} phải chọn sub qua pickableSubs`);
}
assert.doesNotMatch(add + list + recurring, /subs \|\| \[\]\)\.filter\(s(ub)? => !s(ub)?\.systemOnly/,
  'lọc systemOnly tay ở màn hình sẽ bỏ mất nhánh giữ giá trị cũ — dùng pickableSubs');

console.log('finance taxonomy contract: OK');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../data/migration_v6.0.0_finance.sql', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../hooks/useFinance.js', import.meta.url), 'utf8');
const recurring = readFileSync(new URL('../components/finance/RecurringScreen.jsx', import.meta.url), 'utf8');
const list = readFileSync(new URL('../components/finance/ListScreen.jsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../pages/FinancePage.jsx', import.meta.url), 'utf8');
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
assert.match(recurring, /\(b\.skipped_periods \|\| \[\]\)\.includes\(currentPeriod\)/,
  'màn Hóa đơn phải đọc trạng thái bỏ kỳ hiện tại');
assert.match(recurring, /fin\.skipBillPeriod\(bill\.id, currentPeriod\)/,
  'nút Bỏ kỳ này phải gọi RPC đúng kỳ đang chạy');
assert.match(recurring, /const actionable = b\.enabled && !paid && !skipped/,
  'hóa đơn tắt, đã trả hoặc đã bỏ không được hiện thao tác thanh toán');
assert.match(page, /const confirmDelete = useCallback\(/,
  'Finance phải có một luồng xác nhận xóa dùng chung');
assert.equal((destructiveScreens.match(/nav\.confirmDelete\(/g) || []).length, 8,
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
assert.match(sql, /unique_finance_tx_income_period/, 'phải chống nhận trùng thu nhập theo kỳ');
assert.match(sql, /unique_finance_tx_loan_part_period/, 'phải chống ghi trùng từng phần khoản vay');
assert.match(sql, /finance_transaction_reference_guard/, 'phải kiểm ownership của mọi liên kết');
assert.match(sql, /security_invoker = TRUE/, 'tagged_items phải chạy bằng quyền người gọi');
assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*FROM anon;/, 'anon không được truy cập bảng Finance');

console.log('financeMigration contract check: OK');

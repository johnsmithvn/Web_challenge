-- ═══════════════════════════════════════════════════════════════════════════
-- migration_v6.0.0_finance.sql — Module chi tiêu v2 (thiết kế Nocturne)
--
-- Thay HẲN module Finance cũ (expenses + subscriptions). Xem docs/DESIGN_FINANCE.md.
--
-- Idempotent — chạy lại an toàn (CREATE ... IF NOT EXISTS + DROP POLICY IF EXISTS
-- trước mỗi CREATE POLICY, cùng pattern master schema + migration_v5.2.0_vault).
-- Chạy 1 lần trên Supabase SQL Editor rồi deploy code.
--
-- ⚠️ MẤT DỮ LIỆU: block §0 DROP expenses + subscriptions + dữ liệu thật (đúng lựa
--    chọn "drop sạch, làm lại từ đầu" của user 2026-08-08). KHÔNG có nhánh migrate.
--
-- Ba nguyên lý (docs/DESIGN_FINANCE.md §0), schema phải phục vụ:
--   1. App KHÔNG tính số dư — không cột tổng nào, không cột balance ở saving_goals.
--   2. Một bảng lọc theo kỳ — mọi báo cáo = đếm lại finance_transactions theo occurred_at.
--   3. App không trả hộ — thanh toán = 1 finance_transactions mang FK trỏ về quy tắc.
--
-- CHECK chỉ đặt trên giá trị code PHÂN NHÁNH theo (type, amount_mode, kind, lock_mode,
-- necessity, saving_dir). KHÔNG đặt trên category_id/subcategory_id — content nằm ở
-- src/data/finance-categories.json, thêm danh mục không nên cần migration.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. DROP module cũ ──────────────────────────────────────────────────────
DROP VIEW  IF EXISTS tagged_items;              -- tạo lại ở §11 (bỏ nhánh expense/subscription)
DROP TABLE IF EXISTS expense_tags CASCADE;
DROP TABLE IF EXISTS subscription_tags CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;

-- ── 1. finance_cards = Thẻ tín dụng ────────────────────────────────────────
-- statement_day ≠ due_day: khoảng giữa là thời gian float (tiền ngân hàng nằm trong
-- tay mình không mất lãi). grace = số ngày ân hạn.
CREATE TABLE IF NOT EXISTS finance_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank TEXT,
  last4 TEXT,
  credit_limit BIGINT NOT NULL DEFAULT 0,
  statement_day INT,
  due_day INT,
  grace INT,
  annual_fee BIGINT NOT NULL DEFAULT 0,
  cash_advance_fee BIGINT NOT NULL DEFAULT 0,
  min_pct NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_cards_user ON finance_cards (user_id);
DROP TRIGGER IF EXISTS finance_cards_updated_at ON finance_cards;
CREATE TRIGGER finance_cards_updated_at BEFORE UPDATE ON finance_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE finance_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_cards_own" ON finance_cards;
CREATE POLICY "finance_cards_own" ON finance_cards FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 2. finance_bills = Hóa đơn phải trả (segment out) ──────────────────────
-- amount_mode: fixed (biết trước) | ask (điện/nước — app hỏi, không tự ghi).
-- rrule JSONB cùng shape recurrence_rule của task. Trả góp: term_done tăng mỗi kỳ.
CREATE TABLE IF NOT EXISTS finance_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT,
  customer_code TEXT,
  category_id TEXT,
  subcategory_id TEXT,
  rrule JSONB,
  due_day INT,
  amount_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (amount_mode IN ('fixed','ask')),
  amount BIGINT,
  term_total INT,
  term_done INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_bills_user ON finance_bills (user_id, enabled);
DROP TRIGGER IF EXISTS finance_bills_updated_at ON finance_bills;
CREATE TRIGGER finance_bills_updated_at BEFORE UPDATE ON finance_bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE finance_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_bills_own" ON finance_bills;
CREATE POLICY "finance_bills_own" ON finance_bills FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 3. finance_loans = Khoản vay (segment loan) ────────────────────────────
-- kind: interest (chỉ trả lãi, gốc tất toán 1 lần cuối kỳ) | amort (trả đều gốc+lãi).
-- LÃI là chi tiêu; GỐC không (giao dịch trả gốc mang excluded=true ở tầng code).
CREATE TABLE IF NOT EXISTS finance_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lender TEXT,
  principal BIGINT NOT NULL DEFAULT 0,
  rate NUMERIC NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'amort' CHECK (kind IN ('interest','amort')),
  term INT,
  done INT NOT NULL DEFAULT 0,
  pay_day INT,
  opened_at DATE,
  due_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_loans_user ON finance_loans (user_id);
DROP TRIGGER IF EXISTS finance_loans_updated_at ON finance_loans;
CREATE TRIGGER finance_loans_updated_at BEFORE UPDATE ON finance_loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE finance_loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_loans_own" ON finance_loans;
CREATE POLICY "finance_loans_own" ON finance_loans FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 4. finance_saving_goals = Quỹ tiết kiệm (KHÔNG có cột số dư) ────────────
-- Số dư quỹ = SUM(finance_deposits.amount) WHERE fund_id = ? (tính runtime).
-- lock_mode: soft (rút 1 chạm) | term (chờ 48h) | external (sổ thật ngoài app).
CREATE TABLE IF NOT EXISTS finance_saving_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal BIGINT NOT NULL DEFAULT 0,
  lock_mode TEXT NOT NULL DEFAULT 'soft' CHECK (lock_mode IN ('soft','term','external')),
  lock_until DATE,
  in_wallet BOOLEAN NOT NULL DEFAULT true,
  auto_deposit JSONB,
  break_count INT NOT NULL DEFAULT 0,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_saving_goals_user ON finance_saving_goals (user_id);
DROP TRIGGER IF EXISTS finance_saving_goals_updated_at ON finance_saving_goals;
CREATE TRIGGER finance_saving_goals_updated_at BEFORE UPDATE ON finance_saving_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE finance_saving_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_saving_goals_own" ON finance_saving_goals;
CREATE POLICY "finance_saving_goals_own" ON finance_saving_goals FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 5. finance_deposits = Nơi gửi (sổ thật của 1 quỹ) ──────────────────────
CREATE TABLE IF NOT EXISTS finance_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fund_id UUID NOT NULL REFERENCES finance_saving_goals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank TEXT,
  account_no TEXT,
  amount BIGINT NOT NULL DEFAULT 0,
  rate NUMERIC NOT NULL DEFAULT 0,
  term INT,
  opened_at DATE,
  matures_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_deposits_fund ON finance_deposits (fund_id);
ALTER TABLE finance_deposits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_deposits_own" ON finance_deposits;
CREATE POLICY "finance_deposits_own" ON finance_deposits FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 6. finance_income_rules = Thu định kỳ (segment in) ─────────────────────
-- KHÔNG quá hạn (chưa nhận chỉ là chưa tới). received_periods[] chặn nhận 2 lần 1 kỳ.
CREATE TABLE IF NOT EXISTS finance_income_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT,
  rrule JSONB,
  due_day INT,
  amount BIGINT NOT NULL DEFAULT 0,
  received_periods JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_income_rules_user ON finance_income_rules (user_id, enabled);
DROP TRIGGER IF EXISTS finance_income_rules_updated_at ON finance_income_rules;
CREATE TRIGGER finance_income_rules_updated_at BEFORE UPDATE ON finance_income_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE finance_income_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_income_rules_own" ON finance_income_rules;
CREATE POLICY "finance_income_rules_own" ON finance_income_rules FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 7. finance_shortcuts = Nút nhập nhanh (KHÔNG có cột số tiền) ────────────
-- recent_amounts[] = 3 mức hay nhập gần đây, hiện thành chip. Shortcut chỉ nhớ
-- danh mục, không chốt tiền (xăng hôm nay 50k mai 100k).
CREATE TABLE IF NOT EXISTS finance_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id TEXT,
  subcategory_id TEXT,
  necessity TEXT CHECK (necessity IN ('must','need','want')),
  recent_amounts JSONB NOT NULL DEFAULT '[]'::jsonb,
  use_count INT NOT NULL DEFAULT 0,
  source_card_id UUID REFERENCES finance_cards(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_shortcuts_user ON finance_shortcuts (user_id, sort_order);
ALTER TABLE finance_shortcuts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_shortcuts_own" ON finance_shortcuts;
CREATE POLICY "finance_shortcuts_own" ON finance_shortcuts FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 8. finance_budgets = Hạn mức tháng (cơ sở 50/30/20) ────────────────────
-- Tổng hạn mức là MẪU SỐ DUY NHẤT của mọi tỉ lệ — không dùng thu nhập (nguyên lý #1).
-- Hạn mức đứng (không theo từng tháng): 1 dòng / (user, category).
CREATE TABLE IF NOT EXISTS finance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  limit_amount BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_finance_budget_cat ON finance_budgets (user_id, category_id);
DROP TRIGGER IF EXISTS finance_budgets_updated_at ON finance_budgets;
CREATE TRIGGER finance_budgets_updated_at BEFORE UPDATE ON finance_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_budgets_own" ON finance_budgets;
CREATE POLICY "finance_budgets_own" ON finance_budgets FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 9. finance_transactions = BẢNG DUY NHẤT ────────────────────────────────
-- Tạo SAU các bảng nó tham chiếu (cards/bills/loans/goals/shortcuts). collections +
-- user_tasks đã có ở master schema.
--   type: expense (chi) | income (thu) | saving (để dành — loại thứ ba, không vào donut).
--   excluded=true: trả gốc vay + trả sao kê thẻ — vẫn hiện timeline, NGOÀI mọi tổng chi.
--   source_card_id NULL = tiền mặt/có sẵn; else = thẻ đã quẹt.
--   card_id = thẻ đang TRẢ SAO KÊ (khác source_card_id là thẻ đã quẹt để mua).
--   inbox_item_id / task_id = liên kết Inbox / Task (yêu cầu user).
CREATE TABLE IF NOT EXISTS finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense','income','saving')),
  category_id TEXT,
  subcategory_id TEXT,
  source_card_id UUID REFERENCES finance_cards(id) ON DELETE SET NULL,
  excluded BOOLEAN NOT NULL DEFAULT false,
  necessity TEXT CHECK (necessity IN ('must','need','want')),
  is_fixed BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  merchant TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  shortcut_id UUID REFERENCES finance_shortcuts(id) ON DELETE SET NULL,
  bill_id UUID REFERENCES finance_bills(id) ON DELETE SET NULL,
  bill_period TEXT,
  loan_id UUID REFERENCES finance_loans(id) ON DELETE SET NULL,
  card_id UUID REFERENCES finance_cards(id) ON DELETE SET NULL,
  saving_goal_id UUID REFERENCES finance_saving_goals(id) ON DELETE SET NULL,
  saving_dir TEXT CHECK (saving_dir IN ('in','out')),
  inbox_item_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  task_id UUID REFERENCES user_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finance_tx_user_date ON finance_transactions (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_tx_bill ON finance_transactions (bill_id);
CREATE INDEX IF NOT EXISTS idx_finance_tx_task ON finance_transactions (task_id);
-- Quy tắc nghiệp vụ #3: chặn trả 2 lần cùng 1 kỳ của cùng 1 hóa đơn.
CREATE UNIQUE INDEX IF NOT EXISTS unique_finance_tx_bill_period
  ON finance_transactions (bill_id, bill_period)
  WHERE bill_id IS NOT NULL AND bill_period IS NOT NULL;
DROP TRIGGER IF EXISTS finance_transactions_updated_at ON finance_transactions;
CREATE TRIGGER finance_transactions_updated_at BEFORE UPDATE ON finance_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_transactions_own" ON finance_transactions;
CREATE POLICY "finance_transactions_own" ON finance_transactions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 10. finance_transaction_tags (junction: transactions ↔ tags) ───────────
-- Dùng bảng `tags` có sẵn, kiểm ownership 2 phía như account_tags.
CREATE TABLE IF NOT EXISTS finance_transaction_tags (
  transaction_id UUID NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  tag_id         UUID NOT NULL REFERENCES tags(id)                 ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_finance_tx_tags_tag ON finance_transaction_tags(tag_id);
ALTER TABLE finance_transaction_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_transaction_tags_own" ON finance_transaction_tags;
CREATE POLICY "finance_transaction_tags_own" ON finance_transaction_tags FOR ALL
  USING (
        EXISTS (SELECT 1 FROM finance_transactions WHERE id = transaction_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags                 WHERE id = tag_id         AND user_id = auth.uid())
  )
  WITH CHECK (
        EXISTS (SELECT 1 FROM finance_transactions WHERE id = transaction_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags                 WHERE id = tag_id         AND user_id = auth.uid())
  );

-- ── 11. VIEW tagged_items — tạo lại (bỏ expense/subscription, thêm finance) ─
-- useTags.js đọc view này để đếm tag đang dùng ở đâu. Phải chạy SAU §10.
DROP VIEW IF EXISTS tagged_items;
CREATE VIEW tagged_items WITH (security_invoker = true) AS
      SELECT tag_id, 'collection'::text AS kind, collection_id  AS item_id FROM collection_tags
UNION ALL SELECT tag_id, 'task'::text,         task_id                     FROM task_tags
UNION ALL SELECT tag_id, 'account'::text,      account_id                  FROM account_tags
UNION ALL SELECT tag_id, 'finance'::text,      transaction_id              FROM finance_transaction_tags;

-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- 9 bảng + 1 junction tồn tại (phải ra 10 dòng):
--   SELECT table_name FROM information_schema.tables WHERE table_name IN
--    ('finance_transactions','finance_bills','finance_loans','finance_cards',
--     'finance_saving_goals','finance_deposits','finance_income_rules',
--     'finance_shortcuts','finance_budgets','finance_transaction_tags');
--
-- Bảng cũ đã biến mất (phải ra 0 dòng):
--   SELECT table_name FROM information_schema.tables
--    WHERE table_name IN ('expenses','subscriptions','expense_tags','subscription_tags');
--
-- View có mặt 'finance', không còn 'expense'/'subscription':
--   SELECT DISTINCT kind FROM tagged_items;
--
-- ── 2 phép thử PHẢI BÁO LỖI (thay '<uid>' bằng auth.uid() của mình) ──
-- CHECK type — 'wrong' không hợp lệ:
--   INSERT INTO finance_transactions (user_id, amount, type) VALUES (auth.uid(), 1000, 'wrong');
-- UNIQUE bill_period — dòng thứ hai cùng (bill_id, bill_period) phải bị chặn:
--   (chạy sau khi có 1 bill '<bid>')
--   INSERT INTO finance_transactions (user_id, amount, bill_id, bill_period) VALUES
--     (auth.uid(), 1000, '<bid>', '2026-08'), (auth.uid(), 1000, '<bid>', '2026-08');

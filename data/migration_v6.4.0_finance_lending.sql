-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: CHO VAY (khoản phải thu) v6.4.0
-- Run after migration_v6.0.0_finance.sql.
--
-- Segment thứ năm của màn Hóa đơn. "Cho vay" ngược chiều với `finance_loans`:
-- ở đây MÌNH đưa tiền cho người khác và thu về NHIỀU LẦN, mỗi lần một số tiền
-- khác nhau — không có kỳ cố định nên không nhét vào finance_loans được.
--
-- Nguyên tắc tiền:
--   · Cho mượn KHÔNG phải chi tiêu — tiền rời ví nhưng đổi thành khoản phải thu,
--     nên donut, hạn mức nhóm và mức 50/30/20 không đổi.
--   · Họ trả lại KHÔNG phải thu nhập — nếu tính thì tháng đó thu nhập vọt lên ảo
--     và tỉ lệ tiết kiệm sai. Vì vậy giao dịch thu về mang `excluded = TRUE`.
--   · Số đã thu = SUM(finance_transactions WHERE lending_id = ?). Không có cột
--     tổng nào phải đồng bộ ngược.
--
-- Migration này SỬA HAI CHECK CONSTRAINT có sẵn của finance_transactions (chúng
-- đang chỉ cho phép `excluded = TRUE` với trả gốc vay và trả sao kê thẻ). Cả file
-- chạy trong một transaction: lỗi ở bất kỳ bước nào là rollback sạch.
-- Idempotent: chạy lại nhiều lần không hỏng gì.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Preflight ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'finance_transactions') THEN
    RAISE EXCEPTION
      'Lending migration refused: finance_transactions is missing. Run migration_v6.0.0_finance.sql first.';
  END IF;
END
$$;

-- ── 1. Bảng khoản cho vay ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_lendings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  note TEXT,
  principal BIGINT NOT NULL CHECK (principal > 0),
  rate NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  lent_on DATE NOT NULL DEFAULT CURRENT_DATE,
  due_on DATE,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (due_on IS NULL OR due_on >= lent_on)
);

COMMENT ON TABLE finance_lendings IS
  'Tiền mình cho người khác mượn. Số đã thu suy từ finance_transactions.lending_id.';

DROP TRIGGER IF EXISTS finance_lendings_updated_at ON finance_lendings;
CREATE TRIGGER finance_lendings_updated_at BEFORE UPDATE ON finance_lendings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_finance_lendings_user
  ON finance_lendings (user_id, due_on);

-- ── 2. Liên kết giao dịch thu về ─────────────────────────────────────────────
-- ON DELETE SET NULL: xóa khoản cho vay KHÔNG xóa lịch sử các lần đã thu.
ALTER TABLE finance_transactions
  ADD COLUMN IF NOT EXISTS lending_id UUID REFERENCES finance_lendings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_tx_lending
  ON finance_transactions (lending_id) WHERE lending_id IS NOT NULL;

-- ── 3. Nới hai CHECK đang chặn "income + excluded" ──────────────────────────
-- Hai constraint gốc không có tên (Postgres tự đặt), nên tìm theo định nghĩa rồi
-- dựng lại thành constraint CÓ TÊN để migration sau sửa được dễ dàng.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'finance_transactions'::regclass AND contype = 'c'
  LOOP
    -- CHECK phân nhánh theo type (saving / income / expense)
    IF c.def LIKE '%''saving''::text%' AND c.def LIKE '%necessity IS NOT NULL%' THEN
      EXECUTE FORMAT('ALTER TABLE finance_transactions DROP CONSTRAINT %I', c.conname);
    -- CHECK whitelist các trường hợp được phép excluded
    ELSIF c.def LIKE '%loan_part = ''principal''::text%'
      AND c.def LIKE '%card_period IS NOT NULL%'
      AND c.def NOT LIKE '%type =%' THEN
      EXECUTE FORMAT('ALTER TABLE finance_transactions DROP CONSTRAINT %I', c.conname);
    END IF;
  END LOOP;
END
$$;

ALTER TABLE finance_transactions
  DROP CONSTRAINT IF EXISTS finance_tx_branch_shape,
  DROP CONSTRAINT IF EXISTS finance_tx_excluded_scope,
  DROP CONSTRAINT IF EXISTS finance_tx_lending_scope;

ALTER TABLE finance_transactions
  ADD CONSTRAINT finance_tx_branch_shape CHECK (
    (type = 'saving' AND saving_goal_id IS NOT NULL
      AND bill_id IS NULL AND income_rule_id IS NULL AND loan_id IS NULL AND card_id IS NULL
      AND source_card_id IS NULL AND necessity IS NULL AND excluded = FALSE)
    OR
    -- Thu về từ khoản cho vay là income DUY NHẤT được excluded.
    (type = 'income' AND saving_goal_id IS NULL AND bill_id IS NULL AND loan_id IS NULL
      AND card_id IS NULL AND source_card_id IS NULL AND necessity IS NULL
      AND (excluded = FALSE OR lending_id IS NOT NULL))
    OR
    (type = 'expense' AND saving_goal_id IS NULL AND income_rule_id IS NULL
      AND (excluded = TRUE OR necessity IS NOT NULL))
  );

ALTER TABLE finance_transactions
  ADD CONSTRAINT finance_tx_excluded_scope CHECK (
    excluded = FALSE
    OR (loan_id IS NOT NULL AND loan_part = 'principal')
    OR (card_id IS NOT NULL AND card_period IS NOT NULL)
    OR lending_id IS NOT NULL
  );

-- Một giao dịch thu về không đồng thời là kỳ hóa đơn/vay/thẻ/quỹ nào khác.
ALTER TABLE finance_transactions
  ADD CONSTRAINT finance_tx_lending_scope CHECK (
    lending_id IS NULL
    OR (type = 'income' AND excluded = TRUE
        AND NUM_NONNULLS(bill_id, income_rule_id, loan_id, card_id, saving_goal_id) = 0)
  );

-- ── 4. Ownership guard cho khóa ngoại mới ────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_validate_transaction_references()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_card_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_cards WHERE id = NEW.source_card_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Source card does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.card_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_cards WHERE id = NEW.card_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Statement card does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.bill_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_bills WHERE id = NEW.bill_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Bill does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.income_rule_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_income_rules WHERE id = NEW.income_rule_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Income rule does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.loan_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_loans WHERE id = NEW.loan_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Loan does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.lending_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_lendings WHERE id = NEW.lending_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Lending does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.saving_goal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_saving_goals WHERE id = NEW.saving_goal_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Saving goal does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.shortcut_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_shortcuts WHERE id = NEW.shortcut_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Shortcut does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.task_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_tasks WHERE id = NEW.task_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Task does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.inbox_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM collections WHERE id = NEW.inbox_item_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Inbox item does not belong to this user' USING ERRCODE = '23503'; END IF;

  RETURN NEW;
END;
$$;

-- ── 5. RPC ghi một lần thu về ────────────────────────────────────────────────
-- App không tự thu hộ: user bấm, chọn số tiền và ngày nhận thật thì mới có
-- giao dịch. Thu đủ gốc thì khoản tự đóng.
CREATE OR REPLACE FUNCTION finance_record_lending_repayment(
  p_lending_id UUID,
  p_amount BIGINT,
  p_occurred_at DATE DEFAULT CURRENT_DATE,
  p_task_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_lend finance_lendings%ROWTYPE;
  v_got BIGINT;
  v_tx_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_occurred_at IS NULL THEN RAISE EXCEPTION 'Received date is required' USING ERRCODE = '22023'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'A positive repayment amount is required' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_lend FROM finance_lendings
  WHERE id = p_lending_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lending not found' USING ERRCODE = 'P0002'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_got
  FROM finance_transactions
  WHERE lending_id = v_lend.id AND user_id = v_user;

  IF v_got + p_amount > v_lend.principal THEN
    RAISE EXCEPTION 'Repayment exceeds the outstanding amount' USING ERRCODE = '23514';
  END IF;

  INSERT INTO finance_transactions (
    user_id, amount, occurred_at, type, category_id, excluded, note, lending_id, task_id
  ) VALUES (
    v_user, p_amount, p_occurred_at, 'income', 'hoantien', TRUE, v_lend.name, v_lend.id, p_task_id
  ) RETURNING id INTO v_tx_id;

  UPDATE finance_lendings
  SET closed_at = CASE WHEN v_got + p_amount >= principal THEN NOW() ELSE NULL END
  WHERE id = v_lend.id;

  RETURN v_tx_id;
END;
$$;

-- ── 6. RLS và grants ─────────────────────────────────────────────────────────
ALTER TABLE finance_lendings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_lendings_own ON finance_lendings;
CREATE POLICY finance_lendings_own ON finance_lendings FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RLS không bảo vệ TRUNCATE: thu hồi ACL mặc định trước rồi cấp đúng verb app dùng.
REVOKE ALL ON TABLE finance_lendings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE finance_lendings TO authenticated;
GRANT ALL ON TABLE finance_lendings TO service_role;

REVOKE ALL ON FUNCTION finance_record_lending_repayment(UUID, BIGINT, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finance_record_lending_repayment(UUID, BIGINT, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_record_lending_repayment(UUID, BIGINT, DATE, UUID) TO service_role;

-- ── VERIFY ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'finance_transactions'
                   AND column_name = 'lending_id') THEN
    RAISE EXCEPTION 'Lending migration failed: finance_transactions.lending_id is missing.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'finance_transactions'::regclass
                   AND conname IN ('finance_tx_branch_shape', 'finance_tx_excluded_scope', 'finance_tx_lending_scope')
                 HAVING COUNT(*) = 3) THEN
    RAISE EXCEPTION 'Lending migration failed: named transaction constraints were not rebuilt.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class
                 WHERE relname = 'finance_lendings' AND relrowsecurity) THEN
    RAISE EXCEPTION 'Lending migration failed: RLS is not enabled on finance_lendings.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE table_name = 'finance_lendings' AND grantee = 'anon') THEN
    RAISE EXCEPTION 'Lending migration failed: anon still has access to finance_lendings.';
  END IF;
END
$$;

COMMIT;

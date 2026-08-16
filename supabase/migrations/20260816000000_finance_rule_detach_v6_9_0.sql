-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: XÓA QUY TẮC KHÔNG XÓA GIAO DỊCH v6.9.0
-- Run after migration_v6.4.0_finance_lending.sql.
--
-- BUG đang sửa: hợp đồng (DESIGN_FINANCE — "Xóa quy tắc không xóa transaction;
-- hộp xác nhận nói đúng số giao dịch được giữ lại") nói xóa hóa đơn/khoản vay/thẻ
-- vẫn giữ giao dịch đã ghi. Nhưng năm khóa ngoại trên finance_transactions —
-- bill_id, income_rule_id, loan_id, card_id, source_card_id — đều là
-- ON DELETE RESTRICT, nên xóa THẤT BẠI HOÀN TOÀN khi đã có dù chỉ một giao dịch.
-- Hộp xác nhận hứa "N giao dịch vẫn được giữ lại", bấm Xóa xong không có gì xảy ra.
--
-- Cách sửa: đổi năm FK sang ON DELETE SET NULL. Riêng cột "kỳ" đi kèm phải SỐNG
-- SÓT được khi id bị null, vì hai lý do:
--   1. CHECK cặp hiện tại bắt id và kỳ cùng NULL hoặc cùng NOT NULL, nên RI action
--      SET NULL sẽ vi phạm CHECK và lệnh xóa vẫn hỏng — chỉ đổi FK là chưa đủ.
--   2. `loan_part = 'principal'` và `card_period` LÀ BẰNG CHỨNG khiến giao dịch
--      được phép `excluded` (trả nợ gốc, trả sao kê không phải chi tiêu mới). Null
--      chúng đi thì giao dịch buộc phải quay về excluded = FALSE, tức là trả nợ gốc
--      đột nhiên bị tính thành chi tiêu — sai số báo cáo còn tệ hơn bug gốc.
-- Nên: nới CHECK cặp cho phép kỳ đứng một mình, và `finance_tx_excluded_scope` soi
-- `loan_part`/`card_period` thay vì soi id. Không nới rộng quyền excluded: hai cột
-- này vẫn chỉ do RPC thanh toán ghi, y như trước.
--
-- KHÔNG đổi (cố ý, không phải bỏ sót):
--   · `saving_goal_id` giữ RESTRICT — `finance_tx_branch_shape` bắt type='saving'
--     phải có quỹ, một khoản gửi quỹ mất quỹ là dữ liệu vô nghĩa.
--   · `lending_id` đã là SET NULL nhưng xóa khoản cho vay VẪN hỏng: income được
--     excluded chỉ khi còn lending_id, mà khoản cho vay không có cột kỳ nào để giữ
--     lại làm bằng chứng. Sửa nó = nới invariant "chỉ thu về từ cho vay mới được
--     excluded" → cần user quyết định riêng, không gộp vào migration này.
--
-- Idempotent: thuần DDL, chạy lại cho ra đúng cùng một trạng thái. Không đụng data
-- và chỉ NỚI ràng buộc nên mọi dòng đang có đều thỏa CHECK mới.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'finance_transactions') THEN
    RAISE EXCEPTION
      'Rule detach migration refused: finance_transactions is missing. Run migration_v6.0.0_finance.sql first.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'finance_transactions'::regclass
                   AND conname = 'finance_tx_excluded_scope') THEN
    RAISE EXCEPTION
      'Rule detach migration refused: finance_tx_excluded_scope is missing. Run migration_v6.4.0_finance_lending.sql first.';
  END IF;
END
$$;

-- ── 1. Nới bốn CHECK cặp id↔kỳ ───────────────────────────────────────────────
-- Bốn constraint gốc do v6.0.0 khai inline nên không có tên; tìm theo định nghĩa
-- (chỉ chúng nhắc tới `*_period` trong nhóm constraint không tên), drop rồi dựng
-- lại CÓ TÊN để migration sau sửa được. Ba constraint đã có tên từ v6.4.0 được
-- loại trừ tường minh vì `finance_tx_excluded_scope` cũng nhắc `card_period`.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'finance_transactions'::regclass
      AND contype = 'c'
      AND conname NOT IN ('finance_tx_branch_shape', 'finance_tx_excluded_scope',
                          'finance_tx_lending_scope')
  LOOP
    IF c.def LIKE '%bill_period%' OR c.def LIKE '%income_period%'
       OR c.def LIKE '%loan_period%' OR c.def LIKE '%card_period%' THEN
      EXECUTE FORMAT('ALTER TABLE finance_transactions DROP CONSTRAINT %I', c.conname);
    END IF;
  END LOOP;
END
$$;

ALTER TABLE finance_transactions
  -- Có id thì bắt buộc có kỳ; kỳ mồ côi (quy tắc đã bị xóa) được phép ở lại làm lịch sử.
  ADD CONSTRAINT finance_tx_bill_shape CHECK (
    (bill_id IS NULL OR bill_period IS NOT NULL)
    AND (bill_period IS NULL OR bill_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
  ),
  ADD CONSTRAINT finance_tx_income_shape CHECK (
    (income_rule_id IS NULL OR income_period IS NOT NULL)
    AND (income_period IS NULL OR income_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
  ),
  ADD CONSTRAINT finance_tx_loan_shape CHECK (
    (loan_id IS NULL OR (loan_period IS NOT NULL AND loan_part IS NOT NULL))
    AND (loan_period IS NULL OR loan_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
  ),
  ADD CONSTRAINT finance_tx_card_shape CHECK (
    (card_id IS NULL OR card_period IS NOT NULL)
    AND (card_period IS NULL OR card_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
  );

-- ── 2. `excluded` soi bằng chứng nghiệp vụ, không soi khóa ngoại ─────────────
-- Cùng ba trường hợp như trước (trả gốc vay · trả sao kê thẻ · thu về từ cho vay),
-- chỉ khác là hai trường hợp đầu nhận diện qua cột kỳ/phần — thứ sống sót sau khi
-- quy tắc bị xóa. Cả `loan_part` lẫn `card_period` đều chỉ do RPC thanh toán ghi.
ALTER TABLE finance_transactions DROP CONSTRAINT IF EXISTS finance_tx_excluded_scope;
ALTER TABLE finance_transactions
  ADD CONSTRAINT finance_tx_excluded_scope CHECK (
    excluded = FALSE
    OR loan_part = 'principal'
    OR card_period IS NOT NULL
    OR lending_id IS NOT NULL
  );

-- ── 3. Năm khóa ngoại quy tắc: RESTRICT → SET NULL ───────────────────────────
-- Tên constraint do Postgres tự đặt lúc khai inline nên tra theo cột thay vì đoán tên.
DO $$
DECLARE
  v_col TEXT;
  v_con TEXT;
  v_ref TEXT;
BEGIN
  FOREACH v_col IN ARRAY ARRAY['bill_id', 'income_rule_id', 'loan_id', 'card_id', 'source_card_id']
  LOOP
    SELECT c.conname, cl.relname INTO v_con, v_ref
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.confrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'finance_transactions'::regclass
      AND c.contype = 'f'
      AND ARRAY_LENGTH(c.conkey, 1) = 1
      AND a.attname = v_col;

    IF v_con IS NULL THEN
      RAISE EXCEPTION 'Rule detach migration refused: no foreign key on finance_transactions.%', v_col;
    END IF;

    EXECUTE FORMAT('ALTER TABLE finance_transactions DROP CONSTRAINT %I', v_con);
    EXECUTE FORMAT(
      'ALTER TABLE finance_transactions ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE SET NULL',
      v_con, v_col, v_ref);
  END LOOP;
END
$$;

-- ── 4. Verify ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_bad TEXT;
BEGIN
  SELECT STRING_AGG(a.attname, ', ' ORDER BY a.attname) INTO v_bad
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.conrelid = 'finance_transactions'::regclass
    AND c.contype = 'f'
    AND a.attname IN ('bill_id', 'income_rule_id', 'loan_id', 'card_id', 'source_card_id')
    AND c.confdeltype <> 'n';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Rule detach migration failed: % vẫn chặn xóa quy tắc.', v_bad;
  END IF;

  -- Quỹ tiết kiệm PHẢI giữ RESTRICT: giao dịch type='saving' không tồn tại nếu mất quỹ.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'finance_transactions'::regclass
      AND c.contype = 'f' AND a.attname = 'saving_goal_id' AND c.confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'Rule detach migration failed: saving_goal_id phải giữ ON DELETE RESTRICT.';
  END IF;
END
$$;

COMMIT;

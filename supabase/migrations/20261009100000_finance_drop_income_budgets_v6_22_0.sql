-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: GỠ THU ĐỊNH KỲ & HẠN MỨC KHỎI DATABASE v6.22.0
-- Run after migration_v6.22.0_body_exercise_videos.sql (cần v6.4.0 và v6.9.0 trước).
--
-- VÌ SAO: app không còn dùng hai tính năng này.
--   · Hạn mức (`finance_budgets`): màn đặt hạn mức gỡ từ 01/09/2026; frontend 10/2026
--     ngừng tải bảng.
--   · Thu định kỳ (`finance_income_rules` + RPC `finance_receive_income`): tab "Sẽ nhận"
--     gỡ 10/2026.
-- User đã đồng ý xóa (10/2026).
--
-- ⚠️ DỮ LIỆU MẤT VĨNH VIỄN: mọi dòng của `finance_income_rules` và `finance_budgets`.
-- Muốn giữ thì export CSV hai bảng trước. NOTICE ở bước 1 in số dòng sắp mất.
--
-- KHÔNG MẤT: giao dịch thu cũ do nút "Đã nhận" tạo ra vẫn là giao dịch thu bình thường.
-- Chỉ gỡ liên kết `income_rule_id` → NULL; `income_period` giữ lại làm dấu vết — đúng như
-- cách v6.9.0 xử lý khi xóa một quy tắc (CHECK cặp đã cho phép kỳ đứng một mình).
-- Trigger `updated_at` sẽ đổi `updated_at` của các giao dịch đó sang lúc chạy migration.
--
-- THỨ TỰ TRIỂN KHAI: deploy frontend mới (không còn select hai bảng) TRƯỚC, chạy file này
-- SAU. Frontend cũ — kể cả bản PWA còn trong cache — vẫn select hai bảng nên toàn bộ màn
-- Finance và Trang chủ sẽ báo lỗi tải dữ liệu cho tới khi tải lại bản mới.
--
-- CỐ Ý KHÔNG LÀM (không phải bỏ sót):
--   · Không DROP cột `finance_transactions.income_rule_id` / `income_period`. Postgres tự
--     xóa luôn mọi CHECK nhiều cột có nhắc tới cột bị drop — `finance_tx_branch_shape`,
--     `finance_tx_lending_scope`, NUM_NONNULLS(bill, income, loan, card, saving)… — mà
--     không báo gì, tức là ràng buộc của hóa đơn/vay/thẻ/quỹ yếu đi âm thầm. Để cột rỗng
--     và chặn ghi lại bằng CHECK ở bước 5.
--   · Không xóa `finance_valid_income_category()`: giao dịch type='income' và override
--     danh mục thu vẫn dùng.
--   · Không DROP ... CASCADE: thứ gì phụ thuộc mà chưa biết thì thà lỗi còn hơn im lặng
--     kéo theo object khác. FK duy nhất trỏ vào `finance_income_rules` được gỡ tường minh.
--
-- Một transaction: lỗi ở bất kỳ bước nào thì database giữ nguyên như trước khi chạy.
-- Idempotent: chạy lại khi đã gỡ xong chỉ báo NOTICE, không lỗi.
-- Lưu ý: sau file này, chạy lại riêng v6.9.0 sẽ lỗi (nó đòi FK của income_rule_id) — v6.9.0
-- chỉ chạy một lần theo thứ tự trong README nên không ảnh hưởng.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Preflight + số dòng sắp mất ──────────────────────────────────────────
DO $$
DECLARE
  v_rules BIGINT := 0;
  v_budgets BIGINT := 0;
  v_linked BIGINT;
BEGIN
  IF to_regclass('public.finance_transactions') IS NULL THEN
    RAISE EXCEPTION 'Refused: finance_transactions is missing. Run migration_v6.0.0_finance.sql first.';
  END IF;
  IF to_regclass('public.finance_lendings') IS NULL THEN
    RAISE EXCEPTION 'Refused: finance_lendings is missing. Run migration_v6.4.0_finance_lending.sql first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'finance_transactions'::regclass
                   AND conname = 'finance_tx_excluded_scope') THEN
    RAISE EXCEPTION 'Refused: finance_tx_excluded_scope is missing. Run migration_v6.9.0_finance_rule_detach.sql first.';
  END IF;

  IF to_regclass('public.finance_income_rules') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.finance_income_rules' INTO v_rules;
  END IF;
  IF to_regclass('public.finance_budgets') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.finance_budgets' INTO v_budgets;
  END IF;
  SELECT COUNT(*) INTO v_linked FROM finance_transactions WHERE income_rule_id IS NOT NULL;

  RAISE NOTICE 'Sẽ xóa % quy tắc thu định kỳ và % dòng hạn mức; % giao dịch thu được gỡ liên kết (giao dịch giữ nguyên).',
    v_rules, v_budgets, v_linked;
END
$$;

-- ── 2. Hai hàm trigger: bỏ nhánh thu định kỳ ────────────────────────────────
-- Nguyên văn bản hiện hành (v6.4.0 cho hàm kiểm tra tham chiếu, v6.0.0 cho hàm đồng bộ
-- tiến độ), chỉ bớt đúng nhánh `income_rule_id`. Phải làm TRƯỚC khi drop bảng: hai hàm
-- này đọc/ghi `finance_income_rules` mỗi khi giao dịch có `income_rule_id`, kể cả lúc
-- bước 3 gỡ liên kết. CREATE OR REPLACE giữ nguyên quyền (REVOKE … FROM PUBLIC) và trigger.
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

CREATE OR REPLACE FUNCTION finance_sync_transaction_rule_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old_bill UUID;
  v_new_bill UUID;
  v_old_loan UUID;
  v_new_loan UUID;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_bill := OLD.bill_id;
    v_old_loan := OLD.loan_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_bill := NEW.bill_id;
    v_new_loan := NEW.loan_id;
  END IF;

  PERFORM finance_refresh_bill_progress(v_old_bill);
  IF v_new_bill IS DISTINCT FROM v_old_bill THEN PERFORM finance_refresh_bill_progress(v_new_bill); END IF;
  PERFORM finance_refresh_loan_progress(v_old_loan);
  IF v_new_loan IS DISTINCT FROM v_old_loan THEN PERFORM finance_refresh_loan_progress(v_new_loan); END IF;

  RETURN NULL;
END;
$$;

-- ── 3. Gỡ liên kết giao dịch thu khỏi quy tắc (giao dịch giữ nguyên) ─────────
UPDATE finance_transactions SET income_rule_id = NULL WHERE income_rule_id IS NOT NULL;

-- ── 4. Drop RPC, hàm phụ, index, FK rồi hai bảng — không CASCADE ─────────────
DROP FUNCTION IF EXISTS finance_receive_income(UUID, BIGINT, DATE, UUID, TEXT);
DROP FUNCTION IF EXISTS finance_receive_income(UUID, BIGINT, DATE, UUID);
DROP FUNCTION IF EXISTS finance_refresh_income_progress(UUID);

DROP INDEX IF EXISTS unique_finance_tx_income_period;
DROP INDEX IF EXISTS idx_finance_tx_income;

DO $$
DECLARE
  v_con TEXT;
BEGIN
  IF to_regclass('public.finance_income_rules') IS NULL THEN
    RAISE NOTICE 'finance_income_rules không tồn tại — đã gỡ trước đó.';
    RETURN;
  END IF;
  -- Tên FK do v6.9.0 dựng lại; tìm theo bảng đích thay vì đoán tên.
  FOR v_con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'finance_transactions'::regclass
      AND contype = 'f'
      AND confrelid = 'public.finance_income_rules'::regclass
  LOOP
    EXECUTE FORMAT('ALTER TABLE finance_transactions DROP CONSTRAINT %I', v_con);
  END LOOP;
END
$$;

DROP TABLE IF EXISTS public.finance_income_rules;
DROP TABLE IF EXISTS public.finance_budgets;

-- ── 5. Fail-closed: không còn bảng nào để `income_rule_id` trỏ tới ────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'finance_transactions'::regclass
                   AND conname = 'finance_tx_income_rule_retired') THEN
    ALTER TABLE finance_transactions
      ADD CONSTRAINT finance_tx_income_rule_retired CHECK (income_rule_id IS NULL);
  END IF;
END
$$;

-- ── 6. Verify ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def TEXT;
BEGIN
  IF to_regclass('public.finance_income_rules') IS NOT NULL
     OR to_regclass('public.finance_budgets') IS NOT NULL THEN
    RAISE EXCEPTION 'Drop migration failed: finance_income_rules / finance_budgets vẫn còn.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND p.proname IN ('finance_receive_income', 'finance_refresh_income_progress')) THEN
    RAISE EXCEPTION 'Drop migration failed: RPC/hàm thu định kỳ vẫn còn.';
  END IF;

  IF EXISTS (SELECT 1 FROM finance_transactions WHERE income_rule_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Drop migration failed: còn giao dịch trỏ income_rule_id.';
  END IF;

  FOR v_def IN
    SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('finance_validate_transaction_references', 'finance_sync_transaction_rule_progress')
  LOOP
    IF v_def ILIKE '%income%' THEN
      RAISE EXCEPTION 'Drop migration failed: hàm trigger vẫn nhắc tới thu định kỳ.';
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'finance_transactions'::regclass
                   AND conname = 'finance_tx_income_rule_retired') THEN
    RAISE EXCEPTION 'Drop migration failed: thiếu CHECK finance_tx_income_rule_retired.';
  END IF;

  -- Giao dịch thu và override danh mục thu vẫn cần hàm này.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'finance_valid_income_category') THEN
    RAISE EXCEPTION 'Drop migration failed: finance_valid_income_category() bị mất.';
  END IF;
END
$$;

COMMIT;

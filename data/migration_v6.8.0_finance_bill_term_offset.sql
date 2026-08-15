-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: KỲ ĐÃ TRẢ TRƯỚC KHI DÙNG APP v6.8.0
-- Run after migration_v6.0.0_finance.sql.
--
-- BUG đang sửa: `finance_bills.term_done` có HAI nguồn ghi cãi nhau.
--   1. User gõ tay ô "Đã trả bao nhiêu kỳ" khi khai một khoản trả góp đang chạy dở
--      (3/6 kỳ đã trả từ trước, không có giao dịch nào trong app).
--   2. Trigger `finance_transaction_progress_sync` → `finance_refresh_bill_progress()`
--      ghi đè `term_done = COUNT(*) giao dịch`.
-- Nên bấm Thanh toán lần đầu là số 3 bị thay bằng 1: trả thêm một kỳ mà tiến độ
-- LÙI LẠI, và số tiền còn nợ vọt lên. Không có đường nào cứu vì trigger chạy ở DB.
--
-- Cách sửa: tách hai dữ liệu vốn khác nhau.
--   `term_offset` = số kỳ đã trả TRƯỚC khi dùng app (user gõ, app không đụng).
--   `term_done`   = term_offset + số giao dịch (thuần suy ra, không ai gõ tay nữa).
--
-- Backfill giữ nguyên số user đã nhập: offset = term_done - số giao dịch hiện có.
-- Idempotent: chạy lại nhiều lần không cộng dồn (backfill chỉ chạy khi cột vừa được
-- thêm), và bước tính lại `term_done` cuối file luôn cho ra cùng một kết quả.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'finance_bills') THEN
    RAISE EXCEPTION
      'Term offset migration refused: finance_bills is missing. Run migration_v6.0.0_finance.sql first.';
  END IF;
END
$$;

-- 1. Cột mới + backfill (chỉ lần đầu, khi cột chưa tồn tại).
DO $$
DECLARE
  v_fresh BOOLEAN := NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finance_bills' AND column_name = 'term_offset'
  );
BEGIN
  IF v_fresh THEN
    ALTER TABLE finance_bills
      ADD COLUMN term_offset INT NOT NULL DEFAULT 0 CHECK (term_offset >= 0);

    UPDATE finance_bills b
    SET term_offset = GREATEST(0, COALESCE(b.term_done, 0) - (
      SELECT COUNT(*) FROM finance_transactions t WHERE t.bill_id = b.id
    ));
  END IF;
END
$$;

COMMENT ON COLUMN finance_bills.term_offset IS
  'Số kỳ đã trả TRƯỚC khi dùng app (user nhập). term_done = term_offset + số giao dịch.';

-- 2. Trigger cộng offset thay vì ghi đè bằng số giao dịch.
CREATE OR REPLACE FUNCTION finance_refresh_bill_progress(p_bill_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_total INT;
BEGIN
  IF p_bill_id IS NULL THEN RETURN; END IF;
  SELECT COUNT(*)::INT INTO v_count
  FROM finance_transactions WHERE bill_id = p_bill_id;

  -- Kỳ trả trước khi dùng app CỘNG vào, không bị số giao dịch xoá đi.
  SELECT COALESCE(term_offset, 0) + v_count INTO v_total
  FROM finance_bills WHERE id = p_bill_id;

  UPDATE finance_bills
  SET term_done = LEAST(COALESCE(term_total, v_total), v_total),
      finished_at = CASE
        WHEN finished_at IS NOT NULL THEN finished_at
        WHEN term_total IS NOT NULL AND v_total >= term_total THEN NOW()
        ELSE NULL
      END
  WHERE id = p_bill_id;
END;
$$;

REVOKE ALL ON FUNCTION finance_refresh_bill_progress(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finance_refresh_bill_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_refresh_bill_progress(UUID) TO service_role;

-- 3. Tính lại toàn bộ để term_done khớp công thức mới ngay lập tức.
DO $$
DECLARE
  v_bill UUID;
BEGIN
  FOR v_bill IN SELECT id FROM finance_bills LOOP
    PERFORM finance_refresh_bill_progress(v_bill);
  END LOOP;
END
$$;

-- 4. Verify: cột có thật, và không hóa đơn nào lệch công thức.
DO $$
DECLARE
  v_bad INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finance_bills' AND column_name = 'term_offset'
  ) THEN
    RAISE EXCEPTION 'Term offset migration failed: finance_bills.term_offset is missing.';
  END IF;

  SELECT COUNT(*) INTO v_bad
  FROM finance_bills b
  WHERE b.term_done <> LEAST(
    COALESCE(b.term_total, b.term_offset + (SELECT COUNT(*) FROM finance_transactions t WHERE t.bill_id = b.id)),
    b.term_offset + (SELECT COUNT(*) FROM finance_transactions t WHERE t.bill_id = b.id)
  );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Term offset migration failed: % bill(s) still out of sync.', v_bad;
  END IF;
END
$$;

COMMIT;

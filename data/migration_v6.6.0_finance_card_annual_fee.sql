-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: NGÀY THU PHÍ THƯỜNG NIÊN v6.6.0
-- Run after migration_v6.0.0_finance.sql.
--
-- Thêm `finance_cards.annual_fee_on`: ngày ngân hàng thu phí thường niên.
-- Trước đó app chỉ biết SỐ TIỀN phí (`annual_fee`) chứ không biết ngày, nên phí
-- luôn về bất ngờ — mà đây là khoản duy nhất của thẻ có thể xin miễn/giảm NẾU gọi
-- trước ngày thu.
--
-- Kiểu DATE (không phải INT ngày-trong-tháng như statement_day/due_day): phí lặp
-- MỖI NĂM nên cần cả tháng, và ngày thu thường là ngày mở thẻ.
-- NULL = không theo dõi, thẻ đang có không phải sửa gì.
-- Idempotent: chạy lại nhiều lần không hỏng gì.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'finance_cards') THEN
    RAISE EXCEPTION
      'Annual fee migration refused: finance_cards is missing. Run migration_v6.0.0_finance.sql first.';
  END IF;
END
$$;

ALTER TABLE finance_cards
  ADD COLUMN IF NOT EXISTS annual_fee_on DATE;

COMMENT ON COLUMN finance_cards.annual_fee_on IS
  'Ngày thu phí thường niên; lặp lại đúng ngày/tháng này mỗi năm. NULL = không nhắc.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finance_cards'
      AND column_name = 'annual_fee_on' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Annual fee migration failed: finance_cards.annual_fee_on is missing or NOT NULL.';
  END IF;
END
$$;

COMMIT;

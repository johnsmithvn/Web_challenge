-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: HÓA ĐƠN NHIỀU THÁNG MỘT LẦN v6.7.0
-- Run after migration_v6.0.0_finance.sql.
--
-- Thêm `finance_bills.anchor_date`: ngày bắt đầu trả, dùng để biết THÁNG NÀO tới
-- lượt khi hóa đơn không chạy hằng tháng (Netflix trả 3 tháng/lần, bảo hiểm theo
-- năm...). Chu kỳ nằm ở `rrule.every` — `finance_valid_rrule` không cấm key thừa
-- nên `{"type":"monthly","day":5,"every":3}` đã hợp lệ sẵn, không phải sửa CHECK.
--
-- `due_day` giữ nguyên NOT NULL và vẫn là NGÀY trong tháng: ngày cố định thắng,
-- `anchor_date` chỉ quyết định tháng. Hóa đơn nhập không có ngày cố định thì app
-- lấy ngày của `anchor_date` điền vào `due_day`.
--
-- Kỳ vẫn là 'YYYY-MM' nên `finance_transactions.bill_period` và
-- `unique_finance_tx_bill_period` KHÔNG đổi — mỗi tháng vẫn tối đa một kỳ.
-- NULL = hóa đơn hằng tháng như cũ. Idempotent.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'finance_bills') THEN
    RAISE EXCEPTION
      'Multi-month bill migration refused: finance_bills is missing. Run migration_v6.0.0_finance.sql first.';
  END IF;
END
$$;

ALTER TABLE finance_bills
  ADD COLUMN IF NOT EXISTS anchor_date DATE;

COMMENT ON COLUMN finance_bills.anchor_date IS
  'Ngày bắt đầu trả. Mốc đếm chu kỳ rrule.every tháng; NULL = hằng tháng. Ngày trong tháng vẫn lấy theo due_day.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finance_bills'
      AND column_name = 'anchor_date' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Multi-month bill migration failed: finance_bills.anchor_date is missing or NOT NULL.';
  END IF;
END
$$;

COMMIT;

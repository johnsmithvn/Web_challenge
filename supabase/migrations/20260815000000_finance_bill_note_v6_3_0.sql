-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: GHI CHÚ HÓA ĐƠN v6.3.0
-- Run after migration_v6.0.0_finance.sql.
--
-- Thêm đúng một cột: `finance_bills.note` — chỗ chứa mọi thứ không đáng có
-- trường riêng (số công tơ, ai đứng tên, cách chia tiền với bạn cùng phòng).
-- Không index, không tính toán, và KHÔNG sao chép xuống giao dịch:
-- `finance_pay_bill` vẫn ghi `note = v_bill.name` như trước, không đụng tới cột
-- này. Nếu ghi chú rơi xuống từng kỳ thì mỗi giao dịch mang một bản sao giống
-- hệt, làm rối màn Giao dịch và bảng lọc.
--
-- Idempotent: chạy lại nhiều lần không hỏng gì. Không đụng dữ liệu đang có.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'finance_bills') THEN
    RAISE EXCEPTION
      'Bill note migration refused: finance_bills is missing. Run migration_v6.0.0_finance.sql first.';
  END IF;
END
$$;

ALTER TABLE finance_bills
  ADD COLUMN IF NOT EXISTS note TEXT;

COMMENT ON COLUMN finance_bills.note IS
  'Ghi chú của quy tắc hóa đơn. Không sao chép xuống finance_transactions.';

-- VERIFY: cột phải tồn tại và nullable (hóa đơn cũ không có ghi chú vẫn hợp lệ).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finance_bills'
      AND column_name = 'note' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Bill note migration failed: finance_bills.note is missing or NOT NULL.';
  END IF;
END
$$;

COMMIT;

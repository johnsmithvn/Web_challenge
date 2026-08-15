-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: ICON RIÊNG CHO HÓA ĐƠN v6.5.0
-- Run after migration_v6.0.0_finance.sql.
--
-- Thêm `finance_bills.icon`: người dùng tự chọn icon cho từng hóa đơn.
-- Trước đó icon suy từ nhóm danh mục, nên ba đồng hồ điện, tiền nước, internet và
-- tiền thuê nhà đều thuộc "Nhà ở & Hóa đơn" → hiện CÙNG một icon, mắt không phân
-- biệt được dòng nào là dòng nào khi quét danh sách.
--
-- NULL = dùng icon của nhóm như cũ, nên hóa đơn đang có không phải sửa gì.
-- Giá trị là khóa icon của app (`lightning`, `drop`, `wifi`…), không phải class CSS.
-- Idempotent: chạy lại nhiều lần không hỏng gì.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'finance_bills') THEN
    RAISE EXCEPTION
      'Bill icon migration refused: finance_bills is missing. Run migration_v6.0.0_finance.sql first.';
  END IF;
END
$$;

ALTER TABLE finance_bills
  ADD COLUMN IF NOT EXISTS icon TEXT CHECK (icon IS NULL OR BTRIM(icon) <> '');

COMMENT ON COLUMN finance_bills.icon IS
  'Khóa icon do user chọn. NULL = suy từ category_id như trước.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finance_bills'
      AND column_name = 'icon' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Bill icon migration failed: finance_bills.icon is missing or NOT NULL.';
  END IF;
END
$$;

COMMIT;

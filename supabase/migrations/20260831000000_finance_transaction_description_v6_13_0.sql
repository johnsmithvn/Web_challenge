-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: GHI CHÚ TỰ DO CHO GIAO DỊCH v6.13.0
--
-- Thêm cột `finance_transactions.description TEXT`:
-- Chỗ ghi chú tự do (nhiều dòng), tách biệt với tiêu đề ngắn (`note`).
-- Tiêu đề ngắn vẫn hiển thị trên danh sách; ghi chú tự do chứa chi tiết,
-- diễn giải hoặc lưu ý không giới hạn.
--
-- Idempotent: chạy lại nhiều lần an toàn, không đụng dữ liệu cũ.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'finance_transactions') THEN
    RAISE EXCEPTION
      'Transaction description migration refused: finance_transactions is missing. Run migration_v6.0.0_finance.sql first.';
  END IF;
END
$$;

ALTER TABLE finance_transactions
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN finance_transactions.description IS
  'Ghi chú tự do của giao dịch, tách biệt với tiêu đề ngắn (note). Cho phép viết nhiều dòng.';

-- VERIFY: cột phải tồn tại và nullable (giao dịch cũ không có ghi chú vẫn hợp lệ).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finance_transactions'
      AND column_name = 'description' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Transaction description migration failed: finance_transactions.description is missing or NOT NULL.';
  END IF;
END
$$;

COMMIT;

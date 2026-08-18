-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: LÃI MẤT DO RÚT TIẾT KIỆM TRƯỚC HẠN v6.9.1
-- Run after migration_v6.4.0_finance_lending.sql.
--
-- VẤN ĐỀ: khoản cho vay chỉ có `rate` (%/năm), và mọi phép tính đều nhân nó với SỐ
-- NGÀY CHO VAY. Nhưng khi phải đập một sổ tiết kiệm trước hạn để có tiền cho vay,
-- tổn thất thật KHÔNG sinh ra trong mấy ngày đó: nó là toàn bộ lãi đã tích của sổ
-- tiết kiệm, mất một lần đúng lúc rút. Gửi 100tr kỳ 6 tháng lãi 9%/năm, đã gửi 153
-- ngày rồi rút để cho vay 30 ngày → mất 3.772.603đ (lãi sổ) trong khi lãi 30 ngày
-- cho vay chỉ 739.726đ.
--
-- Ép cục tiền đó vào ô %/năm thì phải gõ 54,9%/năm — và sai ngay khi đổi ngày hẹn:
-- người vay trả muộn 10 ngày là app tính thêm 54,9% cho 10 ngày đó.
--
-- Nên cần một cột TIỀN TUYỆT ĐỐI, cộng vào tổng phải thu và KHÔNG nhân với số ngày.
--
-- Migration additive thuần: một cột mới có DEFAULT, không đụng constraint, RPC hay
-- dữ liệu sẵn có. Khoản cho vay cũ mang giá trị 0 và hành xử y như trước.
-- Idempotent: chạy lại nhiều lần không hỏng gì.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Preflight ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'finance_lendings') THEN
    RAISE EXCEPTION
      'Forfeited-interest migration refused: finance_lendings is missing. Run migration_v6.4.0_finance_lending.sql first.';
  END IF;
END
$$;

-- ── 1. Cột lãi mất do rút sớm ────────────────────────────────────────────────
ALTER TABLE finance_lendings
  ADD COLUMN IF NOT EXISTS forfeited_interest BIGINT NOT NULL DEFAULT 0;

-- CHECK tách riêng để lần chạy thứ hai (cột đã có) vẫn gắn được ràng buộc.
ALTER TABLE finance_lendings
  DROP CONSTRAINT IF EXISTS finance_lendings_forfeited_nonneg;
ALTER TABLE finance_lendings
  ADD CONSTRAINT finance_lendings_forfeited_nonneg CHECK (forfeited_interest >= 0);

COMMENT ON COLUMN finance_lendings.forfeited_interest IS
  'Lãi bị mất khi đập tiết kiệm trước hạn để có tiền cho vay. Tiền tuyệt đối, cộng vào tổng phải thu và KHÔNG nhân với số ngày như rate.';

-- ── VERIFY ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- KHÔNG so `column_default` với chuỗi '0': Postgres lưu default của cột BIGINT thành
  -- `'0'::bigint`, nên so chuỗi là VERIFY tự đánh sập một migration hoàn toàn đúng. Kiểm
  -- như các migration ADD COLUMN khác của repo: cột có, NOT NULL, và có default.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'finance_lendings'
                   AND column_name = 'forfeited_interest' AND is_nullable = 'NO'
                   AND column_default IS NOT NULL) THEN
    RAISE EXCEPTION 'Forfeited-interest migration failed: column is missing, nullable or has no default.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'finance_lendings'::regclass
                   AND conname = 'finance_lendings_forfeited_nonneg') THEN
    RAISE EXCEPTION 'Forfeited-interest migration failed: non-negative CHECK is missing.';
  END IF;
END
$$;

COMMIT;

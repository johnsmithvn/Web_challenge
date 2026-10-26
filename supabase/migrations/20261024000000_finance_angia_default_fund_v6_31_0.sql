-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: TÍCH LŨY AN GIA + QUỸ TÍCH LŨY CHUNG v6.31.0
-- Run after migration_v6.0.0_finance.sql.
--
-- 1. Quỹ "Tích lũy chung" (`finance_saving_goals.is_default`): mọi nơi gửi đều phải thuộc
--    một quỹ (`finance_deposits.fund_id NOT NULL`). Trước đây chọn "Không gắn mục tiêu"
--    thì app nhét nơi gửi vào quỹ tạo gần nhất (kể cả quỹ đã đóng). Giờ có đúng một quỹ
--    mặc định đang mở mỗi user, app tự tạo khi cần. Quỹ cũ giữ nguyên, không backfill.
--
-- 2. Gói Tích lũy An Gia (`finance_deposits.monthly_amount` + `initial_amount`): gửi lần
--    đầu X (`initial_amount`), mỗi tháng góp đúng Y (`monthly_amount`), có kỳ hạn (năm,
--    lưu ở `term` theo tháng như mọi sổ nên `matures_at` không đổi). `amount` vẫn là số
--    đang gửi thật, tăng theo mỗi lần góp; giữ X riêng để biết đã góp đủ tới kỳ nào.
--    Hai cột đi cặp: cùng NULL (sổ thường) hoặc cùng có giá trị + có kỳ hạn.
--
-- Migration additive thuần: cột mới nullable / có DEFAULT, không đụng RPC hay dữ liệu
-- sẵn có. Sổ và quỹ cũ hành xử y như trước. RLS `FOR ALL` theo bảng nên phủ luôn cột mới.
-- Idempotent: chạy lại nhiều lần không hỏng gì.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Preflight ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.finance_saving_goals') IS NULL OR to_regclass('public.finance_deposits') IS NULL THEN
    RAISE EXCEPTION
      'An Gia migration refused: finance_saving_goals / finance_deposits is missing. Run migration_v6.0.0_finance.sql first.';
  END IF;
END
$$;

-- ── 1. Quỹ Tích lũy chung ────────────────────────────────────────────────────
ALTER TABLE finance_saving_goals
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- Một quỹ mặc định ĐANG MỞ mỗi user; đóng quỹ cũ thì app tạo quỹ mặc định mới được.
CREATE UNIQUE INDEX IF NOT EXISTS finance_goals_one_default
  ON finance_saving_goals(user_id) WHERE is_default AND closed_at IS NULL;

COMMENT ON COLUMN finance_saving_goals.is_default IS
  'Quỹ Tích lũy chung: nơi gửi không thuộc mục tiêu nào vào đây. Tối đa một quỹ mặc định đang mở mỗi user.';

-- ── 2. Gói Tích lũy An Gia ───────────────────────────────────────────────────
ALTER TABLE finance_deposits
  ADD COLUMN IF NOT EXISTS monthly_amount BIGINT,
  ADD COLUMN IF NOT EXISTS initial_amount BIGINT;

-- CHECK tách riêng để lần chạy thứ hai (cột đã có) vẫn gắn được ràng buộc.
ALTER TABLE finance_deposits
  DROP CONSTRAINT IF EXISTS finance_deposits_angia_shape;
ALTER TABLE finance_deposits
  ADD CONSTRAINT finance_deposits_angia_shape CHECK (
    (monthly_amount IS NULL AND initial_amount IS NULL)
    OR (monthly_amount > 0 AND initial_amount >= 0 AND term IS NOT NULL)
  );

COMMENT ON COLUMN finance_deposits.monthly_amount IS
  'Tích lũy An Gia: số tiền góp cố định mỗi tháng (Y). NULL = sổ thường.';
COMMENT ON COLUMN finance_deposits.initial_amount IS
  'Tích lũy An Gia: số gửi lần đầu (X). amount = X + các lần góp; số phải có tới kỳ k = X + Y × k.';

-- ── VERIFY ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'finance_saving_goals'
                   AND column_name = 'is_default' AND is_nullable = 'NO'
                   AND column_default IS NOT NULL) THEN
    RAISE EXCEPTION 'An Gia migration failed: finance_saving_goals.is_default is missing, nullable or has no default.';
  END IF;

  IF to_regclass('public.finance_goals_one_default') IS NULL THEN
    RAISE EXCEPTION 'An Gia migration failed: unique index finance_goals_one_default is missing.';
  END IF;

  IF (SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'finance_deposits'
        AND column_name IN ('monthly_amount', 'initial_amount')) <> 2 THEN
    RAISE EXCEPTION 'An Gia migration failed: finance_deposits.monthly_amount / initial_amount is missing.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'finance_deposits'::regclass
                   AND conname = 'finance_deposits_angia_shape') THEN
    RAISE EXCEPTION 'An Gia migration failed: CHECK finance_deposits_angia_shape is missing.';
  END IF;
END
$$;

COMMIT;

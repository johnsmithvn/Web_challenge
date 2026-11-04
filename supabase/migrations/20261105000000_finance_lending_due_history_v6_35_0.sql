-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: LỊCH SỬ LÙI HẸN KHOẢN CHO VAY v6.35.0
-- Run after 20260815010000_finance_lending_v6_4_0.sql.
--
-- VẤN ĐỀ: người vay xin khất thì cách duy nhất là bấm Sửa rồi đổi `due_on` — hẹn cũ
-- mất luôn, không biết đã khất mấy lần, vì sao.
--
-- Thêm một mảng JSONB trên chính dòng cho vay: mỗi lần bấm "Lùi hẹn" app đổi `due_on`
-- và nối một phần tử { from, to, reason, at } trong CÙNG một lệnh UPDATE. Không cần
-- bảng riêng: lịch sử chỉ đọc kèm khoản cho vay, RLS của bảng đã che sẵn.
--
-- Migration additive thuần: một cột mới có DEFAULT, không đụng constraint, RPC hay
-- dữ liệu sẵn có. Khoản cũ mang '[]'. Idempotent: chạy lại nhiều lần không hỏng gì.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Preflight ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'finance_lendings') THEN
    RAISE EXCEPTION
      'Due-history migration refused: finance_lendings is missing. Run the v6.4.0 lending migration first.';
  END IF;
END
$$;

-- ── 1. Cột lịch sử lùi hẹn ───────────────────────────────────────────────────
ALTER TABLE finance_lendings
  ADD COLUMN IF NOT EXISTS due_history JSONB NOT NULL DEFAULT '[]'::JSONB;

-- CHECK tách riêng để lần chạy thứ hai (cột đã có) vẫn gắn được ràng buộc.
ALTER TABLE finance_lendings
  DROP CONSTRAINT IF EXISTS finance_lendings_due_history_array;
ALTER TABLE finance_lendings
  ADD CONSTRAINT finance_lendings_due_history_array CHECK (JSONB_TYPEOF(due_history) = 'array');

COMMENT ON COLUMN finance_lendings.due_history IS
  'Các lần lùi hẹn: [{ from, to, reason, at }] theo thứ tự ghi. due_on luôn là hẹn hiện tại; sửa ngày qua hộp thoại Sửa không ghi vào đây.';

-- ── VERIFY ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'finance_lendings'
                   AND column_name = 'due_history' AND is_nullable = 'NO'
                   AND column_default IS NOT NULL) THEN
    RAISE EXCEPTION 'Due-history migration failed: column is missing, nullable or has no default.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'finance_lendings'::regclass
                   AND conname = 'finance_lendings_due_history_array') THEN
    RAISE EXCEPTION 'Due-history migration failed: array CHECK is missing.';
  END IF;
END
$$;

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — TASK: KHUNG GIỜ LÀM v6.17.0
--
-- Thêm 2 cột tuỳ chọn `user_tasks.start_time` / `end_time` (TIME):
-- khung giờ dự định làm task, nằm trong CÙNG ngày `due_date`.
--   - `due_time` giữ nguyên nghĩa: giờ HẠN (23:59/00:00 = không đặt giờ).
--   - Có khung giờ → Lịch Ngày/Tuần vẽ khối thật start→end.
--   - Cả hai NULL = không có khung giờ (mọi task cũ).
-- CHECK: có đủ cả hai hoặc không có cái nào; kết thúc phải sau bắt đầu
-- (không cho khung qua đêm).
--
-- Additive + idempotent: chạy lại nhiều lần an toàn, không đụng dữ liệu cũ.
-- Chạy TRƯỚC khi deploy frontend v6.17.0 là an toàn (code cũ bỏ qua cột mới).
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'user_tasks') THEN
    RAISE EXCEPTION 'Task time block migration refused: public.user_tasks is missing.';
  END IF;
END
$$;

ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS end_time TIME;

ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_time_block_check;
ALTER TABLE public.user_tasks ADD CONSTRAINT user_tasks_time_block_check CHECK (
  (start_time IS NULL AND end_time IS NULL)
  OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
);

COMMENT ON COLUMN public.user_tasks.start_time IS
  'Giờ bắt đầu khung giờ làm (cùng ngày due_date). NULL = không có khung giờ.';
COMMENT ON COLUMN public.user_tasks.end_time IS
  'Giờ kết thúc khung giờ làm, phải sau start_time. NULL khi start_time NULL.';

-- VERIFY: 2 cột tồn tại, nullable; constraint đã gắn.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_tasks'
        AND column_name IN ('start_time', 'end_time') AND is_nullable = 'YES') <> 2 THEN
    RAISE EXCEPTION 'Task time block migration failed: start_time/end_time missing or NOT NULL.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tasks_time_block_check') THEN
    RAISE EXCEPTION 'Task time block migration failed: user_tasks_time_block_check missing.';
  END IF;
END
$$;

COMMIT;

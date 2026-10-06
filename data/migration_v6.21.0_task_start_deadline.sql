-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — TASK: BẮT ĐẦU + HẠN v6.21.0
--
-- Mô hình thời gian mới của task: 2 mốc, đều TUỲ CHỌN.
--   - Hạn     = due_date + due_time. Giờ NULL = không đặt giờ (bỏ quy ước 23:59/00:00).
--   - Bắt đầu = start_date + start_time (cột start_time có từ v6.17.0, nay đi cùng start_date).
--   - Kết thúc = Hạn → bỏ cột end_time (khung 9–10 = Bắt đầu 9:00, Hạn 10:00).
--   - started_at = lúc bắt đầu làm THẬT — app tự ghi khi task sang Doing lần đầu.
-- due_date bỏ NOT NULL: task được phép không có ngày.
--
-- Dữ liệu cũ (user đồng ý 2026-10-06):
--   1. due_time 23:59 / 00:00 (= "không giờ") → NULL.
--   2. Khung giờ start_time–end_time (nằm trên due_date) → start_date = due_date; giờ Hạn
--      lấy end_time nếu chưa có giờ hạn hoặc giờ hạn không sau start_time.
--   3. Xoá cột end_time — chỉ mất end_time của task vừa có khung giờ vừa có giờ hạn riêng.
--
-- Rollback: không tự động (end_time đã xoá; muốn NOT NULL lại phải gán ngày cho task
-- không ngày trước). Điều kiện: đã chạy migration_v6.17.0_task_time_block.sql.
-- Idempotent: chạy lại an toàn.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_tasks' AND column_name = 'start_time'
  ) THEN
    RAISE EXCEPTION 'Task start/deadline migration refused: run migration_v6.17.0_task_time_block.sql first.';
  END IF;
END
$$;

ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- 1. "Không giờ" là NULL thật.
UPDATE public.user_tasks SET due_time = NULL
WHERE due_time >= '23:59:00' OR due_time = '00:00:00';

-- 2 + 3. Khung giờ cũ → Bắt đầu/Hạn, rồi bỏ end_time (chỉ khi cột còn → chạy lại an toàn).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_tasks' AND column_name = 'end_time'
  ) THEN
    UPDATE public.user_tasks
       SET start_date = due_date,
           due_time = CASE WHEN due_time IS NULL OR due_time <= start_time THEN end_time ELSE due_time END
     WHERE start_time IS NOT NULL AND end_time IS NOT NULL;
    ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_time_block_check;
    ALTER TABLE public.user_tasks DROP COLUMN end_time;
  END IF;
END
$$;

-- 4. Task không ngày.
ALTER TABLE public.user_tasks ALTER COLUMN due_date DROP NOT NULL;

-- 5. Có giờ thì phải có ngày; Bắt đầu không sau Hạn.
ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_due_time_needs_date;
ALTER TABLE public.user_tasks ADD CONSTRAINT user_tasks_due_time_needs_date
  CHECK (due_time IS NULL OR due_date IS NOT NULL);
ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_start_time_needs_date;
ALTER TABLE public.user_tasks ADD CONSTRAINT user_tasks_start_time_needs_date
  CHECK (start_time IS NULL OR start_date IS NOT NULL);
ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_start_before_due;
ALTER TABLE public.user_tasks ADD CONSTRAINT user_tasks_start_before_due CHECK (
  start_date IS NULL OR due_date IS NULL
  OR start_date < due_date
  OR (start_date = due_date AND (start_time IS NULL OR due_time IS NULL OR start_time < due_time))
);

COMMENT ON COLUMN public.user_tasks.due_date IS 'Ngày hạn. NULL = task không có ngày.';
COMMENT ON COLUMN public.user_tasks.due_time IS 'Giờ hạn. NULL = không đặt giờ (cả ngày).';
COMMENT ON COLUMN public.user_tasks.start_date IS 'Ngày bắt đầu dự định. NULL = không đặt.';
COMMENT ON COLUMN public.user_tasks.start_time IS 'Giờ bắt đầu dự định (của start_date). NULL = không đặt giờ.';
COMMENT ON COLUMN public.user_tasks.started_at IS
  'Lúc bắt đầu làm thật — app ghi khi task sang Doing lần đầu. Không phải kế hoạch.';

-- VERIFY
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_tasks' AND column_name = 'end_time'
  ) THEN
    RAISE EXCEPTION 'Task start/deadline migration failed: end_time still exists.';
  END IF;
  IF (SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_tasks'
        AND column_name IN ('due_date', 'start_date', 'started_at') AND is_nullable = 'YES') <> 3 THEN
    RAISE EXCEPTION 'Task start/deadline migration failed: due_date/start_date/started_at missing or NOT NULL.';
  END IF;
  IF (SELECT COUNT(*) FROM pg_constraint
      WHERE conname IN ('user_tasks_due_time_needs_date', 'user_tasks_start_time_needs_date',
                        'user_tasks_start_before_due')) <> 3 THEN
    RAISE EXCEPTION 'Task start/deadline migration failed: CHECK constraints missing.';
  END IF;
END
$$;

COMMIT;

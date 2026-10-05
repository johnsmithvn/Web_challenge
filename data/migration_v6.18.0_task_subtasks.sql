-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — TASK: VIỆC CON (CHECKLIST) v6.18.0
--
-- Thêm cột `user_tasks.subtasks JSONB` — checklist việc con của task, kiểu
-- checklist của card Trello. Mỗi phần tử:
--   { "id": uuid, "title": text, "done": bool, "due_date": "YYYY-MM-DD" | null }
-- Thứ tự mảng = thứ tự hiển thị (kéo thả sắp xếp). Việc con KHÔNG phải row
-- user_tasks riêng → không hiện trên Lịch/Kanban, không đụng recurrence/XP.
--
-- NOT NULL DEFAULT '[]' là thay đổi metadata trên Postgres 11+ (không rewrite bảng).
-- Additive + idempotent: chạy lại nhiều lần an toàn, không đụng dữ liệu cũ.
-- Chạy TRƯỚC khi deploy frontend v6.18.0 là an toàn (code cũ bỏ qua cột mới).
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'user_tasks') THEN
    RAISE EXCEPTION 'Task subtasks migration refused: public.user_tasks is missing.';
  END IF;
END
$$;

ALTER TABLE public.user_tasks
  ADD COLUMN IF NOT EXISTS subtasks JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_subtasks_array_check;
ALTER TABLE public.user_tasks ADD CONSTRAINT user_tasks_subtasks_array_check
  CHECK (jsonb_typeof(subtasks) = 'array');

COMMENT ON COLUMN public.user_tasks.subtasks IS
  'Checklist việc con: mảng {id, title, done, due_date}. Thứ tự mảng = thứ tự hiển thị.';

-- VERIFY: cột tồn tại, NOT NULL; constraint đã gắn.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_tasks'
      AND column_name = 'subtasks' AND data_type = 'jsonb' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Task subtasks migration failed: user_tasks.subtasks missing, not jsonb or nullable.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tasks_subtasks_array_check') THEN
    RAISE EXCEPTION 'Task subtasks migration failed: user_tasks_subtasks_array_check missing.';
  END IF;
END
$$;

COMMIT;

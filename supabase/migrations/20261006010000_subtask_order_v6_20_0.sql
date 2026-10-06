-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — TASK: SUBTASK ẨN TRONG TASK CHA v6.20.0
--
-- Subtask = row user_tasks có parent_task_id (v6.19.0), nay là MỘT PHẦN của task
-- cha (thay checklist JSONB v6.18.0): chỉ hiện bên trong task cha, không hiện ở
-- Kanban/Danh sách/Lịch.
--   1. `sort_order INTEGER` — thứ tự kéo thả trong task cha (NULL = xếp sau cùng).
--   2. FK `user_tasks_parent_fk`: ON DELETE SET NULL → ON DELETE CASCADE — xoá task
--      cha thì xoá luôn subtask (subtask "mồ côi" sẽ không hiện ở đâu cả).
--      Composite (parent_task_id, user_id) vẫn ép cùng chủ.
-- Cột `subtasks` JSONB (v6.18.0) KHÔNG còn được app dùng; giữ nguyên, không xoá ở đây.
--
-- Điều kiện: đã chạy migration_v6.19.0_task_parent.sql. Idempotent.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_tasks' AND column_name = 'parent_task_id'
  ) OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tasks_id_user_key') THEN
    RAISE EXCEPTION 'Subtask order migration refused: run migration_v6.19.0_task_parent.sql first.';
  END IF;
END
$$;

ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER;

ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_parent_fk;
ALTER TABLE public.user_tasks ADD CONSTRAINT user_tasks_parent_fk
  FOREIGN KEY (parent_task_id, user_id) REFERENCES public.user_tasks (id, user_id)
  ON DELETE CASCADE;

COMMENT ON COLUMN public.user_tasks.sort_order IS
  'Thứ tự subtask trong task cha (kéo thả). NULL = xếp sau cùng.';
COMMENT ON COLUMN public.user_tasks.parent_task_id IS
  'Task cha (cùng user) — task này là subtask, chỉ hiện bên trong task cha. Xoá task cha → xoá theo.';
COMMENT ON COLUMN public.user_tasks.subtasks IS
  'KHÔNG CÒN DÙNG từ v6.20.0 (checklist JSONB cũ, thay bằng subtask parent_task_id).';

-- VERIFY
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_tasks' AND column_name = 'sort_order'
  ) THEN
    RAISE EXCEPTION 'Subtask order migration failed: user_tasks.sort_order missing.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_tasks_parent_fk' AND confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'Subtask order migration failed: user_tasks_parent_fk is not ON DELETE CASCADE.';
  END IF;
END
$$;

COMMIT;

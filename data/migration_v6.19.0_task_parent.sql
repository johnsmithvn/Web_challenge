-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — TASK: TASK CON LIÊN KẾT v6.19.0
--
-- Thêm `user_tasks.parent_task_id` — task con là TASK THẬT (đủ mô tả, hạn, giờ,
-- ưu tiên, tag, nhắc, lịch sử), chỉ mang thêm liên kết tới task cha. Khác checklist
-- `subtasks` (JSONB, bước nhỏ không có chi tiết).
--   - FK composite (parent_task_id, user_id) → (id, user_id): task cha bắt buộc
--     CÙNG CHỦ (RULES §7 — FK bỏ qua RLS nên phải ép ở schema).
--   - Xoá task cha → ON DELETE SET NULL (parent_task_id): task con thành task độc
--     lập, KHÔNG bị xoá theo, user_id giữ nguyên. Cú pháp cột này cần Postgres 15+.
--   - Không tự trỏ chính mình. Giới hạn 1 cấp do app quản lý (UI không cho thêm
--     task con vào task con).
--
-- Additive + idempotent: chạy lại nhiều lần an toàn, không đụng dữ liệu cũ.
-- Chạy TRƯỚC khi deploy frontend v6.19.0 là an toàn (code cũ bỏ qua cột mới).
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION 'Task parent migration refused: needs PostgreSQL 15+ (ON DELETE SET NULL column list), found %.',
      current_setting('server_version');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'user_tasks') THEN
    RAISE EXCEPTION 'Task parent migration refused: public.user_tasks is missing.';
  END IF;
END
$$;

ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID;

-- Gỡ theo thứ tự phụ thuộc (FK dựa trên UNIQUE) rồi tạo lại → chạy lại được.
ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_parent_fk;
ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_id_user_key;
ALTER TABLE public.user_tasks ADD CONSTRAINT user_tasks_id_user_key UNIQUE (id, user_id);
ALTER TABLE public.user_tasks ADD CONSTRAINT user_tasks_parent_fk
  FOREIGN KEY (parent_task_id, user_id) REFERENCES public.user_tasks (id, user_id)
  ON DELETE SET NULL (parent_task_id);

ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_parent_not_self;
ALTER TABLE public.user_tasks ADD CONSTRAINT user_tasks_parent_not_self
  CHECK (parent_task_id IS NULL OR parent_task_id <> id);

CREATE INDEX IF NOT EXISTS idx_user_tasks_parent
  ON public.user_tasks (parent_task_id) WHERE parent_task_id IS NOT NULL;

COMMENT ON COLUMN public.user_tasks.parent_task_id IS
  'Task cha (cùng user). NULL = task độc lập. Xoá task cha → SET NULL, task con giữ lại.';

-- VERIFY
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_tasks'
      AND column_name = 'parent_task_id' AND data_type = 'uuid' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Task parent migration failed: user_tasks.parent_task_id missing or wrong type.';
  END IF;
  IF (SELECT COUNT(*) FROM pg_constraint
      WHERE conname IN ('user_tasks_id_user_key', 'user_tasks_parent_fk', 'user_tasks_parent_not_self')) <> 3 THEN
    RAISE EXCEPTION 'Task parent migration failed: constraints missing.';
  END IF;
END
$$;

COMMIT;

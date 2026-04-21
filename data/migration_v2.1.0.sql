-- ============================================================
-- Migration v2.1.0 — Personal Tasks (Nhiệm Vụ Cá Nhân)
-- Run in Supabase SQL Editor
--
-- ⚠️  PREREQUISITES: migration_v1.5.0.sql phải chạy trước
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. user_tasks — nhiệm vụ do user tự tạo
--    Không liên quan đến habits/journey/XP
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  due_date      date NOT NULL,
  due_time      time,                    -- nullable: nếu không đặt giờ cụ thể
  completed     boolean NOT NULL DEFAULT false,
  completed_at  timestamptz,             -- timestamp khi user tick hoàn thành
  notified      boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 2. Indexes
-- ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_date
  ON user_tasks (user_id, due_date);

CREATE INDEX IF NOT EXISTS idx_user_tasks_pending
  ON user_tasks (user_id, completed, due_date)
  WHERE completed = false;

-- ──────────────────────────────────────────────────────────
-- 3. RLS — user chỉ thấy task của mình
-- ──────────────────────────────────────────────────────────
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own tasks" ON user_tasks;
CREATE POLICY "Users manage own tasks"
  ON user_tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- 4. Verify
-- ──────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'user_tasks';

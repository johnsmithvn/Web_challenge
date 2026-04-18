-- ============================================================
-- Migration v1.4.0 — Habit action field + Conquered state
-- Run in Supabase SQL Editor
-- ============================================================

-- Feature 1: Habit "action" field (daily specific action text)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS action TEXT;

-- Feature 2: Habit lifecycle state
ALTER TABLE habits ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'conquered', 'paused'));
ALTER TABLE habits ADD COLUMN IF NOT EXISTS cycle_count  INT  NOT NULL DEFAULT 1;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS conquered_at TIMESTAMPTZ;

-- Index for filtering active habits quickly
CREATE INDEX IF NOT EXISTS idx_habits_user_status ON habits (user_id, status);

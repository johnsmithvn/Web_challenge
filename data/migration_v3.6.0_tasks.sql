-- Migration v3.6.0: Energy Tag + Recurring Tasks
-- Run in Supabase SQL Editor

-- Energy level for tasks (high/medium/low)
ALTER TABLE user_tasks
  ADD COLUMN IF NOT EXISTS energy_level TEXT
    CHECK (energy_level IN ('high', 'medium', 'low')) DEFAULT NULL;

-- Estimated duration in minutes
ALTER TABLE user_tasks
  ADD COLUMN IF NOT EXISTS duration_est SMALLINT DEFAULT NULL;

-- Recurrence rule (JSONB)
-- Examples:
--   {"type":"interval","days":45}      — every 45 days
--   {"type":"weekly","weekday":1}      — every Monday (0=Sun, 1=Mon, ..., 6=Sat)
--   {"type":"monthly","day":15}        — every 15th of the month
ALTER TABLE user_tasks
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB DEFAULT NULL;

-- Index for filtering recurring tasks
CREATE INDEX IF NOT EXISTS idx_user_tasks_recurring
  ON user_tasks (user_id) WHERE recurrence_rule IS NOT NULL;

-- Migration v4.9.0
-- Replace energy_level + duration_est with priority (5 levels)

-- Drop deprecated columns
ALTER TABLE user_tasks DROP COLUMN IF EXISTS energy_level;
ALTER TABLE user_tasks DROP COLUMN IF EXISTS duration_est;

-- Add priority: 0=None, 1=Lowest, 2=Low, 3=Medium, 4=High, 5=Urgent
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0;

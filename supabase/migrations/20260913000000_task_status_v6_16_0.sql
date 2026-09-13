-- Migration: Add status column to user_tasks for Kanban 3-column view (v6.16.0)
-- Allows classifying tasks into 'todo', 'doing', and 'done'.

ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo';

-- Backfill status based on completed column
UPDATE user_tasks SET status = 'done' WHERE completed = true AND (status IS NULL OR status = 'todo');
UPDATE user_tasks SET status = 'todo' WHERE completed = false AND status IS NULL;

-- Migration: Migrate inbox items from collections to user_tasks, then remove inbox rows (v6.16.1)
-- Migrates all rows with type = 'inbox' to user_tasks with status = 'todo' and due_date = CURRENT_DATE.

-- 1. Insert inbox items into user_tasks
INSERT INTO user_tasks (
  user_id,
  title,
  description,
  due_date,
  due_time,
  status,
  priority,
  completed,
  created_at,
  updated_at
)
SELECT
  c.user_id,
  c.title,
  CASE
    WHEN c.body IS NOT NULL AND c.body <> '' AND c.url IS NOT NULL AND c.url <> '' THEN c.body || E'\n' || c.url
    WHEN c.body IS NOT NULL AND c.body <> '' THEN c.body
    ELSE c.url
  END AS description,
  CURRENT_DATE AS due_date,
  '09:00'::TIME AS due_time,
  'todo' AS status,
  0 AS priority,
  false AS completed,
  c.created_at,
  NOW() AS updated_at
FROM collections c
WHERE c.type = 'inbox';

-- 2. Clean up inbox items from collections table
DELETE FROM collections WHERE type = 'inbox';

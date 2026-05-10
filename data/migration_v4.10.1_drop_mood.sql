-- v4.10.1: Drop mood_logs table (feature removed)

DROP POLICY IF EXISTS "mood_own" ON mood_logs;
DROP INDEX IF EXISTS idx_mood_user;
DROP TABLE IF EXISTS mood_logs;

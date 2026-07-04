-- ═══════════════════════════════════════════════════════════════
-- RESET USER DATA — Xóa toàn bộ data app, GIỮ lại auth accounts
-- Synced with: schema_v4.24.0.sql
-- Last updated: 2026-06-28
-- Chạy trong Supabase SQL Editor
-- ⚠️  KHÔNG THỂ HOÀN TÁC — chỉ chạy khi chắc chắn muốn reset
-- ═══════════════════════════════════════════════════════════════

-- 1. Tag junctions (must go before tags, collections, expenses, subscriptions)
DELETE FROM collection_tags;
DELETE FROM expense_tags;
DELETE FROM subscription_tags;

-- 2. Intention logs (must go before intentions)
DELETE FROM intention_logs;
DELETE FROM intentions;

-- 3. Habit tracking (order matters: habit_logs → journey_habits → user_journeys → habits)
DELETE FROM habit_logs;
DELETE FROM journey_habits;
DELETE FROM user_journeys;
DELETE FROM program_habits;
DELETE FROM programs;
DELETE FROM habits;

-- 4. Tags (after all junction tables)
DELETE FROM tags;

-- 5. Task↔Collection junction (v4.5.0, must go before user_tasks + collections)
DELETE FROM task_collections;

-- 6. Collections & tasks (task FK → collection, must delete tasks first)
DELETE FROM user_tasks;
DELETE FROM collections;

-- 6. Finance
DELETE FROM expenses;
DELETE FROM subscriptions;

-- 7. Activity & sessions
DELETE FROM activity_logs;
DELETE FROM focus_sessions;
DELETE FROM fitness_logs;

-- 8. Mood & motivation
DELETE FROM skip_reasons;

-- 9. Progress (legacy day-done table)
DELETE FROM progress;

-- 10. Streaks & notification settings (per-user config, reset to clean state)
DELETE FROM streaks;
DELETE FROM notification_settings;

-- 11. XP (optional — uncomment nếu muốn reset XP luôn)
-- DELETE FROM xp_logs;

-- 12. Friendships (optional — uncomment nếu muốn xóa connections)
-- DELETE FROM friendships;

-- 13. Profiles (optional — uncomment nếu muốn reset profile info)
-- DELETE FROM profiles WHERE id NOT IN (SELECT id FROM auth.users WHERE deleted_at IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════
-- DONE — Auth accounts (auth.users) được giữ nguyên
-- Tables reset (11): collection_tags, expense_tags, subscription_tags,
--   intention_logs, intentions, habit_logs, journey_habits, user_journeys,
--   program_habits, programs, habits, tags, user_tasks, collections,
--   expenses, subscriptions, activity_logs, focus_sessions, fitness_logs,
--   skip_reasons, progress, streaks, notification_settings
-- ═══════════════════════════════════════════════════════════════

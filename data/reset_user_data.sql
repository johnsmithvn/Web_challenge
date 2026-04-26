-- ═══════════════════════════════════════════════════════════════
-- RESET USER DATA — Xóa toàn bộ data app, GIỮ lại auth accounts
-- Chạy trong Supabase SQL Editor
-- ⚠️  KHÔNG THỂ HOÀN TÁC — chỉ chạy khi chắc chắn muốn reset
-- ═══════════════════════════════════════════════════════════════

-- 1. Habit tracking (order matters: habit_logs references habits)
DELETE FROM habit_logs;
DELETE FROM journey_habits;
DELETE FROM user_journeys;
DELETE FROM habits;

-- 2. Progress (legacy day-done table)
DELETE FROM progress;

-- 3. Activity & sessions
DELETE FROM activity_logs;
DELETE FROM focus_sessions;

-- 4. Mood & motivation
DELETE FROM mood_logs;
DELETE FROM skip_reasons;

-- 5. Finance
DELETE FROM expenses;
DELETE FROM subscriptions;

-- 6. Collections & tasks
DELETE FROM collections;
DELETE FROM user_tasks;

-- 7. XP (optional — uncomment nếu muốn reset XP luôn)
-- DELETE FROM xp_logs;

-- 8. Profiles (optional — uncomment nếu muốn reset profile info)
-- DELETE FROM profiles WHERE id NOT IN (SELECT id FROM auth.users WHERE deleted_at IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════
-- DONE — Auth accounts (auth.users) được giữ nguyên
-- ═══════════════════════════════════════════════════════════════

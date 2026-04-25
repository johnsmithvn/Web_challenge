-- ════════════════════════════════════════════════════════════════
-- Migration v2.2.2 — Database Security Fixes
-- Run in Supabase SQL Editor
--
-- ⚠️  RUN AFTER: supabase_team_v3.sql (if already applied)
--     OR AFTER: migration_v1.6.2.sql (if using legacy path)
--
-- This migration is IDEMPOTENT — safe to run multiple times.
-- ════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────
-- FIX 1: progress — Allow teammates to READ each other's progress
--
-- Problem: supabase_team_v3.sql sets progress SELECT to owner-only,
--          but useTeam.js queries progress for ALL team members.
--          Without this fix → TeamMemberCard shows empty heatmap.
-- ──────────────────────────────────────────────────────────────

-- Drop any existing select policies to avoid conflict
DROP POLICY IF EXISTS "progress_select_own"  ON progress;
DROP POLICY IF EXISTS "progress_read"        ON progress;
DROP POLICY IF EXISTS "progress_select_team" ON progress;

-- Owner can always read own progress
CREATE POLICY "progress_select_own" ON progress FOR SELECT
  USING (user_id = auth.uid());

-- Teammates can read each other's progress (via team_members junction)
CREATE POLICY "progress_select_team" ON progress FOR SELECT
  USING (
    user_id IN (
      SELECT tm2.user_id
      FROM team_members tm1
      JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE remain owner-only (no change needed — just ensure they exist)
DROP POLICY IF EXISTS "progress_insert_own" ON progress;
DROP POLICY IF EXISTS "progress_update_own" ON progress;
CREATE POLICY "progress_insert_own" ON progress FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress_update_own" ON progress FOR UPDATE
  USING (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────────
-- FIX 2: team_check_logs — Block self-check + require same team
--
-- Problem: Current policy only checks checker_id = auth.uid().
--          User could send raw query with checked_id = own uid
--          to validate their own Week 2 day → bypasses team check rule.
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "checks_insert_own" ON team_check_logs;
CREATE POLICY "checks_insert_own" ON team_check_logs FOR INSERT
  WITH CHECK (
    checker_id = auth.uid()
    AND checked_id != auth.uid()                          -- cannot self-check
    AND team_id IN (SELECT get_my_team_ids())             -- must be in same team
  );

-- SELECT + UPDATE policies remain unchanged (already scoped to team)


-- ──────────────────────────────────────────────────────────────
-- FIX 3: streaks — Remove client INSERT/UPDATE policies
--
-- Problem: Client can call supabase.from('streaks').update(...)
--          to fake streak values. Streaks should ONLY be updated
--          by the refresh_streak() trigger (SECURITY DEFINER).
--
-- Note: refresh_streak() uses SECURITY DEFINER → bypasses RLS,
--       so removing client write policies does NOT break the trigger.
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "streaks_upsert_own" ON streaks;
DROP POLICY IF EXISTS "streaks_update_own" ON streaks;
DROP POLICY IF EXISTS "streaks_write"      ON streaks;

-- Keep SELECT open for leaderboard
-- (already exists as "streaks_select_all" — no change needed)


-- ──────────────────────────────────────────────────────────────
-- FIX 4: xp_logs — Constrain max amount per insert
--
-- Problem: Client-side addXp() passes arbitrary amount.
--          User could send { amount: 99999 } via DevTools.
--
-- Fix: CHECK constraint on amount column.
--      Max single XP event = 200 (streak_21 reward).
--      This is a DB-level safeguard, not a replacement for
--      server-side validation (Edge Function — future).
-- ──────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Add constraint only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'xp_amount_range'
      AND conrelid = 'xp_logs'::regclass
  ) THEN
    ALTER TABLE xp_logs
      ADD CONSTRAINT xp_amount_range CHECK (amount BETWEEN -200 AND 200);
  END IF;
END $$;


-- ──────────────────────────────────────────────────────────────
-- FIX 5: handle_new_user — Merge legacy + team v3 trigger
--
-- Problem: Two competing versions of this trigger.
--   Legacy:  Creates username (dedup), streaks row, notification_settings row
--   Team v3: Only creates display_name — misses username/streaks/notifications
--
-- Fix: Merged version that handles all cases.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username  TEXT;
  final_username TEXT;
  counter        INT := 0;
BEGIN
  -- Generate unique username from name or email
  base_username := LOWER(REGEXP_REPLACE(
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    '[^a-z0-9]', '', 'g'
  ));

  -- Ensure non-empty
  IF base_username = '' OR base_username IS NULL THEN
    base_username := 'user';
  END IF;

  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter;
  END LOOP;

  -- Create profile
  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      final_username
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Initialize streaks row
  INSERT INTO streaks (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Initialize notification_settings (if table exists)
  BEGIN
    INSERT INTO notification_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN undefined_table THEN
    NULL;  -- table not created yet, skip
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ──────────────────────────────────────────────────────────────
-- VERIFY — Run these queries separately to check results
-- ──────────────────────────────────────────────────────────────
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'progress';
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'team_check_logs';
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'streaks';
-- SELECT conname FROM pg_constraint WHERE conrelid = 'xp_logs'::regclass;

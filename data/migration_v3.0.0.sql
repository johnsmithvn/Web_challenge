-- ============================================================
-- Migration: v3.0.0 — Personal Life Hub
-- Date: 2026-04-25
-- Description: 4 new tables for Collect, Finance, Life Log
-- Run this in Supabase SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. COLLECTIONS (Inbox + Collect: links, quotes, wishlist, learning, ideas)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'inbox',
  -- Values: 'inbox' | 'link' | 'quote' | 'want' | 'learn' | 'idea'
  title        TEXT NOT NULL,
  url          TEXT,                          -- for links
  body         TEXT DEFAULT '',               -- content / notes
  tags         TEXT[] DEFAULT '{}',           -- free-form tags
  source       TEXT,                          -- "Facebook", "GitHub", "YouTube", etc.
  priority     TEXT,                          -- for 'want' type: 'low' | 'medium' | 'high'
  status       TEXT NOT NULL DEFAULT 'inbox',
  -- Values: 'inbox' | 'unread' | 'read' | 'starred' | 'archived'
  resolved     BOOLEAN DEFAULT false,         -- for 'want' type: completed?
  course_name  TEXT,                          -- for 'learn' type
  duration_min INT,                           -- for 'learn' type: study minutes
  reviewed_at  TIMESTAMPTZ,                   -- last reviewed (for daily resurface logic)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_collections_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collections_user_type
  ON collections (user_id, type);
CREATE INDEX IF NOT EXISTS idx_collections_user_status
  ON collections (user_id, status);
CREATE INDEX IF NOT EXISTS idx_collections_user_created
  ON collections (user_id, created_at DESC);

-- RLS
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collections_select_own"
  ON collections FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "collections_insert_own"
  ON collections FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "collections_update_own"
  ON collections FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "collections_delete_own"
  ON collections FOR DELETE
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 2. EXPENSES (Chi tiêu cá nhân — VNĐ, chi tiêu only)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      INT NOT NULL,                   -- VNĐ (integer, no decimals)
  category    TEXT NOT NULL,                  -- emoji category key
  note        TEXT,                            -- optional description
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_user_date
  ON expenses (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category
  ON expenses (user_id, category);

-- RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select_own"
  ON expenses FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "expenses_insert_own"
  ON expenses FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "expenses_update_own"
  ON expenses FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "expenses_delete_own"
  ON expenses FOR DELETE
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 3. SUBSCRIPTIONS (Đăng ký gói tháng/năm — Netflix, AI, etc.)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,                  -- "Netflix", "Google AI Pro"
  amount       INT NOT NULL,                   -- VNĐ per cycle
  cycle        TEXT NOT NULL DEFAULT 'monthly',-- 'monthly' | 'yearly'
  next_due     DATE NOT NULL,                  -- next payment/expiry date
  icon         TEXT DEFAULT '📦',              -- emoji/icon
  color        TEXT DEFAULT '#8b5cf6',         -- card accent color
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active
  ON subscriptions (user_id, active);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own"
  ON subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "subscriptions_insert_own"
  ON subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "subscriptions_update_own"
  ON subscriptions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "subscriptions_delete_own"
  ON subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 4. ACTIVITY_LOGS (Super table — log mọi action for Life Log)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  -- Values: 'habit_done' | 'habit_undo' | 'task_done' | 'task_add'
  --       | 'expense_add' | 'collect_add' | 'focus_done'
  --       | 'mood_set' | 'xp_earned' | 'challenge_done'
  --       | 'subscription_add' | 'journey_start' | 'journey_complete'
  label       TEXT,                            -- human-readable: "Tập thể dục", "85,000₫ Ăn trưa"
  amount      INT,                             -- XP or VNĐ if applicable
  meta        JSONB DEFAULT '{}',              -- extra context: { habit_id, category, etc. }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary index for heatmap (count per day per user)
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date
  ON activity_logs (user_id, (created_at::date));

-- Index for querying specific actions
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action
  ON activity_logs (user_id, action);

-- RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_select_own"
  ON activity_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "activity_logs_insert_own"
  ON activity_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- activity_logs are append-only: no UPDATE/DELETE policies
-- This ensures audit trail integrity

-- ────────────────────────────────────────────────────────────
-- DONE — 4 tables created with RLS
-- ────────────────────────────────────────────────────────────

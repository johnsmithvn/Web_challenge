-- ============================================================
-- MIGRATION v1.2.0 — Chỉ chạy file này nếu đã có schema cũ
-- Thêm: Custom Habits, Focus Sessions, Mood Logs, Skip Reasons
-- ============================================================

-- Đảm bảo helper function tồn tại (có thể đã có từ schema gốc)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. HABITS (custom user-defined habits)
CREATE TABLE IF NOT EXISTS habits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT '⚡',
  color        TEXT NOT NULL DEFAULT '#8B5CF6',
  category     TEXT NOT NULL DEFAULT 'other',
  time_target  TIME,
  duration_min SMALLINT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   SMALLINT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_habits_user ON habits (user_id, active);

DROP TRIGGER IF EXISTS habits_updated_at ON habits;
CREATE TRIGGER habits_updated_at
  BEFORE UPDATE ON habits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "habits_own" ON habits;
CREATE POLICY "habits_own" ON habits FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 13. FOCUS_SESSIONS (Pomodoro sessions)
CREATE TABLE IF NOT EXISTS focus_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id     UUID REFERENCES habits(id) ON DELETE SET NULL,
  duration_min SMALLINT NOT NULL DEFAULT 25,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_focus_user_date ON focus_sessions (user_id, date DESC);

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "focus_own" ON focus_sessions;
CREATE POLICY "focus_own" ON focus_sessions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 14. MOOD_LOGS (daily mood — 1 per user per day)
CREATE TABLE IF NOT EXISTS mood_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  mood_emoji TEXT NOT NULL,
  mood_label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_mood_user ON mood_logs (user_id, date DESC);

ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mood_own" ON mood_logs;
CREATE POLICY "mood_own" ON mood_logs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 15. SKIP_REASONS (why user missed a day)
CREATE TABLE IF NOT EXISTS skip_reasons (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  reason     TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_skip_user ON skip_reasons (user_id, date DESC);

ALTER TABLE skip_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skip_own" ON skip_reasons;
CREATE POLICY "skip_own" ON skip_reasons FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Realtime (skip if already added)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE habits;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE focus_sessions;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Verify
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('habits','focus_sessions','mood_logs','skip_reasons')
ORDER BY table_name;

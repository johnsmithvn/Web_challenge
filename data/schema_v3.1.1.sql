-- ============================================================
-- Life Hub v3.1.1 — FULL SCHEMA (Single Migration)
-- Run once on a fresh Supabase project
-- Tables: profiles, progress, streaks, habits, focus_sessions,
--         mood_logs, skip_reasons, xp_logs, friendships,
--         programs, program_habits, user_journeys, journey_habits,
--         habit_logs, user_tasks, notification_settings,
--         collections, expenses, subscriptions, activity_logs
-- Team tables excluded (archived in v3.0.0)
-- ============================================================

-- ── Helper: auto-update updated_at ──────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 1. profiles ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE,
  email        TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_profiles_username ON profiles (username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email) WHERE email IS NOT NULL;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());

-- ── 2. progress ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  week_num     SMALLINT NOT NULL DEFAULT 1,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "progress_select_own"  ON progress;
DROP POLICY IF EXISTS "progress_insert_own"  ON progress;
DROP POLICY IF EXISTS "progress_update_own"  ON progress;
CREATE POLICY "progress_select_own" ON progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "progress_insert_own" ON progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress_update_own" ON progress FOR UPDATE USING (user_id = auth.uid());

-- ── 3. streaks ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS streaks (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "streaks_select_all" ON streaks;
CREATE POLICY "streaks_select_all" ON streaks FOR SELECT USING (true);

-- ── 4. notification_settings ────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled    BOOLEAN DEFAULT true,
  remind_time TIME DEFAULT '08:00',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_own" ON notification_settings;
CREATE POLICY "notif_own" ON notification_settings FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 5. habits ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  journey_id   UUID,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT 'lightning',
  color        TEXT NOT NULL DEFAULT '#8B5CF6',
  category     TEXT NOT NULL DEFAULT 'other',
  action       TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','conquered','paused')),
  cycle_count  INT  NOT NULL DEFAULT 1,
  conquered_at TIMESTAMPTZ,
  time_target  TIME,
  duration_min SMALLINT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   SMALLINT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_habits_user        ON habits (user_id, active);
CREATE INDEX IF NOT EXISTS idx_habits_user_status ON habits (user_id, status);
DROP TRIGGER IF EXISTS habits_updated_at ON habits;
CREATE TRIGGER habits_updated_at BEFORE UPDATE ON habits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "habits_own" ON habits;
CREATE POLICY "habits_own" ON habits FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 6. focus_sessions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS focus_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id     UUID REFERENCES habits(id) ON DELETE SET NULL,
  journey_id   UUID,
  duration_min SMALLINT NOT NULL DEFAULT 25,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_focus_user_date ON focus_sessions (user_id, date DESC);
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "focus_own" ON focus_sessions;
CREATE POLICY "focus_own" ON focus_sessions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 7. mood_logs ─────────────────────────────────────────────
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
CREATE POLICY "mood_own" ON mood_logs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 8. skip_reasons ─────────────────────────────────────────
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
CREATE POLICY "skip_own" ON skip_reasons FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 9. xp_logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount     SMALLINT NOT NULL DEFAULT 0 CHECK (amount BETWEEN -200 AND 200),
  reason     TEXT NOT NULL,
  meta       JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_xp_logs_user ON xp_logs (user_id, created_at DESC);
ALTER TABLE xp_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "xp_own"      ON xp_logs;
DROP POLICY IF EXISTS "xp_read_all" ON xp_logs;
CREATE POLICY "xp_own"      ON xp_logs FOR ALL    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "xp_read_all" ON xp_logs FOR SELECT USING (auth.role() = 'authenticated');

-- ── 10. friendships ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships (addressee_id);
DROP TRIGGER IF EXISTS friendships_updated_at ON friendships;
CREATE TRIGGER friendships_updated_at BEFORE UPDATE ON friendships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "friendships_own" ON friendships;
CREATE POLICY "friendships_own" ON friendships FOR ALL
  USING (requester_id = auth.uid() OR addressee_id = auth.uid())
  WITH CHECK (requester_id = auth.uid());

-- ── 11. programs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT DEFAULT 'target',
  color         TEXT DEFAULT '#8b5cf6',
  category      TEXT DEFAULT 'other' CHECK (category IN ('health','learning','mindfulness','productivity','other')),
  duration_days INT  NOT NULL DEFAULT 21,
  is_template   BOOLEAN DEFAULT false,
  is_public     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read public/template programs" ON programs;
DROP POLICY IF EXISTS "Manage own programs"           ON programs;
CREATE POLICY "Read public/template programs" ON programs FOR SELECT
  USING (is_public = true OR is_template = true OR creator_id = auth.uid());
CREATE POLICY "Manage own programs" ON programs FOR ALL
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

-- ── 12. program_habits ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_habits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  action       TEXT,
  icon         TEXT DEFAULT 'check',
  color        TEXT DEFAULT '#06b6d4',
  time_target  TEXT,
  duration_min INT,
  sort_order   INT DEFAULT 0
);
ALTER TABLE program_habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read program habits" ON program_habits;
CREATE POLICY "Read program habits" ON program_habits FOR SELECT
  USING (program_id IN (SELECT id FROM programs WHERE is_public=true OR is_template=true OR creator_id=auth.uid()));

-- ── 13. user_journeys ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_journeys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id   UUID REFERENCES programs(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  started_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  ended_at     DATE,
  target_days  INT  NOT NULL DEFAULT 21,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','extended','archived')),
  cycle        INT  NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_journeys_user ON user_journeys (user_id, status);
ALTER TABLE user_journeys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own journeys" ON user_journeys;
CREATE POLICY "Users manage own journeys" ON user_journeys FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 14. journey_habits ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS journey_habits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id   UUID NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  habit_id     UUID REFERENCES habits(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  action       TEXT,
  icon         TEXT DEFAULT 'check',
  color        TEXT DEFAULT '#8b5cf6',
  sort_order   INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_journey_habits_journey ON journey_habits (journey_id);
ALTER TABLE journey_habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own journey habits" ON journey_habits;
CREATE POLICY "Users see own journey habits" ON journey_habits FOR ALL
  USING (journey_id IN (SELECT id FROM user_journeys WHERE user_id = auth.uid()));

-- ── 15. habit_logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id     UUID REFERENCES habits(id) ON DELETE CASCADE,
  journey_id   UUID REFERENCES user_journeys(id) ON DELETE SET NULL,
  log_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  status       TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','skipped')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, habit_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date  ON habit_logs (user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs (habit_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_logs_journey    ON habit_logs (journey_id, log_date DESC);
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own habit_logs" ON habit_logs;
CREATE POLICY "Users manage own habit_logs" ON habit_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 16. user_tasks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  due_date      DATE NOT NULL,
  due_time      TIME,
  completed     BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  notified      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_date ON user_tasks (user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_user_tasks_pending   ON user_tasks (user_id, completed, due_date) WHERE completed=false;
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own tasks" ON user_tasks;
CREATE POLICY "Users manage own tasks" ON user_tasks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 17. collections ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'inbox',
  title        TEXT NOT NULL,
  url          TEXT,
  body         TEXT DEFAULT '',
  tags         TEXT[] DEFAULT '{}',
  source       TEXT,
  priority     TEXT,
  status       TEXT NOT NULL DEFAULT 'inbox',
  resolved     BOOLEAN DEFAULT false,
  course_name  TEXT,
  duration_min INT,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION update_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_collections_updated_at();
CREATE INDEX IF NOT EXISTS idx_collections_user_type    ON collections (user_id, type);
CREATE INDEX IF NOT EXISTS idx_collections_user_status  ON collections (user_id, status);
CREATE INDEX IF NOT EXISTS idx_collections_user_created ON collections (user_id, created_at DESC);
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "collections_select_own" ON collections;
DROP POLICY IF EXISTS "collections_insert_own" ON collections;
DROP POLICY IF EXISTS "collections_update_own" ON collections;
DROP POLICY IF EXISTS "collections_delete_own" ON collections;
CREATE POLICY "collections_select_own" ON collections FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "collections_insert_own" ON collections FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "collections_update_own" ON collections FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "collections_delete_own" ON collections FOR DELETE USING (user_id = auth.uid());

-- ── 18. expenses ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      INT NOT NULL,
  category    TEXT NOT NULL,
  note        TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date     ON expenses (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses (user_id, category);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses_select_own" ON expenses;
DROP POLICY IF EXISTS "expenses_insert_own" ON expenses;
DROP POLICY IF EXISTS "expenses_update_own" ON expenses;
DROP POLICY IF EXISTS "expenses_delete_own" ON expenses;
CREATE POLICY "expenses_select_own" ON expenses FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "expenses_insert_own" ON expenses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "expenses_update_own" ON expenses FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "expenses_delete_own" ON expenses FOR DELETE USING (user_id = auth.uid());

-- ── 19. subscriptions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount       INT NOT NULL,
  cycle        TEXT NOT NULL DEFAULT 'monthly',
  next_due     DATE NOT NULL,
  icon         TEXT DEFAULT 'package',
  color        TEXT DEFAULT '#8b5cf6',
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active ON subscriptions (user_id, active);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert_own" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_own" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_own" ON subscriptions;
CREATE POLICY "subscriptions_select_own" ON subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "subscriptions_insert_own" ON subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "subscriptions_update_own" ON subscriptions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "subscriptions_delete_own" ON subscriptions FOR DELETE USING (user_id = auth.uid());

-- ── 20. activity_logs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  label       TEXT,
  amount      INT,
  meta        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date   ON activity_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action ON activity_logs (user_id, action);
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_logs_select_own" ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_own" ON activity_logs;
CREATE POLICY "activity_logs_select_own" ON activity_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "activity_logs_insert_own" ON activity_logs FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── REALTIME ────────────────────────────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE profiles;       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE progress;        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE habits;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE focus_sessions;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE xp_logs;         EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── handle_new_user TRIGGER (final version v2.2.2) ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username  TEXT;
  final_username TEXT;
  counter        INT := 0;
BEGIN
  base_username := LOWER(REGEXP_REPLACE(
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email,'@',1)),
    '[^a-z0-9]','','g'));
  IF base_username = '' OR base_username IS NULL THEN base_username := 'user'; END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    counter := counter + 1; final_username := base_username || counter;
  END LOOP;
  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (NEW.id, final_username,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', final_username),
    NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO streaks (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  BEGIN
    INSERT INTO notification_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Seed: 5 system template programs ────────────────────────
INSERT INTO programs (title, description, icon, color, category, duration_days, is_template, is_public) VALUES
  ('Buoi Sang Ky Luat',  'Xay dung thoi quen buoi sang chien thang trong 21 ngay', 'sunrise',  '#f97316', 'health',       21, true, true),
  ('Thoi Quen Doc Sach', 'Doc sach moi ngay — 21 ngay hinh thanh thoi quen',        'book',     '#06b6d4', 'learning',     21, true, true),
  ('Mindful Morning',    'Thien, hit tho, va bat dau ngay moi voi tam tri sang',    'peace',    '#8b5cf6', 'mindfulness',  14, true, true),
  ('Ky Luat The Chat',   'Tap luyen deu dan, uong du nuoc, va ngu dung gio',        'muscle',   '#00ff88', 'health',       21, true, true),
  ('Deep Work 30 Ngay',  'Tap trung sau hon, toi da hoa nang suat',                 'rocket',   '#ffd700', 'productivity', 30, true, true)
ON CONFLICT DO NOTHING;

-- ── VERIFY ──────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

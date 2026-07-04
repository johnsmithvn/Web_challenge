-- ════════════════════════════════════════════════════════════════════════════
-- Life Hub — FULL CONSOLIDATED SCHEMA  v4.24.0
-- ════════════════════════════════════════════════════════════════════════════
-- ✅ CHỈ CẦN CHẠY FILE NÀY 1 LẦN trên Supabase → SQL Editor (fresh install).
-- Idempotent — an toàn chạy lại nhiều lần.
--
-- File này GỘP toàn bộ: schema_v4.4.0 + các migration v4.4.1 → v4.24.0.
-- Đã phản ánh trạng thái CUỐI CÙNG:
--   • mood_logs đã bị gỡ (v4.10.1) — không còn trong schema này
--   • user_tasks dùng `priority` (bỏ energy_level/duration_est) (v4.9.0)
--   • collections.type = 8 loại cuối (v4.14.0)
--   • thêm knowledge_groups / collection_groups / collection_notes (v4.11.0)
--   • thêm inspirational_quotes (v4.12.0)
--   • profiles: chỉ chủ tài khoản đọc được hàng mình + 4 hàm RPC (v4.24.0 — vá rò email)
--   • friendships: GIỮ LẠI nhưng đã archived/không dùng — an toàn để DROP nếu muốn
-- ════════════════════════════════════════════════════════════════════════════

-- Shared trigger function: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ── 1. profiles ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE, email TEXT, display_name TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_profiles_username ON profiles (username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email) WHERE email IS NOT NULL;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- v4.24.0: chỉ chủ tài khoản đọc được hàng của mình (trước đây USING(true) → rò email).
-- Nhu cầu cross-user (login, leaderboard, check trùng) đi qua các hàm RPC ở cuối file.
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());

-- ── 2. progress ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL, completed BOOLEAN NOT NULL DEFAULT FALSE,
  week_num SMALLINT NOT NULL DEFAULT 1, completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (user_id, date)
);
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "progress_select_own" ON progress;
CREATE POLICY "progress_select_own" ON progress FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "progress_insert_own" ON progress;
CREATE POLICY "progress_insert_own" ON progress FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "progress_update_own" ON progress;
CREATE POLICY "progress_update_own" ON progress FOR UPDATE USING (user_id = auth.uid());

-- ── 3. streaks ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS streaks (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0, longest_streak INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
-- Đọc chéo cho leaderboard giờ đi qua hàm get_leaderboard() (SECURITY DEFINER),
-- nên chỉ cần policy đọc hàng của mình.
DROP POLICY IF EXISTS "streaks_select_all" ON streaks;
DROP POLICY IF EXISTS "streaks_own" ON streaks;
CREATE POLICY "streaks_own" ON streaks FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 4. notification_settings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true, remind_time TIME DEFAULT '08:00',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_own" ON notification_settings;
CREATE POLICY "notif_own" ON notification_settings FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 5. habits ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  journey_id UUID, name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '⚡', color TEXT NOT NULL DEFAULT '#8B5CF6',
  category TEXT NOT NULL DEFAULT 'other', action TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','conquered','paused')),
  cycle_count INT NOT NULL DEFAULT 1, conquered_at TIMESTAMPTZ,
  time_target TIME, duration_min SMALLINT,
  active BOOLEAN NOT NULL DEFAULT TRUE, sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits (user_id, active);
CREATE INDEX IF NOT EXISTS idx_habits_user_status ON habits (user_id, status);
DROP TRIGGER IF EXISTS habits_updated_at ON habits;
CREATE TRIGGER habits_updated_at BEFORE UPDATE ON habits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "habits_own" ON habits;
CREATE POLICY "habits_own" ON habits FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 6. programs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL, description TEXT,
  icon TEXT DEFAULT '🎯', color TEXT DEFAULT '#8b5cf6',
  category TEXT DEFAULT 'other' CHECK (category IN ('health','learning','mindfulness','productivity','other')),
  duration_days INT NOT NULL DEFAULT 21,
  is_template BOOLEAN DEFAULT false, is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read public/template programs" ON programs;
CREATE POLICY "Read public/template programs" ON programs FOR SELECT
  USING (is_public = true OR is_template = true OR creator_id = auth.uid());
DROP POLICY IF EXISTS "Manage own programs" ON programs;
CREATE POLICY "Manage own programs" ON programs FOR ALL
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

-- ── 7. program_habits ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL, action TEXT,
  icon TEXT DEFAULT '✅', color TEXT DEFAULT '#06b6d4',
  time_target TEXT, duration_min INT, sort_order INT DEFAULT 0
);
ALTER TABLE program_habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read program habits" ON program_habits;
CREATE POLICY "Read program habits" ON program_habits FOR SELECT
  USING (program_id IN (SELECT id FROM programs WHERE is_public=true OR is_template=true OR creator_id=auth.uid()));

-- ── 8. user_journeys ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  title TEXT NOT NULL, description TEXT,
  started_at DATE NOT NULL DEFAULT CURRENT_DATE, ended_at DATE,
  target_days INT NOT NULL DEFAULT 21,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','extended','archived')),
  cycle INT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_journeys_user ON user_journeys (user_id, status);
ALTER TABLE user_journeys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own journeys" ON user_journeys;
CREATE POLICY "Users manage own journeys" ON user_journeys FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 9. journey_habits ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journey_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  name TEXT NOT NULL, action TEXT,
  icon TEXT DEFAULT '✅', color TEXT DEFAULT '#8b5cf6', sort_order INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_journey_habits_journey ON journey_habits (journey_id);
ALTER TABLE journey_habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own journey habits" ON journey_habits;
CREATE POLICY "Users see own journey habits" ON journey_habits FOR ALL
  USING (journey_id IN (SELECT id FROM user_journeys WHERE user_id = auth.uid()));

-- ── 10. habit_logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  journey_id UUID REFERENCES user_journeys(id) ON DELETE SET NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, habit_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs (user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs (habit_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_logs_journey ON habit_logs (journey_id, log_date DESC);
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own habit_logs" ON habit_logs;
CREATE POLICY "Users manage own habit_logs" ON habit_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 11. focus_sessions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  journey_id UUID REFERENCES user_journeys(id) ON DELETE SET NULL,
  duration_min SMALLINT NOT NULL DEFAULT 25,
  date DATE NOT NULL DEFAULT CURRENT_DATE, completed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_focus_user_date ON focus_sessions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_focus_journey ON focus_sessions (journey_id, date DESC);
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "focus_own" ON focus_sessions;
CREATE POLICY "focus_own" ON focus_sessions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- (mood_logs đã GỠ ở v4.10.1 — cố tình không có trong schema này)

-- ── 12. skip_reasons ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skip_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL, reason TEXT NOT NULL, note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_skip_user ON skip_reasons (user_id, date DESC);
ALTER TABLE skip_reasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "skip_own" ON skip_reasons;
CREATE POLICY "skip_own" ON skip_reasons FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 13. xp_logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount SMALLINT NOT NULL DEFAULT 0 CHECK (amount BETWEEN -200 AND 200),
  reason TEXT NOT NULL, meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_xp_logs_user ON xp_logs (user_id, created_at DESC);
ALTER TABLE xp_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "xp_own" ON xp_logs;
CREATE POLICY "xp_own" ON xp_logs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- v4.24.0: bỏ "xp_read_all" — leaderboard giờ tổng hợp qua get_leaderboard() (definer).
DROP POLICY IF EXISTS "xp_read_all" ON xp_logs;

-- ── 14. friendships (ARCHIVED v3.0.0 — không dùng; an toàn để DROP) ──────────
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships (addressee_id);
DROP TRIGGER IF EXISTS friendships_updated_at ON friendships;
CREATE TRIGGER friendships_updated_at BEFORE UPDATE ON friendships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "friendships_own" ON friendships;
CREATE POLICY "friendships_own" ON friendships FOR ALL
  USING (requester_id = auth.uid() OR addressee_id = auth.uid()) WITH CHECK (requester_id = auth.uid());

-- ── 15. user_tasks (v4.9.0: priority thay energy_level/duration_est) ─────────
CREATE TABLE IF NOT EXISTS user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT,
  due_date DATE NOT NULL, due_time TIME,
  priority SMALLINT NOT NULL DEFAULT 0,  -- 0=None,1=Lowest,2=Low,3=Medium,4=High,5=Urgent
  recurrence_rule JSONB,
  collection_id UUID,
  completed BOOLEAN NOT NULL DEFAULT false, completed_at TIMESTAMPTZ,
  notified BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Nâng cấp DB cũ (nếu chạy lại trên DB từng có energy_level/duration_est):
ALTER TABLE user_tasks DROP COLUMN IF EXISTS energy_level;
ALTER TABLE user_tasks DROP COLUMN IF EXISTS duration_est;
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_date ON user_tasks (user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_user_tasks_pending ON user_tasks (user_id, completed, due_date) WHERE completed=false;
CREATE INDEX IF NOT EXISTS idx_user_tasks_recurring ON user_tasks (user_id) WHERE recurrence_rule IS NOT NULL;
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own tasks" ON user_tasks;
CREATE POLICY "Users manage own tasks" ON user_tasks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 16. collections ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'inbox', title TEXT NOT NULL,
  url TEXT, body TEXT DEFAULT '', body_text TEXT,
  word_count INT DEFAULT 0, content_format VARCHAR(20) DEFAULT 'markdown',
  source TEXT, priority TEXT, status TEXT NOT NULL DEFAULT 'inbox',
  resolved BOOLEAN DEFAULT false, course_name TEXT, duration_min INT,
  reviewed_at TIMESTAMPTZ, snoozed_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION update_collections_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_collections_updated_at ON collections;
CREATE TRIGGER trg_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_collections_updated_at();
CREATE INDEX IF NOT EXISTS idx_collections_user_type ON collections (user_id, type);
CREATE INDEX IF NOT EXISTS idx_collections_user_status ON collections (user_id, status);
CREATE INDEX IF NOT EXISTS idx_collections_user_created ON collections (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_snooze ON collections (user_id, snoozed_until) WHERE snoozed_until IS NOT NULL;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "collections_select_own" ON collections;
CREATE POLICY "collections_select_own" ON collections FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "collections_insert_own" ON collections;
CREATE POLICY "collections_insert_own" ON collections FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "collections_update_own" ON collections;
CREATE POLICY "collections_update_own" ON collections FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "collections_delete_own" ON collections;
CREATE POLICY "collections_delete_own" ON collections FOR DELETE USING (user_id = auth.uid());

-- collections.type — migrate dữ liệu cũ rồi áp CHECK 8 loại cuối (v4.4.1 + v4.14.0)
UPDATE collections SET type = 'idea'  WHERE type = 'want';
UPDATE collections SET type = 'note'  WHERE type = 'link';
UPDATE collections SET type = 'learn' WHERE type = 'experience';
UPDATE collections SET type = 'learn' WHERE type = 'knowledge';
ALTER TABLE collections DROP CONSTRAINT IF EXISTS chk_collections_type;
ALTER TABLE collections ADD CONSTRAINT chk_collections_type
  CHECK (type IN ('inbox','note','quote','learn','idea','ai','entertainment','emotion'));

-- FK: user_tasks.collection_id → collections (deprecated, dùng task_collections)
DO $$ BEGIN
  ALTER TABLE user_tasks ADD CONSTRAINT fk_user_tasks_collection
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_user_tasks_collection_id ON user_tasks(collection_id) WHERE collection_id IS NOT NULL;
COMMENT ON COLUMN user_tasks.collection_id IS 'DEPRECATED v4.5.0: use task_collections junction table';

-- ── 17. task_collections (junction: user_tasks ↔ collections) ───────────────
CREATE TABLE IF NOT EXISTS task_collections (
  task_id       UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, collection_id)
);
ALTER TABLE task_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_collections_own" ON task_collections;
CREATE POLICY "task_collections_own" ON task_collections FOR ALL
  USING (EXISTS (SELECT 1 FROM user_tasks WHERE id = task_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM user_tasks WHERE id = task_id AND user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_task_collections_coll ON task_collections(collection_id);
-- Di chuyển dữ liệu 1:1 cũ (nếu có) vào junction
INSERT INTO task_collections (task_id, collection_id)
SELECT id, collection_id FROM user_tasks WHERE collection_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 18. expenses ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL, category TEXT NOT NULL, note TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses (user_id, category);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses_select_own" ON expenses;
CREATE POLICY "expenses_select_own" ON expenses FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "expenses_insert_own" ON expenses;
CREATE POLICY "expenses_insert_own" ON expenses FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "expenses_update_own" ON expenses;
CREATE POLICY "expenses_update_own" ON expenses FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "expenses_delete_own" ON expenses;
CREATE POLICY "expenses_delete_own" ON expenses FOR DELETE USING (user_id = auth.uid());

-- ── 19. subscriptions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, amount INT NOT NULL,
  cycle TEXT NOT NULL DEFAULT 'monthly', next_due DATE NOT NULL,
  icon TEXT DEFAULT '📦', color TEXT DEFAULT '#8b5cf6',
  active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active ON subscriptions (user_id, active);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
CREATE POLICY "subscriptions_select_own" ON subscriptions FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "subscriptions_insert_own" ON subscriptions;
CREATE POLICY "subscriptions_insert_own" ON subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "subscriptions_update_own" ON subscriptions;
CREATE POLICY "subscriptions_update_own" ON subscriptions FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "subscriptions_delete_own" ON subscriptions;
CREATE POLICY "subscriptions_delete_own" ON subscriptions FOR DELETE USING (user_id = auth.uid());

-- ── 20. activity_logs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, label TEXT, amount INT, meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date ON activity_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action ON activity_logs (user_id, action);
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_logs_select_own" ON activity_logs;
CREATE POLICY "activity_logs_select_own" ON activity_logs FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "activity_logs_insert_own" ON activity_logs;
CREATE POLICY "activity_logs_insert_own" ON activity_logs FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 21. tags + junctions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, color TEXT DEFAULT '#8b5cf6',
  created_at TIMESTAMPTZ DEFAULT now(), UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags_own" ON tags;
CREATE POLICY "tags_own" ON tags FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS collection_tags (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, tag_id)
);
CREATE TABLE IF NOT EXISTS expense_tags (
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (expense_id, tag_id)
);
CREATE TABLE IF NOT EXISTS subscription_tags (
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (subscription_id, tag_id)
);
ALTER TABLE collection_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "collection_tags_own" ON collection_tags;
CREATE POLICY "collection_tags_own" ON collection_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM collections WHERE id = collection_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "expense_tags_own" ON expense_tags;
CREATE POLICY "expense_tags_own" ON expense_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "subscription_tags_own" ON subscription_tags;
CREATE POLICY "subscription_tags_own" ON subscription_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM subscriptions WHERE id = subscription_id AND user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_collection_tags_coll ON collection_tags(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_tags_tag ON collection_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_expense_tags_expense ON expense_tags(expense_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tags_sub ON subscription_tags(subscription_id);

-- ── 22. intentions + intention_logs (Incubator; description từ v4.7.2) ───────
CREATE TABLE IF NOT EXISTS intentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, original_reason TEXT, description TEXT,
  estimated_cost NUMERIC(12,0), estimated_time SMALLINT,
  status TEXT NOT NULL DEFAULT 'incubating' CHECK (status IN ('incubating','executed','abandoned')),
  review_date DATE, converted_to TEXT[], converted_id UUID, converted_ids JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE intentions ADD COLUMN IF NOT EXISTS description TEXT; -- nâng cấp DB cũ
CREATE TABLE IF NOT EXISTS intention_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intention_id UUID NOT NULL REFERENCES intentions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created','deferred','executed','abandoned','reviewed')),
  reason_note TEXT, scheduled_for DATE, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intention_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intentions_own" ON intentions;
CREATE POLICY "intentions_own" ON intentions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "intention_logs_own" ON intention_logs;
CREATE POLICY "intention_logs_own" ON intention_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM intentions WHERE id = intention_id AND user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_intentions_user ON intentions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_intention_logs_intention ON intention_logs(intention_id);

-- ── 23. fitness_logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fitness_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_name TEXT NOT NULL, duration_min SMALLINT NOT NULL,
  energy TEXT NOT NULL CHECK (energy IN ('good','normal','bad')),
  notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE fitness_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fitness_own" ON fitness_logs;
CREATE POLICY "fitness_own" ON fitness_logs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_fitness_user_date ON fitness_logs(user_id, date DESC);

-- ── 24. knowledge_groups + collection_groups (v4.11.0) ──────────────────────
CREATE TABLE IF NOT EXISTS knowledge_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, emoji TEXT DEFAULT '📁', description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kgroups_user ON knowledge_groups(user_id);
ALTER TABLE knowledge_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kgroups_own" ON knowledge_groups;
CREATE POLICY "kgroups_own" ON knowledge_groups FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS collection_groups (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  group_id      UUID NOT NULL REFERENCES knowledge_groups(id) ON DELETE CASCADE,
  sort_order    SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_cgroups_group ON collection_groups(group_id);
ALTER TABLE collection_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cgroups_own" ON collection_groups;
CREATE POLICY "cgroups_own" ON collection_groups FOR ALL
  USING (EXISTS (SELECT 1 FROM collections WHERE id = collection_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM collections WHERE id = collection_id AND user_id = auth.uid()));

-- ── 25. collection_notes (v4.11.0) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collection_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL, sort_order SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cnotes_collection ON collection_notes(collection_id);
ALTER TABLE collection_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cnotes_own" ON collection_notes;
CREATE POLICY "cnotes_own" ON collection_notes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 26. inspirational_quotes (v4.12.0) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspirational_quotes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL, author TEXT, audio_url TEXT, source TEXT,
  is_active  BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quotes_user_active ON inspirational_quotes(user_id, is_active);
ALTER TABLE inspirational_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own quotes" ON inspirational_quotes;
CREATE POLICY "Users manage own quotes" ON inspirational_quotes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE profiles; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE progress; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE habits; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE focus_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE xp_logs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- AUTH TRIGGER: tự tạo profile/streaks/notification_settings khi có user mới
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT; final_username TEXT; counter INT := 0;
BEGIN
  base_username := LOWER(REGEXP_REPLACE(
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(NEW.email,'@',1)
    ),
    '[^a-z0-9_.]','','g'));
  IF base_username = '' OR base_username IS NULL THEN base_username := 'user'; END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    counter := counter + 1; final_username := base_username || counter;
  END LOOP;

  BEGIN
    INSERT INTO profiles (id, username, display_name, avatar_url, email)
    VALUES (
      NEW.id, final_username,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', final_username),
      NEW.raw_user_meta_data->>'avatar_url', NEW.email
    ) ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[handle_new_user] profiles insert failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO streaks (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[handle_new_user] streaks insert failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO notification_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════════
-- v4.24.0 — Hàm cross-user an toàn (KHÔNG lộ email). Bù cho việc profiles giờ
-- chỉ đọc-hàng-mình. Frontend gọi qua supabase.rpc(...).
-- ════════════════════════════════════════════════════════════════════════════

-- Đăng nhập: username → email
DROP FUNCTION IF EXISTS public.login_email(text);
CREATE FUNCTION public.login_email(p_username text)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.profiles WHERE username = lower(p_username) LIMIT 1;
$$;

-- Đăng ký: username đã tồn tại chưa?
DROP FUNCTION IF EXISTS public.username_exists(text);
CREATE FUNCTION public.username_exists(p_username text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE username = lower(p_username));
$$;

-- Đăng ký/Cài đặt: email đã dùng bởi NGƯỜI KHÁC chưa? (loại trừ chính mình)
DROP FUNCTION IF EXISTS public.email_exists(text);
CREATE FUNCTION public.email_exists(p_email text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(email) = lower(p_email)
      AND (auth.uid() IS NULL OR id <> auth.uid())
  );
$$;

-- Leaderboard: tên + thống kê (KHÔNG email), tính server-side
DROP FUNCTION IF EXISTS public.get_leaderboard();
CREATE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  id uuid, display_name text, avatar_url text,
  current_streak int, longest_streak int,
  total_xp bigint, total_done bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.avatar_url,
         COALESCE(s.current_streak, 0) AS current_streak,
         COALESCE(s.longest_streak, 0) AS longest_streak,
         COALESCE(x.total_xp, 0)       AS total_xp,
         COALESCE(d.total_done, 0)     AS total_done
  FROM public.profiles p
  LEFT JOIN public.streaks s ON s.user_id = p.id
  LEFT JOIN (SELECT user_id, SUM(amount)::bigint AS total_xp FROM public.xp_logs GROUP BY user_id) x ON x.user_id = p.id
  LEFT JOIN (SELECT user_id, COUNT(*)::bigint AS total_done FROM public.progress WHERE completed GROUP BY user_id) d ON d.user_id = p.id
  ORDER BY total_xp DESC, current_streak DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.login_email(text)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.username_exists(text)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_exists(text)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard()      TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- SEED: 5 lộ trình mẫu (chỉ thêm nếu chưa có)
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO programs (title, description, icon, color, category, duration_days, is_template, is_public) VALUES
  ('Buoi Sang Ky Luat', 'Xay dung thoi quen buoi sang', '🌅', '#f97316', 'health', 21, true, true),
  ('Thoi Quen Doc Sach', 'Doc sach moi ngay', '📚', '#06b6d4', 'learning', 21, true, true),
  ('Mindful Morning', 'Thien va hit tho', '🧘', '#8b5cf6', 'mindfulness', 14, true, true),
  ('Ky Luat The Chat', 'Tap luyen deu dan', '💪', '#00ff88', 'health', 21, true, true),
  ('Deep Work 30 Ngay', 'Tap trung sau hon', '🚀', '#ffd700', 'productivity', 30, true, true)
ON CONFLICT DO NOTHING;

-- ✅ DONE — 26 bảng + RLS + indexes + triggers + functions + seed (idempotent).

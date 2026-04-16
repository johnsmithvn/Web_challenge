-- ════════════════════════════════════════════════════════════════
-- Team Mode v3 — FULL SCHEMA (Fresh Supabase Project)
-- Run this in: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ─── 0. profiles (extends Supabase auth.users) ───────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 1. progress (habit tracking per day) ────────────────────────
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

-- ─── 2. streaks ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS streaks (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. teams ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code  TEXT NOT NULL UNIQUE,
  name         TEXT,
  max_members  SMALLINT DEFAULT 2,
  created_by   UUID REFERENCES profiles(id),
  status       TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'active'
  activated_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. team_members (junction — N per team) ──────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',    -- 'owner' | 'member'
  week_sync   TEXT NOT NULL DEFAULT 'continue',  -- 'restart' | 'continue'
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- ─── 5. user_programs (per-user 21-day journey) ──────────────────
CREATE TABLE IF NOT EXISTS user_programs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  current_week SMALLINT NOT NULL DEFAULT 1,
  reset_count  INT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'completed' | 'paused'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_user_programs_active
  ON user_programs (user_id) WHERE status = 'active';

-- ─── 6. team_check_logs (week-2 accountability) ──────────────────
CREATE TABLE IF NOT EXISTS team_check_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  checker_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      BOOLEAN NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, checked_id, date)
);

-- ─── 7. team_rules ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rule_type   TEXT NOT NULL,   -- 'reward' | 'punishment'
  trigger     TEXT NOT NULL,   -- 'miss_day' | 'streak_7' | 'complete_week2' | 'custom'
  description TEXT NOT NULL,
  amount_vnd  INT,
  proposed_by UUID REFERENCES profiles(id),
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'active' | 'rejected'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 8. team_rule_agreements ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_rule_agreements (
  rule_id    UUID NOT NULL REFERENCES team_rules(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agreed     BOOLEAN NOT NULL DEFAULT FALSE,
  agreed_at  TIMESTAMPTZ,
  PRIMARY KEY (rule_id, user_id)
);

-- ─── 9. reactions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji        TEXT NOT NULL,
  date         DATE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_user_id, to_user_id, emoji, date)
);

-- ─── 10. friends ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friends (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'declined'
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, friend_id)
);

-- ════════════════════════════════════════════════════════════════
-- REALTIME
-- ════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE progress;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE team_check_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE team_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE team_rule_agreements;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE friends;

-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all"  ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE USING (id = auth.uid());

-- progress
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_select_own"  ON progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "progress_insert_own"  ON progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress_update_own"  ON progress FOR UPDATE USING (user_id = auth.uid());

-- streaks
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streaks_select_all"   ON streaks FOR SELECT USING (true);
CREATE POLICY "streaks_upsert_own"   ON streaks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "streaks_update_own"   ON streaks FOR UPDATE USING (user_id = auth.uid());

-- teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_select_member"  ON teams FOR SELECT USING (
  id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  OR created_by = auth.uid()
);
CREATE POLICY "teams_insert_auth"    ON teams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "teams_update_member"  ON teams FOR UPDATE USING (
  id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);

-- team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tm_select_same_team"  ON team_members FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "tm_insert_own"        ON team_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "tm_delete_own"        ON team_members FOR DELETE USING (user_id = auth.uid());

-- user_programs
ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programs_own"         ON user_programs FOR ALL USING (user_id = auth.uid());

-- team_check_logs
ALTER TABLE team_check_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checks_select_team"   ON team_check_logs FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "checks_insert_own"    ON team_check_logs FOR INSERT WITH CHECK (checker_id = auth.uid());
CREATE POLICY "checks_update_own"    ON team_check_logs FOR UPDATE USING (checker_id = auth.uid());

-- team_rules
ALTER TABLE team_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules_select_team"    ON team_rules FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "rules_insert_member"  ON team_rules FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  AND proposed_by = auth.uid()
);
CREATE POLICY "rules_update_member"  ON team_rules FOR UPDATE USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);

-- team_rule_agreements
ALTER TABLE team_rule_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agreements_select"    ON team_rule_agreements FOR SELECT USING (
  rule_id IN (
    SELECT id FROM team_rules WHERE team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "agreements_upsert"    ON team_rule_agreements FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "agreements_update"    ON team_rule_agreements FOR UPDATE USING (user_id = auth.uid());

-- reactions
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_select_all" ON reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert_own" ON reactions FOR INSERT WITH CHECK (from_user_id = auth.uid());

-- friends
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friends_select_own"   ON friends FOR SELECT USING (
  user_id = auth.uid() OR friend_id = auth.uid()
);
CREATE POLICY "friends_insert_own"   ON friends FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "friends_update_own"   ON friends FOR UPDATE USING (
  user_id = auth.uid() OR friend_id = auth.uid()
);

-- ════════════════════════════════════════════════════════════════
-- VERIFY — chạy dòng này riêng để kiểm tra
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
-- ════════════════════════════════════════════════════════════════

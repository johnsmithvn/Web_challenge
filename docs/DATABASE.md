# DATABASE DESIGN — Thử Thách Vượt Lười
**Target:** Supabase (PostgreSQL)
**Version:** v2.2.2
**Updated:** 2026-04-25
**Strategy:** Production-ready from day 1

---

## Entity Overview

```
auth.users (Supabase built-in)
    │
    ▼
profiles ──────────────────────────────────────┐
    │                                           │
    ├──► progress          (daily check)        │
    ├──► streaks           (cached trigger)     │
    ├──► xp_logs           (immutable events)   │
    ├──► habits            (custom + journey)    │
    ├──► habit_logs        (per-habit daily)     │
    ├──► focus_sessions    (pomodoro)            │
    ├──► mood_logs / skip_reasons               │
    ├──► quiz_attempts / daily_challenge_comp.  │
    ├──► notification_settings  (1:1)           │
    ├──► partner_queue     (auto-match)         │
    │                                           │
    ├──► user_journeys     (journey runs)       │
    ├──► journey_habits    (snapshot per run)   │
    │                                           │
    ├──► teams             (member1 or member2) │
    ├──► reactions         (from or to)         │
    └──► friendships       (requester/addressee)┘

programs ──► program_habits   (template library, system + user)
```

---

## Full SQL Schema

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url   TEXT,
  bio          TEXT,
  timezone     TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE INDEX idx_profiles_username_trgm ON profiles USING GIN (username gin_trgm_ops);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. PROGRESS (daily habit check — source of truth)
-- ============================================================
CREATE TABLE progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  week_num     SMALLINT NOT NULL CHECK (week_num BETWEEN 1 AND 3),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_progress_user_date ON progress (user_id, date DESC);
CREATE INDEX idx_progress_date      ON progress (date);

-- ============================================================
-- 3. STREAKS (cached, updated by trigger)
-- ============================================================
CREATE TABLE streaks (
  user_id          UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak   INT NOT NULL DEFAULT 0,
  longest_streak   INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  total_done       INT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION refresh_streak()
RETURNS TRIGGER AS $$
DECLARE
  v_streak  INT := 0;
  v_longest INT := 0;
  v_total   INT;
  v_last    DATE;
  v_check   DATE := CURRENT_DATE;
BEGIN
  SELECT COUNT(*) INTO v_total FROM progress
    WHERE user_id = NEW.user_id AND completed = TRUE;

  SELECT MAX(date) INTO v_last FROM progress
    WHERE user_id = NEW.user_id AND completed = TRUE;

  LOOP
    PERFORM 1 FROM progress
      WHERE user_id = NEW.user_id AND date = v_check AND completed = TRUE;
    EXIT WHEN NOT FOUND;
    v_streak := v_streak + 1;
    v_check  := v_check - INTERVAL '1 day';
  END LOOP;

  SELECT COALESCE(MAX(run), 0) INTO v_longest FROM (
    SELECT COUNT(*) AS run FROM (
      SELECT date,
        date - (ROW_NUMBER() OVER (ORDER BY date))::INT * INTERVAL '1 day' AS grp
      FROM progress
      WHERE user_id = NEW.user_id AND completed = TRUE
    ) t GROUP BY grp
  ) s;

  INSERT INTO streaks (user_id, current_streak, longest_streak, last_active_date, total_done, updated_at)
  VALUES (NEW.user_id, v_streak, v_longest, v_last, v_total, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak   = EXCLUDED.current_streak,
    longest_streak   = EXCLUDED.longest_streak,
    last_active_date = EXCLUDED.last_active_date,
    total_done       = EXCLUDED.total_done,
    updated_at       = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_refresh_streak
  AFTER INSERT OR UPDATE ON progress
  FOR EACH ROW EXECUTE FUNCTION refresh_streak();

-- ============================================================
-- 4. XP_LOGS (immutable event log)
-- ============================================================
CREATE TABLE xp_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount     SMALLINT NOT NULL DEFAULT 0,
  reason     TEXT NOT NULL,
  meta       JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT xp_amount_range CHECK (amount BETWEEN -200 AND 200)  -- v2.2.2 security
);

CREATE INDEX idx_xp_logs_user ON xp_logs (user_id, created_at DESC);

CREATE OR REPLACE VIEW user_xp AS
  SELECT user_id, SUM(amount)::INT AS total_xp
  FROM xp_logs GROUP BY user_id;

-- ============================================================
-- 5. TEAMS (exactly 2 members)
-- ============================================================
CREATE TYPE team_status AS ENUM ('pending', 'active', 'dissolved');

CREATE TABLE teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code  TEXT UNIQUE NOT NULL,
  member1_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member2_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status       team_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  dissolved_at TIMESTAMPTZ
);

CREATE INDEX idx_teams_member1 ON teams (member1_id);
CREATE INDEX idx_teams_member2 ON teams (member2_id);
CREATE INDEX idx_teams_invite  ON teams (invite_code);

-- ============================================================
-- 6. REACTIONS
-- ============================================================
CREATE TABLE reactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji        TEXT NOT NULL,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_user_id, to_user_id, emoji, date)
);

-- ============================================================
-- 7. FRIENDSHIPS
-- ============================================================
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');

CREATE TABLE friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       friendship_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX idx_friendships_addressee ON friendships (addressee_id, status);
CREATE INDEX idx_friendships_requester ON friendships (requester_id, status);

CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 8. QUIZ_ATTEMPTS
-- ============================================================
CREATE TABLE quiz_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score        SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 10),
  xp_earned    SMALLINT NOT NULL DEFAULT 0,
  answers      JSONB NOT NULL DEFAULT '[]',
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_user ON quiz_attempts (user_id, completed_at DESC);

-- ============================================================
-- 9. DAILY_CHALLENGE_COMPLETIONS
-- ============================================================
CREATE TABLE daily_challenge_completions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL DEFAULT CURRENT_DATE,
  challenge_key  TEXT NOT NULL,
  xp_earned      SMALLINT NOT NULL DEFAULT 20,
  completed_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, challenge_date)
);

-- ============================================================
-- 10. NOTIFICATION_SETTINGS (1:1 with profiles)
-- ============================================================
CREATE TABLE notification_settings (
  user_id       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_time TIME NOT NULL DEFAULT '21:00:00',
  timezone      TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  push_token    TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. PARTNER_QUEUE (auto-match)
-- ============================================================
CREATE TABLE partner_queue (
  user_id   UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  goals     TEXT[],
  timezone  TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_logs                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenge_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_queue               ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION is_teammate(other_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM teams WHERE status = 'active'
    AND ((member1_id = auth.uid() AND member2_id = other_id)
      OR (member2_id = auth.uid() AND member1_id = other_id))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_friend(other_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships WHERE status = 'accepted'
    AND ((requester_id = auth.uid() AND addressee_id = other_id)
      OR (addressee_id = auth.uid() AND requester_id = other_id))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles
CREATE POLICY "profiles_read"   ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Progress
CREATE POLICY "progress_select_own"  ON progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "progress_select_team" ON progress FOR SELECT USING (
  user_id IN (
    SELECT tm2.user_id FROM team_members tm1
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
  )
);
CREATE POLICY "progress_insert" ON progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress_update" ON progress FOR UPDATE USING (user_id = auth.uid());

-- Streaks (public read for leaderboard, write only via trigger)
CREATE POLICY "streaks_read"  ON streaks FOR SELECT USING (true);
-- No client INSERT/UPDATE — streaks updated only by refresh_streak() trigger (SECURITY DEFINER)

-- XP
CREATE POLICY "xp_read"   ON xp_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "xp_insert" ON xp_logs FOR INSERT WITH CHECK (user_id = auth.uid());

-- Teams
CREATE POLICY "teams_read"   ON teams FOR SELECT USING (member1_id = auth.uid() OR member2_id = auth.uid());
CREATE POLICY "teams_create" ON teams FOR INSERT WITH CHECK (member1_id = auth.uid());
CREATE POLICY "teams_join"   ON teams FOR UPDATE USING (member2_id IS NULL AND member1_id <> auth.uid() OR member1_id = auth.uid());

-- Reactions
CREATE POLICY "reactions_read"   ON reactions FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY "reactions_insert" ON reactions FOR INSERT WITH CHECK (from_user_id = auth.uid() AND is_teammate(to_user_id));

-- Friendships
CREATE POLICY "friendships_read"   ON friendships FOR SELECT USING (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE POLICY "friendships_insert" ON friendships FOR INSERT WITH CHECK (requester_id = auth.uid());
CREATE POLICY "friendships_update" ON friendships FOR UPDATE USING (addressee_id = auth.uid());

-- Own-only tables
CREATE POLICY "quiz_own"      ON quiz_attempts               FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "challenge_own" ON daily_challenge_completions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_own"     ON notification_settings       FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "queue_own"     ON partner_queue               FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- REALTIME (enable these tables)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE progress;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE streaks;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username  TEXT;
  final_username TEXT;
  counter        INT := 0;
BEGIN
  base_username := LOWER(REGEXP_REPLACE(
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    '[^a-z0-9]', '', 'g'
  ));
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter;
  END LOOP;

  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'name', final_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO streaks (user_id) VALUES (NEW.id);
  INSERT INTO notification_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- v1.2 ADDITIONS: Custom Habits, Focus Sessions, Mood, Skip
-- ============================================================

-- 12. HABITS (custom user-defined habits)
CREATE TABLE habits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT '⚡',
  color        TEXT NOT NULL DEFAULT '#8B5CF6',
  category     TEXT NOT NULL DEFAULT 'other',
  action       TEXT,                                    -- v1.4.0: specific action description
  time_target  TIME,
  duration_min SMALLINT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  status       TEXT DEFAULT 'active',                   -- v1.4.0: active/conquered/archived
  cycle_count  SMALLINT DEFAULT 0,                      -- v1.4.0: number of 21-day cycles completed
  conquered_at TIMESTAMPTZ,                             -- v1.4.0: when habit reached 21 days
  journey_id   UUID REFERENCES user_journeys(id),       -- v1.5.0: link to journey
  sort_order   SMALLINT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_habits_user ON habits (user_id, active);

CREATE TRIGGER habits_updated_at
  BEFORE UPDATE ON habits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habits_own" ON habits FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 13. FOCUS_SESSIONS (Pomodoro sessions)
CREATE TABLE focus_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id     UUID REFERENCES habits(id) ON DELETE SET NULL,
  journey_id   UUID REFERENCES user_journeys(id),       -- v1.8.0: link to journey
  duration_min SMALLINT NOT NULL DEFAULT 25,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_focus_user_date ON focus_sessions (user_id, date DESC);

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "focus_own" ON focus_sessions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 14. MOOD_LOGS (daily mood check — 1 per day)
CREATE TABLE mood_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  mood_emoji TEXT NOT NULL,
  mood_label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_mood_user ON mood_logs (user_id, date DESC);

ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mood_own" ON mood_logs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 15. SKIP_REASONS (why user missed a habit day)
CREATE TABLE skip_reasons (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  reason     TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_skip_user ON skip_reasons (user_id, date DESC);

ALTER TABLE skip_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "skip_own" ON skip_reasons FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE habits;
ALTER PUBLICATION supabase_realtime ADD TABLE focus_sessions;

-- ============================================================
-- v1.5 ADDITIONS: Journey System (run data/migration_v1.5.0.sql)
-- ============================================================

-- 16. PROGRAMS (journey templates)
CREATE TABLE programs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL DEFAULT 'other',
  target_days  SMALLINT NOT NULL DEFAULT 21,
  is_system    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programs_read" ON programs FOR SELECT USING (true);
CREATE POLICY "programs_create" ON programs FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 17. PROGRAM_HABITS (template habit definitions)
CREATE TABLE program_habits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT '⚡',
  color        TEXT NOT NULL DEFAULT '#8B5CF6',
  category     TEXT NOT NULL DEFAULT 'other',
  action       TEXT,
  duration_min SMALLINT,
  sort_order   SMALLINT DEFAULT 0
);

ALTER TABLE program_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "program_habits_read" ON program_habits FOR SELECT USING (true);

-- 18. USER_JOURNEYS (each run of a program)
CREATE TABLE user_journeys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id   UUID REFERENCES programs(id),
  title        TEXT NOT NULL,
  description  TEXT,
  target_days  SMALLINT NOT NULL DEFAULT 21,
  started_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  ended_at     DATE,
  status       TEXT NOT NULL DEFAULT 'active',   -- active / completed / archived / extended
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_journeys_user ON user_journeys (user_id, status);

ALTER TABLE user_journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journeys_own" ON user_journeys FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 19. JOURNEY_HABITS (snapshot of habits at journey start)
CREATE TABLE journey_habits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id   UUID NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  habit_id     UUID REFERENCES habits(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT '⚡',
  color        TEXT NOT NULL DEFAULT '#8B5CF6'
);

ALTER TABLE journey_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journey_habits_own" ON journey_habits FOR ALL
  USING (EXISTS (SELECT 1 FROM user_journeys WHERE id = journey_id AND user_id = auth.uid()));

-- 20. HABIT_LOGS (per-habit daily completion — replaces vl_habit_progress)
CREATE TABLE habit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id     UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  journey_id   UUID REFERENCES user_journeys(id),
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  completed    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, habit_id, date)
);

CREATE INDEX idx_habit_logs_user ON habit_logs (user_id, date DESC);

ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habit_logs_own" ON habit_logs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- v2.1.0 ADDITIONS: Personal Tasks (run data/migration_v2.1.0.sql)
-- ============================================================

-- 21. USER_TASKS (personal to-do items)
CREATE TABLE user_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  due_date      DATE NOT NULL,
  due_time      TIME,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  notified      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_tasks_user_date ON user_tasks (user_id, due_date);
CREATE INDEX idx_user_tasks_pending ON user_tasks (user_id, completed, due_date) WHERE completed = false;

ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_own" ON user_tasks FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```


---

## XP System

| Event | XP | Frequency |
|-------|-----|----------|
| Daily check ✓ | +10 | Per habit/day (deduped) |
| Streak 3 | +50 | One-time |
| Streak 10 | +100 | One-time |
| Streak 21 | +200 | One-time |
| Daily Challenge | +20 | Max 1/day |
| Quiz | +10–50 | Per attempt (score-based) |
| Focus Session | +15 | Per session (deduped) |
| Duo streak | +30 | Per day (v3 planned) |

## Level Thresholds

| Level | Name | XP |
|-------|------|----|
| 0 | 🌱 Người Mới | 0 |
| 1 | ⚡ Luyện Sĩ | 100 |
| 2 | 🔥 Đệ Tử | 300 |
| 3 | ⚔️ Chiến Binh | 700 |
| 4 | 👑 Huyền Thoại | 1500 |
| 5 | 🏆 Vô Địch | 3000 |

## Leaderboard Query

```sql
SELECT
  p.id, p.display_name, p.avatar_url,
  s.current_streak, s.longest_streak, s.total_done,
  COALESCE(x.total_xp, 0) AS total_xp
FROM profiles p
JOIN streaks s ON s.user_id = p.id
LEFT JOIN user_xp x ON x.user_id = p.id
ORDER BY s.current_streak DESC, total_xp DESC
LIMIT 20;
```

## Migration Strategy (localStorage → Supabase)

**v1.6.2+ architecture:** Supabase is primary for ALL user data. localStorage only stores UI flags.

On first login (one-time per data type):
1. Read `vl_habit_data` from localStorage → upsert into `progress` → wipe local
2. Read `vl_custom_habits` → upsert into `habits` → wipe local
3. Read `vl_xp_store` → insert into `xp_logs` → wipe local
4. Read `vl_habit_progress` → insert into `habit_logs` → wipe local
5. Read `vl_focus_sessions` → insert into `focus_sessions` → wipe local
6. Set `vl_migrated_v2 = userId` flag in localStorage
7. Subsequent reads → Supabase only

## Migration Files

| File | Version | Content |
|------|---------|----------|
| `data/migration_v1.2.0.sql` | v1.2.0 | Create habits, focus_sessions, mood_logs, skip_reasons |
| `data/migration_v1.4.0.sql` | v1.4.0 | Add action/status/cycle_count/conquered_at to habits |
| `data/migration_v1.5.0.sql` | v1.5.0 | Create programs, program_habits, user_journeys, journey_habits, habit_logs + seed 5 templates |
| `data/migration_v1.6.2.sql` | v1.6.2 | Create xp_logs, friendships + enable Realtime |
| `data/migration_v1.9.0.sql` | v1.9.0 | Update handle_new_user trigger, seed program_habits |
| `data/supabase_team_v3.sql` | v3.0.0 | team_members, user_programs, team_check_logs, team_rules, team_rule_agreements |
| `data/migration_v2.1.0.sql` | v2.1.0 | user_tasks table + RLS + indexes |
| `data/migration_v2.2.2_security.sql` | v2.2.2 | RLS fixes: progress team read, self-check block, streaks write lock, xp_logs constraint, trigger merge |

## Supabase Setup Checklist

- [ ] Create project (region: Southeast Asia – Singapore)
- [ ] Run migration SQL files in order (v1.2.0 → v1.4.0 → v1.5.0 → v1.6.2 → v1.9.0 → v2.1.0)
- [ ] Enable Realtime for: progress, reactions, streaks, teams, xp_logs, habits, focus_sessions
- [ ] Enable Google OAuth (Auth → Providers → Google)
- [ ] Get URL + anon key from Project Settings → API
- [ ] Create `.env.local` with the two keys
- [ ] Verify `on_auth_user_created` trigger fires on test signup

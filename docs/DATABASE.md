# DATABASE DESIGN — Thử Thách Vượt Lười
**Target:** Supabase (PostgreSQL)
**Version:** v2.0.0
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
    ├──► quiz_attempts                          │
    ├──► daily_challenge_completions            │
    ├──► notification_settings  (1:1)           │
    ├──► partner_queue     (auto-match)         │
    │                                           │
    ├──► teams             (member1 or member2) │
    ├──► reactions         (from or to)         │
    └──► friendships       (requester/addressee)┘
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
-- 4. XP_LOGS (immutable — NEVER update or delete)
-- ============================================================
CREATE TYPE xp_reason AS ENUM (
  'daily_check', 'streak_3', 'streak_10', 'streak_21',
  'quiz_complete', 'daily_challenge', 'team_duo_streak',
  'friend_joined', 'manual_admin'
);

CREATE TABLE xp_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  xp_amount  SMALLINT NOT NULL,
  reason     xp_reason NOT NULL,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_xp_logs_user ON xp_logs (user_id, created_at DESC);

CREATE OR REPLACE VIEW user_xp AS
  SELECT user_id, SUM(xp_amount)::INT AS total_xp
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
CREATE POLICY "progress_read"   ON progress FOR SELECT USING (user_id = auth.uid() OR is_teammate(user_id));
CREATE POLICY "progress_insert" ON progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress_update" ON progress FOR UPDATE USING (user_id = auth.uid());

-- Streaks (public read for leaderboard)
CREATE POLICY "streaks_read"  ON streaks FOR SELECT USING (true);
CREATE POLICY "streaks_write" ON streaks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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
```

---

## XP System

| Event | XP | Frequency |
|-------|-----|----------|
| Daily check ✓ | +10 | Per day (deduped) |
| Streak 3 | +50 | One-time |
| Streak 10 | +100 | One-time |
| Streak 21 | +200 | One-time |
| Daily Challenge | +20 | Max 1/day |
| Quiz | +10–50 | Per attempt (score-based) |
| Duo streak | +30 | Per day (v2) |

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

On first login:
1. Read `vl_habit_data` from localStorage
2. Upsert each entry into `progress` table
3. Compute XP from history → insert `xp_logs` entries
4. Set `vl_migrated = true` flag in localStorage
5. Subsequent reads → Supabase only

## Supabase Setup Checklist

- [ ] Create project (region: Southeast Asia – Singapore)
- [ ] Run full SQL schema above in SQL Editor
- [ ] Enable Realtime for: progress, reactions, streaks, teams
- [ ] Enable Google OAuth (Auth → Providers → Google)
- [ ] Get URL + anon key from Project Settings → API
- [ ] Create `.env.local` with the two keys
- [ ] Verify `on_auth_user_created` trigger fires on test signup

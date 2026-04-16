-- ════════════════════════════════════════════════════════════════
-- Team Mode v3 — Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Upgrade teams table ──────────────────────────────────────
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS name         TEXT,
  ADD COLUMN IF NOT EXISTS max_members  SMALLINT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- ─── 2. team_members (junction table — N members per team) ────────
CREATE TABLE IF NOT EXISTS team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',   -- 'owner' | 'member'
  week_sync   TEXT NOT NULL DEFAULT 'continue', -- 'restart' | 'continue'
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- ─── 3. user_programs (per-user 21-day journey) ──────────────────
CREATE TABLE IF NOT EXISTS user_programs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  current_week SMALLINT NOT NULL DEFAULT 1,
  reset_count  INT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active', -- 'active' | 'completed' | 'paused'
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Only 1 active program per user
CREATE UNIQUE INDEX IF NOT EXISTS uidx_user_programs_active
  ON user_programs (user_id) WHERE status = 'active';

-- ─── 4. team_check_logs (week-2 accountability checks) ──────────
CREATE TABLE IF NOT EXISTS team_check_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  checker_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      BOOLEAN NOT NULL,         -- true = done, false = fail
  reason      TEXT,                     -- required when status = false
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, checked_id, date)   -- 1 official check per person per day
);

-- ─── 5. team_rules ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rule_type   TEXT NOT NULL,  -- 'reward' | 'punishment'
  trigger     TEXT NOT NULL,  -- 'miss_day' | 'streak_7' | 'complete_week2' | 'custom'
  description TEXT NOT NULL,
  amount_vnd  INT,
  proposed_by UUID REFERENCES profiles(id),
  status      TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'rejected'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 6. team_rule_agreements (approval flow) ─────────────────────
CREATE TABLE IF NOT EXISTS team_rule_agreements (
  rule_id    UUID NOT NULL REFERENCES team_rules(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agreed     BOOLEAN NOT NULL DEFAULT FALSE,
  agreed_at  TIMESTAMPTZ,
  PRIMARY KEY (rule_id, user_id)
);

-- ─── 7. Enable Realtime for all new tables ───────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE team_check_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE team_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE team_rule_agreements;
ALTER PUBLICATION supabase_realtime ADD TABLE user_programs;

-- ─── 8. Row Level Security ───────────────────────────────────────

-- team_members: read if in same team, write own row
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_select" ON team_members
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "team_members_insert" ON team_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "team_members_delete" ON team_members
  FOR DELETE USING (user_id = auth.uid());

-- user_programs: own rows only
ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_programs_own" ON user_programs
  FOR ALL USING (user_id = auth.uid());

-- team_check_logs: read if in team, insert /update own rows as checker
ALTER TABLE team_check_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_logs_select" ON team_check_logs
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "check_logs_upsert" ON team_check_logs
  FOR INSERT WITH CHECK (checker_id = auth.uid());

CREATE POLICY "check_logs_update" ON team_check_logs
  FOR UPDATE USING (checker_id = auth.uid());

-- team_rules: read/write if in team
ALTER TABLE team_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_rules_select" ON team_rules
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "team_rules_insert" ON team_rules
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
    AND proposed_by = auth.uid()
  );

CREATE POLICY "team_rules_update" ON team_rules
  FOR UPDATE USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- team_rule_agreements: own rows
ALTER TABLE team_rule_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agreements_select" ON team_rule_agreements
  FOR SELECT USING (
    rule_id IN (
      SELECT id FROM team_rules WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "agreements_upsert" ON team_rule_agreements
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "agreements_update" ON team_rule_agreements
  FOR UPDATE USING (user_id = auth.uid());

-- ─── Done ─────────────────────────────────────────────────────────
-- Verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- ============================================================
-- MIGRATION v1.6.2 — Missing tables: xp_logs, friendships
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. XP_LOGS (immutable XP event log) ──────────────────────
CREATE TABLE IF NOT EXISTS xp_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount     SMALLINT NOT NULL DEFAULT 0,
  reason     TEXT NOT NULL,
  meta       JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_logs_user ON xp_logs (user_id, created_at DESC);

ALTER TABLE xp_logs ENABLE ROW LEVEL SECURITY;

-- Own read/write
DROP POLICY IF EXISTS "xp_own"     ON xp_logs;
CREATE POLICY "xp_own" ON xp_logs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Leaderboard: allow authenticated users to read all (for ranking)
DROP POLICY IF EXISTS "xp_read_all" ON xp_logs;
CREATE POLICY "xp_read_all" ON xp_logs FOR SELECT
  USING (auth.role() = 'authenticated');


-- ── 2. FRIENDSHIPS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'  -- 'pending' | 'accepted' | 'declined'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships (addressee_id);

DROP TRIGGER IF EXISTS friendships_updated_at ON friendships;
CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Users can see friendships they are part of
DROP POLICY IF EXISTS "friendships_own" ON friendships;
CREATE POLICY "friendships_own" ON friendships FOR ALL
  USING (requester_id = auth.uid() OR addressee_id = auth.uid())
  WITH CHECK (requester_id = auth.uid());


-- ── 3. Enable Realtime for team tables ───────────────────────
-- Fix: "cannot add postgres_changes callbacks" error
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE team_check_logs;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE team_members;     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE progress;         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE xp_logs;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── Verify ────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('xp_logs', 'friendships', 'team_check_logs', 'team_members')
ORDER BY table_name;

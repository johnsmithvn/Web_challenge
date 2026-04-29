-- Migration v3.9.0: Incubator Module (Trạm Ấp Trứng)
-- Run in Supabase SQL Editor

-- Intentions: someday-maybe items with decision timeline
CREATE TABLE IF NOT EXISTS intentions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  original_reason TEXT,
  estimated_cost  NUMERIC(12,0) DEFAULT NULL,
  estimated_time  SMALLINT DEFAULT NULL,  -- minutes
  status          TEXT NOT NULL DEFAULT 'incubating'
                  CHECK (status IN ('incubating','executed','abandoned')),
  review_date     DATE DEFAULT NULL,
  converted_to    TEXT DEFAULT NULL,  -- 'task' | 'expense'
  converted_id    UUID DEFAULT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Intention logs: timeline of every decision
CREATE TABLE IF NOT EXISTS intention_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intention_id  UUID NOT NULL REFERENCES intentions(id) ON DELETE CASCADE,
  action        TEXT NOT NULL
                CHECK (action IN ('created','deferred','executed','abandoned','reviewed')),
  reason_note   TEXT,          -- REQUIRED when action='deferred'
  scheduled_for DATE DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE intentions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE intention_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intentions_own" ON intentions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "intention_logs_own" ON intention_logs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM intentions WHERE id = intention_id AND user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_intentions_user ON intentions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_intention_logs_intention ON intention_logs(intention_id);

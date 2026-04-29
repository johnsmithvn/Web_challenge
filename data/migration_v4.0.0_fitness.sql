-- Migration v4.0.0: Fitness Log (Phase 1 - Simple Log)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS fitness_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  session_name TEXT NOT NULL,        -- "Tập ngực", "Chạy bộ", "Yoga"
  duration_min SMALLINT NOT NULL,    -- phút
  energy       TEXT NOT NULL
               CHECK (energy IN ('good','normal','bad')),
  notes        TEXT,                 -- free-text ghi chú
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fitness_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fitness_own" ON fitness_logs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_fitness_user_date ON fitness_logs(user_id, date DESC);

-- ─────────────────────────────────────────────────────────
-- v4.12.0 — Inspirational Quotes table
-- User-customizable quotes with optional audio
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inspirational_quotes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  author     TEXT,
  audio_url  TEXT,
  source     TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast random query by user
CREATE INDEX IF NOT EXISTS idx_quotes_user_active
  ON inspirational_quotes(user_id, is_active);

-- RLS
ALTER TABLE inspirational_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own quotes"
  ON inspirational_quotes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

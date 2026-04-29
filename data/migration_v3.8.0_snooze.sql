-- Migration v3.8.0: Inbox Snooze
-- Run in Supabase SQL Editor

-- Snooze column: item hidden until this date
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS snoozed_until DATE DEFAULT NULL;

-- Partial index for snoozed items (fast filter)
CREATE INDEX IF NOT EXISTS idx_collections_snooze
  ON collections (user_id, snoozed_until)
  WHERE snoozed_until IS NOT NULL;

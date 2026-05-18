-- migration_v4.14.0_collection_types.sql
-- Restructure collections.type: consolidate categories
-- Date: 2026-05-18
--
-- Changes:
--   1. 'link' → 'note' (URL field preserved, no data loss)
--   2. 'experience' → 'learn' (merged)
--   3. 'knowledge' → 'learn' (merged — "Học" now covers all learning/knowledge/experience)
--   4. Add new types: entertainment, emotion
--   5. Add 'ai' which was in UI but missing from DB
--
-- Final 8 types: inbox, note, quote, learn, idea, ai, entertainment, emotion
-- This is idempotent — safe to re-run.

-- Step 1: Migrate legacy types
UPDATE collections SET type = 'note' WHERE type = 'link';
UPDATE collections SET type = 'learn' WHERE type = 'experience';
UPDATE collections SET type = 'learn' WHERE type = 'knowledge';

-- Step 2: Replace CHECK constraint
ALTER TABLE collections
  DROP CONSTRAINT IF EXISTS chk_collections_type;

ALTER TABLE collections
  ADD CONSTRAINT chk_collections_type
  CHECK (type IN (
    'inbox',         -- Quick capture items (internal)
    'note',          -- Ghi chú (includes former 'link' items)
    'quote',         -- Trích dẫn
    'learn',         -- Học (merged: học + kiến thức + kinh nghiệm + bài học)
    'idea',          -- Ý tưởng
    'ai',            -- AI conversations/prompts
    'entertainment', -- Giải trí (anime, music, movies, games)
    'emotion'        -- Cảm xúc (healing, reflections, diary)
  ));

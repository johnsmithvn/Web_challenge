-- ============================================================
-- Migration v4.1.0 — Tag Unification (collection_tags junction)
-- Run BEFORE deploying frontend v4.1.0
-- ============================================================

-- 1. Junction table: collection ↔ tag (matches expense_tags / subscription_tags pattern)
CREATE TABLE IF NOT EXISTS collection_tags (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  tag_id        UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, tag_id)
);

ALTER TABLE collection_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collection_tags_own" ON collection_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id AND user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_collection_tags_coll ON collection_tags(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_tags_tag  ON collection_tags(tag_id);

-- 2. Data migration: TEXT[] → tags + collection_tags
-- Run this block AFTER creating junction table.
-- This migrates existing collections.tags[] text values into the central tags table
-- and creates the appropriate links in collection_tags.
--
-- HOW TO RUN:
--   Copy and paste this entire block into Supabase SQL Editor and execute.
--
DO $$
DECLARE
  rec RECORD;
  tag_record RECORD;
  tag_text TEXT;
BEGIN
  -- Loop through every collection that has non-empty tags array
  FOR rec IN
    SELECT c.id AS collection_id, c.user_id, unnest(c.tags) AS tag_name
    FROM collections c
    WHERE c.tags IS NOT NULL AND array_length(c.tags, 1) > 0
  LOOP
    tag_text := lower(trim(rec.tag_name));
    
    -- Skip empty strings
    IF tag_text = '' THEN
      CONTINUE;
    END IF;
    
    -- Upsert into tags table (get or create)
    INSERT INTO tags (user_id, name, color)
    VALUES (rec.user_id, tag_text, '#8b5cf6')
    ON CONFLICT (user_id, name) DO NOTHING;
    
    -- Fetch the tag id
    SELECT id INTO tag_record
    FROM tags
    WHERE user_id = rec.user_id AND name = tag_text
    LIMIT 1;
    
    -- Link collection to tag
    IF tag_record.id IS NOT NULL THEN
      INSERT INTO collection_tags (collection_id, tag_id)
      VALUES (rec.collection_id, tag_record.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- 3. Mark old column deprecated (NOT dropped — safe rollback)
COMMENT ON COLUMN collections.tags IS 'DEPRECATED v4.1.0 — use collection_tags junction table. Will be removed in v5.0.';

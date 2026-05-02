-- Migration v4.3.0: Drop deprecated collections.tags TEXT[] column
-- The tag system was unified to collection_tags junction table in v4.1.0.
-- This column is no longer referenced in any hook or component.

-- Safety: IF EXISTS prevents error if already dropped
ALTER TABLE collections DROP COLUMN IF EXISTS tags;

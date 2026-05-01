-- Migration v4.2.0: Incubator Multi-Output Router
-- Run in Supabase SQL Editor

-- 1. Convert converted_to from TEXT to TEXT[] (array)
-- Existing values: 'task' → {'task'}, 'expense' → {'expense'}, NULL → NULL
ALTER TABLE intentions
  ALTER COLUMN converted_to TYPE TEXT[] USING
    CASE WHEN converted_to IS NOT NULL THEN ARRAY[converted_to] ELSE NULL END;

COMMENT ON COLUMN intentions.converted_to IS 'Array of output types: task, expense, habit';

-- 2. Add converted_ids JSONB column (replaces single converted_id UUID)
-- Format: { "task": "uuid", "expense": "uuid", "habit": "uuid" }
ALTER TABLE intentions
  ADD COLUMN IF NOT EXISTS converted_ids JSONB DEFAULT NULL;

COMMENT ON COLUMN intentions.converted_ids IS 'Map of type → created record UUID';

-- Note: converted_id UUID column is kept for backward compatibility but DEPRECATED.
-- New code writes to converted_ids JSONB instead.

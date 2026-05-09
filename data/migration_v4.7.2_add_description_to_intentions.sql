-- Migration v4.7.2
-- Add 'description' column to 'intentions' table for long-form markdown content (separated from original_reason)
ALTER TABLE intentions ADD COLUMN IF NOT EXISTS description TEXT;

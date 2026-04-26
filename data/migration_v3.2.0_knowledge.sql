-- v3.2.0: Knowledge Base dual-mode editor + AI-ready schema
-- Run on Supabase SQL Editor

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS content_format VARCHAR(20) DEFAULT 'markdown',
  ADD COLUMN IF NOT EXISTS body_text      TEXT,
  ADD COLUMN IF NOT EXISTS word_count     INT DEFAULT 0;

COMMENT ON COLUMN collections.content_format IS 'markdown | tiptap';
COMMENT ON COLUMN collections.body_text IS 'Plain text extracted from body — no markdown/HTML syntax. Used for future AI analysis and full-text search.';
COMMENT ON COLUMN collections.word_count IS 'Pre-computed word count from body_text';

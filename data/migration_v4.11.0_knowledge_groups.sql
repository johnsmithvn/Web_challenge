-- Life Hub v4.11.0: Knowledge Groups (M:N) + Sub-Notes
-- Date: 2026-05-10
-- Run in Supabase SQL Editor

-- Ensure public schema is in search path (SQL Editor may default to different schema)
SET search_path TO public, auth;

-- ──────────────────────────────────────────────────────────
-- 1. knowledge_groups — nhóm kiến thức do user tạo
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  emoji       TEXT DEFAULT '📁',
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kgroups_user ON knowledge_groups(user_id);
ALTER TABLE knowledge_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kgroups_own" ON knowledge_groups;
CREATE POLICY "kgroups_own" ON knowledge_groups FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- 2. collection_groups — junction: collections ↔ knowledge_groups (M:N)
-- Pattern giống task_collections (v4.5.0)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collection_groups (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  group_id      UUID NOT NULL REFERENCES knowledge_groups(id) ON DELETE CASCADE,
  sort_order    SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_cgroups_group ON collection_groups(group_id);
ALTER TABLE collection_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cgroups_own" ON collection_groups;
CREATE POLICY "cgroups_own" ON collection_groups FOR ALL
  USING (EXISTS (
    SELECT 1 FROM collections WHERE id = collection_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM collections WHERE id = collection_id AND user_id = auth.uid()
  ));

-- ──────────────────────────────────────────────────────────
-- 3. collection_notes — ghi chú phụ gắn vào bài viết (threaded notes)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collection_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  sort_order    SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cnotes_collection ON collection_notes(collection_id);
ALTER TABLE collection_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cnotes_own" ON collection_notes;
CREATE POLICY "cnotes_own" ON collection_notes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- 4. Update type CHECK constraint — add ai, knowledge, experience
-- ──────────────────────────────────────────────────────────
ALTER TABLE collections
  DROP CONSTRAINT IF EXISTS chk_collections_type;

ALTER TABLE collections
  ADD CONSTRAINT chk_collections_type
  CHECK (type IN ('inbox', 'note', 'link', 'quote', 'learn', 'idea', 'ai', 'knowledge', 'experience'));

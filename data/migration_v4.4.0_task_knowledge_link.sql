-- Migration v4.4.0: Task ↔ Knowledge link
-- Run BEFORE deploying frontend v4.4.0

-- Add collection_id foreign key to user_tasks
ALTER TABLE user_tasks
ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES collections(id) ON DELETE SET NULL;

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_user_tasks_collection_id
ON user_tasks(collection_id) WHERE collection_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN user_tasks.collection_id IS 'Optional link to a Knowledge Base collection item';

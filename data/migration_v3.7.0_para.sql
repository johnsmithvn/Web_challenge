-- Migration v3.7.0: PARA Tags
-- Run in Supabase SQL Editor

-- Central tags table (shared across modules)
CREATE TABLE IF NOT EXISTS tags (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  color   TEXT DEFAULT '#8b5cf6',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name)
);

-- Junction: expense ↔ tag
CREATE TABLE IF NOT EXISTS expense_tags (
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (expense_id, tag_id)
);

-- Junction: subscription ↔ tag
CREATE TABLE IF NOT EXISTS subscription_tags (
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (subscription_id, tag_id)
);

-- RLS
ALTER TABLE tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_own" ON tags FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "expense_tags_own" ON expense_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND user_id = auth.uid()));

CREATE POLICY "subscription_tags_own" ON subscription_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM subscriptions WHERE id = subscription_id AND user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_tags_expense ON expense_tags(expense_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tags_sub ON subscription_tags(subscription_id);

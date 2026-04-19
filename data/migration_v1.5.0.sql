-- ============================================================
-- Migration v1.5.0 — Journey / Program System + habit_logs
-- Run in Supabase SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. programs — thư viện lộ trình (system templates + user)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title         text NOT NULL,
  description   text,
  icon          text DEFAULT '🎯',
  color         text DEFAULT '#8b5cf6',
  category      text DEFAULT 'other'
                CHECK (category IN ('health','learning','mindfulness','productivity','other')),
  duration_days int  NOT NULL DEFAULT 21,
  is_template   boolean DEFAULT false,   -- true = system template, shown in Browse
  is_public     boolean DEFAULT false,   -- true = any user can see
  created_at    timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 2. program_habits — habits template thuộc về program
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_habits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name         text NOT NULL,
  action       text,
  icon         text DEFAULT '✅',
  color        text DEFAULT '#06b6d4',
  time_target  text,
  duration_min int,
  sort_order   int DEFAULT 0
);

-- ──────────────────────────────────────────────────────────
-- 3. user_journeys — mỗi lần user thực hiện 1 program
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_journeys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id   uuid REFERENCES programs(id) ON DELETE SET NULL,
  title        text NOT NULL,
  description  text,
  started_at   date NOT NULL DEFAULT CURRENT_DATE,
  ended_at     date,
  target_days  int  NOT NULL DEFAULT 21,
  status       text NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','completed','extended','archived')),
  cycle        int  NOT NULL DEFAULT 1,
  created_at   timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- 4. journey_habits — snapshot habits lúc bắt đầu journey
--    (bảo toàn history ngay cả khi user edit/xóa habit sau)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journey_habits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id   uuid NOT NULL REFERENCES user_journeys(id) ON DELETE CASCADE,
  habit_id     uuid REFERENCES habits(id) ON DELETE SET NULL,
  name         text NOT NULL,
  action       text,
  icon         text DEFAULT '✅',
  color        text DEFAULT '#8b5cf6',
  sort_order   int DEFAULT 0
);

-- ──────────────────────────────────────────────────────────
-- 5. habit_logs — per-habit daily completion (thay thế localStorage vl_habit_progress)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id     uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  journey_id   uuid REFERENCES user_journeys(id) ON DELETE SET NULL,
  log_date     date NOT NULL DEFAULT CURRENT_DATE,
  status       text NOT NULL DEFAULT 'completed'
               CHECK (status IN ('completed','skipped')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, habit_id, log_date)   -- 1 entry duy nhất per habit per day
);

-- ──────────────────────────────────────────────────────────
-- 6. ALTER habits — thêm journey_id
-- ──────────────────────────────────────────────────────────
ALTER TABLE habits ADD COLUMN IF NOT EXISTS journey_id uuid REFERENCES user_journeys(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────
-- Indexes — performance cho queries thường dùng
-- ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date    ON habit_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date   ON habit_logs(habit_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_logs_journey      ON habit_logs(journey_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_journeys_user      ON user_journeys(user_id, status);
CREATE INDEX IF NOT EXISTS idx_journey_habits_journey  ON journey_habits(journey_id);

-- ──────────────────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────────────────

-- habit_logs
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own habit_logs"
  ON habit_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_journeys
ALTER TABLE user_journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own journeys"
  ON user_journeys FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- journey_habits
ALTER TABLE journey_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own journey habits"
  ON journey_habits FOR ALL
  USING (
    journey_id IN (
      SELECT id FROM user_journeys WHERE user_id = auth.uid()
    )
  );

-- programs: system templates readable by all; user owns their private programs
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read public/template programs"
  ON programs FOR SELECT
  USING (is_public = true OR is_template = true OR creator_id = auth.uid());
CREATE POLICY "Manage own programs"
  ON programs FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- program_habits: readable if parent program is readable
ALTER TABLE program_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read program habits"
  ON program_habits FOR SELECT
  USING (
    program_id IN (
      SELECT id FROM programs
      WHERE is_public = true OR is_template = true OR creator_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────
-- Seed system template programs
-- (Thêm data mẫu cho Browse library)
-- ──────────────────────────────────────────────────────────
INSERT INTO programs (title, description, icon, color, category, duration_days, is_template, is_public)
VALUES
  ('Buổi Sáng Kỷ Luật',   'Xây dựng thói quen buổi sáng chiến thắng trong 21 ngày',          '🌅', '#f97316', 'health',       21, true, true),
  ('Thói Quen Đọc Sách',  'Đọc sách mỗi ngày — 21 ngày hình thành thói quen trọn đời',       '📚', '#06b6d4', 'learning',     21, true, true),
  ('Mindful Morning',      'Thiền, hít thở, và bắt đầu ngày mới với tâm trí sáng suốt',       '🧘', '#8b5cf6', 'mindfulness',  14, true, true),
  ('Kỷ Luật Thể Chất',    'Tập luyện đều đặn, uống đủ nước, và ngủ đúng giờ trong 21 ngày',  '💪', '#00ff88', 'health',       21, true, true),
  ('Deep Work 30 Ngày',   'Tập trung sâu hơn, tối đa hóa năng suất, loại bỏ phân tâm',       '🚀', '#ffd700', 'productivity', 30, true, true)
ON CONFLICT DO NOTHING;

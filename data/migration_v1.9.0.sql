-- ════════════════════════════════════════════════════════════════
-- Migration v1.9.0 — Fix trigger + Seed template habits
-- Run in: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- 1. Fix handle_new_user trigger to include username + email
--    from auth metadata (set by client signUp)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    username     = COALESCE(EXCLUDED.username, profiles.username),
    email        = COALESCE(EXCLUDED.email, profiles.email),
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────
-- 2. Seed program_habits for each template program
--    Match programs by title (idempotent via ON CONFLICT DO NOTHING)
-- ──────────────────────────────────────────────────────────

-- 2a. Buổi Sáng Kỷ Luật
INSERT INTO program_habits (program_id, name, action, icon, color, sort_order)
SELECT p.id, h.name, h.action, h.icon, h.color, h.sort_order
FROM programs p,
(VALUES
  ('Thức dậy đúng giờ',   'Thức dậy trước 6:30',     '⏰', '#f97316', 0),
  ('Uống nước',            'Uống 1 ly nước ấm',       '💧', '#06b6d4', 1),
  ('Tập thể dục buổi sáng','Tập 15 phút stretching', '🏃', '#22c55e', 2),
  ('Không điện thoại',     '30 phút đầu không phone', '📵', '#ef4444', 3)
) AS h(name, action, icon, color, sort_order)
WHERE p.title = 'Buổi Sáng Kỷ Luật' AND p.is_template = true
ON CONFLICT DO NOTHING;

-- 2b. Thói Quen Đọc Sách
INSERT INTO program_habits (program_id, name, action, icon, color, sort_order)
SELECT p.id, h.name, h.action, h.icon, h.color, h.sort_order
FROM programs p,
(VALUES
  ('Đọc sách',      'Đọc ít nhất 20 trang mỗi ngày',  '📖', '#8b5cf6', 0),
  ('Ghi chú',       'Viết 3 ý chính từ sách',          '✍️', '#06b6d4', 1),
  ('Chia sẻ',       'Kể lại 1 điều học được',           '💬', '#f59e0b', 2)
) AS h(name, action, icon, color, sort_order)
WHERE p.title = 'Thói Quen Đọc Sách' AND p.is_template = true
ON CONFLICT DO NOTHING;

-- 2c. Mindful Morning
INSERT INTO program_habits (program_id, name, action, icon, color, sort_order)
SELECT p.id, h.name, h.action, h.icon, h.color, h.sort_order
FROM programs p,
(VALUES
  ('Thiền',          'Thiền 10 phút buổi sáng',         '🧘', '#8b5cf6', 0),
  ('Hít thở sâu',   '5 phút hít thở có ý thức',        '🌬️', '#06b6d4', 1),
  ('Biết ơn',        'Viết 3 điều biết ơn',              '🙏', '#f59e0b', 2)
) AS h(name, action, icon, color, sort_order)
WHERE p.title = 'Mindful Morning' AND p.is_template = true
ON CONFLICT DO NOTHING;

-- 2d. Kỷ Luật Thể Chất
INSERT INTO program_habits (program_id, name, action, icon, color, sort_order)
SELECT p.id, h.name, h.action, h.icon, h.color, h.sort_order
FROM programs p,
(VALUES
  ('Tập thể dục',    'Tập ít nhất 30 phút',            '💪', '#22c55e', 0),
  ('Uống đủ nước',   'Uống 2 lít nước mỗi ngày',      '💧', '#06b6d4', 1),
  ('Ngủ đúng giờ',   'Lên giường trước 23:00',         '😴', '#6366f1', 2),
  ('Ăn lành mạnh',   'Ít nhất 1 bữa rau/trái cây',    '🥗', '#10b981', 3)
) AS h(name, action, icon, color, sort_order)
WHERE p.title = 'Kỷ Luật Thể Chất' AND p.is_template = true
ON CONFLICT DO NOTHING;

-- 2e. Deep Work 30 Ngày
INSERT INTO program_habits (program_id, name, action, icon, color, sort_order)
SELECT p.id, h.name, h.action, h.icon, h.color, h.sort_order
FROM programs p,
(VALUES
  ('Deep Work',        '1 session deep work (≥90 phút)',  '🎯', '#8b5cf6', 0),
  ('Review tasks',     'Review & plan tasks đầu ngày',     '📋', '#f59e0b', 1),
  ('Tắt thông báo',   'Tắt phone khi deep work',          '🔕', '#ef4444', 2),
  ('Pomodoro log',     'Log ít nhất 4 pomodoros',           '⏱', '#06b6d4', 3)
) AS h(name, action, icon, color, sort_order)
WHERE p.title = 'Deep Work 30 Ngày' AND p.is_template = true
ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────────────
-- 3. Verify: count habits per program
-- ──────────────────────────────────────────────────────────
SELECT p.title, COUNT(ph.id) AS habit_count
FROM programs p
LEFT JOIN program_habits ph ON ph.program_id = p.id
WHERE p.is_template = true
GROUP BY p.id, p.title
ORDER BY p.title;

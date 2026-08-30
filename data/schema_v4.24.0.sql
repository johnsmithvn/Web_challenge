-- ════════════════════════════════════════════════════════════════════════════
-- Life Hub — FULL CONSOLIDATED SCHEMA  v5.0.0
-- ════════════════════════════════════════════════════════════════════════════
-- ✅ CHỈ CẦN CHẠY FILE NÀY 1 LẦN trên Supabase → SQL Editor (fresh install).
-- Idempotent — an toàn chạy lại nhiều lần.
--
-- File này GỘP toàn bộ: schema_v4.4.0 + các migration v4.4.1 → v5.0.0 (bao gồm
-- data/RUNBOOK.sql — 2026-08-02 hợp nhất xong, RUNBOOK.sql vẫn giữ lại làm hồ
-- sơ lịch sử SQL đã chạy trên DB thật, không cần chạy lại).
--
-- ⚠️ KHÁC BIỆT VỚI data/migration_v5.0.0_activity_logs_v2.sql: file migration đó
-- dùng DROP TABLE (chạy 1 lần, mất dữ liệu cũ theo chủ ý). File MASTER này phải
-- idempotent nên dựng activity_logs bằng CREATE TABLE IF NOT EXISTS + ALTER
-- ADD/DROP COLUMN — chạy lại được, và nâng cấp được DB cũ mà KHÔNG mất dòng nào.
-- Ai đã chạy file migration rồi thì chạy lại file này cũng không sao (mọi câu
-- đều IF EXISTS / IF NOT EXISTS).
--
-- Đã phản ánh trạng thái CUỐI CÙNG:
--   • mood_logs đã bị gỡ (v4.10.1) — không còn trong schema này
--   • user_tasks dùng `priority` (bỏ energy_level/duration_est) (v4.9.0)
--   • user_tasks.collection_id đã bỏ (v4.28.0 code, DROP v5.0.0) — dùng task_collections
--   • user_tasks.recurrence_parent_id — chuỗi task lặp lại (v4.31.0)
--   • user_tasks.updated_at + trigger — dấu thời gian sửa gần nhất (v5.0.0)
--   • activity_logs dựng lại schema v2 (v5.0.0): task_id FK CASCADE +
--     field/old_value/new_value/note, bỏ label/amount/meta. CHỈ phục vụ lịch sử
--     thay đổi + ghi chú của từng Task
--   • Life Log (/life-log) + heatmap + KPI "Hoạt động hôm nay" đã GỠ HẲN (v5.0.0)
--   • Hành Trình cảm xúc (/life-journey), Quiz, Bảng Xếp Hạng đã GỠ HẲN (v5.0.0)
--   • Habit tracker + Lộ Trình 21 ngày + Dashboard đã GỠ HẲN (v5.0.0, đợt 4):
--     DROP progress, habits, habit_logs, programs, program_habits, user_journeys,
--     journey_habits, skip_reasons; focus_sessions bỏ habit_id + journey_id
--   • streaks + get_leaderboard() đã DROP (v5.0.0) — chết sẵn từ lâu, chỉ BXH đọc
--   • collections.type = 8 loại cuối, có `podcast` (v4.14.0 + v4.28.0)
--   • collections.status chuẩn hoá unread/read/archived (v5.0.0), bỏ 5 cột chết
--     resolved/course_name/duration_min/reviewed_at/priority (v5.0.0)
--   • task_tags junction + VIEW tagged_items (v4.28.0)
--   • RLS 4 junction tag kiểm ownership CẢ HAI phía (v4.28.0 P0-2)
--   • knowledge_groups / collection_groups đã DROP (v4.30.0/v5.0.0) — trùng việc
--     với tags, xem git history nếu cần định nghĩa gốc. collection_notes vẫn giữ (v4.11.0)
--   • thêm inspirational_quotes (v4.12.0)
--   • profiles: chỉ chủ tài khoản đọc được hàng mình + 4 hàm RPC (v4.24.0 — vá rò email)
--   • đợt 5 (v5.0.0): DROP 3 bảng chết còn lại — notification_settings,
--     friendships (archived v3.0.0), fitness_logs (feature gỡ v4.26.0)
-- ════════════════════════════════════════════════════════════════════════════

-- Shared trigger function: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ── 1. profiles ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE, email TEXT, display_name TEXT, avatar_url TEXT, bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_profiles_username ON profiles (username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email) WHERE email IS NOT NULL;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- v4.24.0: chỉ chủ tài khoản đọc được hàng của mình (trước đây USING(true) → rò email).
-- Nhu cầu cross-user (login, check trùng username/email) đi qua các hàm RPC ở cuối file.
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());

-- ── 2. progress — ĐÃ DROP ở v5.0.0 (đợt 4 dọn module) ─────────────────────
-- Bảng "ngày nào tick đủ habit" của Habit tracker. Habit đã gỡ hẳn.
DROP TABLE IF EXISTS progress CASCADE;

-- ── 3. streaks — ĐÃ DROP ở v5.0.0 (đợt 3 dọn module) ───────────────────────
-- Bảng này CHẾT TỪ LÂU: chỉ được INSERT đúng 1 lần lúc signup (trigger
-- handle_new_user), không nơi nào trong src/ UPDATE nó → current_streak /
-- longest_streak luôn = 0 với mọi user. Người đọc duy nhất là get_leaderboard(),
-- mà Bảng Xếp Hạng đã gỡ hẳn (tính năng xã hội trong app 1 người = giá trị 0).
-- INSERT ở handle_new_user cũng đã bỏ (xem khối AUTH TRIGGER cuối file).
DROP TABLE IF EXISTS streaks;

-- ── 4. notification_settings — ĐÃ DROP ở v5.0.0 (đợt 5 dọn bảng chết) ─────
-- Không hook nào từng đọc/ghi bảng này. Hook `useNotifications` (đã xoá cùng
-- Habit tracker) lưu cấu hình nhắc nhở ở localStorage `vl_notif_settings`, chưa
-- bao giờ chạm tới đây. Bảng chỉ được INSERT 1 dòng rỗng lúc signup.
DROP TABLE IF EXISTS notification_settings CASCADE;

-- ── 5-10. habits / programs / program_habits / user_journeys / journey_habits
--          / habit_logs — ĐÃ DROP ở v5.0.0 (đợt 4 dọn module) ──────────────
-- Toàn bộ Habit tracker + Lộ Trình 21 ngày. Lý do gỡ: chiến lược thu hẹp về
-- Inbox + Knowledge + Tasks + Finance (xem docs/TASKS.md § KẾ HOẠCH DỌN MODULE).
-- `CASCADE` ở đây chỉ gỡ RÀNG BUỘC FK trỏ tới các bảng này, KHÔNG xoá cột và
-- KHÔNG xoá dòng của bảng trỏ tới. Cụ thể: `focus_sessions.habit_id` /
-- `journey_id` mất FK ở bước này rồi được DROP COLUMN ở § 11 ngay dưới —
-- không dòng `focus_sessions` nào bị ảnh hưởng.
DROP TABLE IF EXISTS journey_habits CASCADE;
DROP TABLE IF EXISTS habit_logs     CASCADE;
DROP TABLE IF EXISTS program_habits CASCADE;
DROP TABLE IF EXISTS user_journeys  CASCADE;
DROP TABLE IF EXISTS habits         CASCADE;
DROP TABLE IF EXISTS programs       CASCADE;

-- ── 11. focus_sessions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  duration_min SMALLINT NOT NULL DEFAULT 25,
  date DATE NOT NULL DEFAULT CURRENT_DATE, completed_at TIMESTAMPTZ DEFAULT NOW()
);
-- v5.0.0: bỏ habit_id + journey_id (Focus Timer không còn gắn habit/lộ trình).
-- Chạy TRƯỚC khối DROP TABLE ở § 5-10 để không phụ thuộc thứ tự CASCADE.
ALTER TABLE focus_sessions DROP COLUMN IF EXISTS habit_id;
ALTER TABLE focus_sessions DROP COLUMN IF EXISTS journey_id;
DROP INDEX IF EXISTS idx_focus_journey;
CREATE INDEX IF NOT EXISTS idx_focus_user_date ON focus_sessions (user_id, date DESC);
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "focus_own" ON focus_sessions;
CREATE POLICY "focus_own" ON focus_sessions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- (mood_logs đã GỠ ở v4.10.1 — cố tình không có trong schema này)

-- ── 12. skip_reasons — ĐÃ DROP ở v5.0.0 (đợt 4 dọn module) ────────────────
-- "Lý do bỏ habit hôm nay". Hook `useMoodSkip` đọc bảng này chỉ được dùng bởi
-- TrackerPage + DashboardPage — cả hai đã xoá.
DROP TABLE IF EXISTS skip_reasons CASCADE;

-- ── 13. xp_logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount SMALLINT NOT NULL DEFAULT 0 CHECK (amount BETWEEN -200 AND 200),
  reason TEXT NOT NULL, meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_xp_logs_user ON xp_logs (user_id, created_at DESC);
ALTER TABLE xp_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "xp_own" ON xp_logs;
CREATE POLICY "xp_own" ON xp_logs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- v4.24.0: bỏ "xp_read_all" (từng mở đọc chéo cho leaderboard). v5.0.0: leaderboard
-- đã gỡ hẳn, xp_logs chỉ còn đọc hàng của mình.
DROP POLICY IF EXISTS "xp_read_all" ON xp_logs;

-- ── 14. friendships — ĐÃ DROP ở v5.0.0 (đợt 5 dọn bảng chết) ──────────────
-- ARCHIVED từ v3.0.0, chưa bao giờ có UI. Đã đánh dấu "an toàn để DROP" nhiều
-- version rồi, giờ dọn thật.
DROP TABLE IF EXISTS friendships CASCADE;

-- ── 15. user_tasks (v4.9.0: priority thay energy_level/duration_est; v4.31.0: recurrence_parent_id; v5.0.0: updated_at) ─
CREATE TABLE IF NOT EXISTS user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT,
  due_date DATE NOT NULL, due_time TIME,
  priority SMALLINT NOT NULL DEFAULT 0,  -- 0=None,1=Lowest,2=Low,3=Medium,4=High,5=Urgent
  recurrence_rule JSONB,
  recurrence_parent_id UUID REFERENCES user_tasks(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false, completed_at TIMESTAMPTZ,
  notified BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Nâng cấp DB cũ (nếu chạy lại trên DB từng có energy_level/duration_est/collection_id):
ALTER TABLE user_tasks DROP COLUMN IF EXISTS energy_level;
ALTER TABLE user_tasks DROP COLUMN IF EXISTS duration_est;
ALTER TABLE user_tasks DROP COLUMN IF EXISTS collection_id;
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID REFERENCES user_tasks(id) ON DELETE CASCADE;
-- v5.0.0: thêm KHÔNG default trước rồi mới backfill = created_at. Nếu để DEFAULT
-- NOW() ngay từ đầu, mọi task cũ sẽ mang dấu thời gian của lúc chạy file này —
-- sai, vì chúng đâu có vừa được sửa.
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE user_tasks SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE user_tasks ALTER COLUMN updated_at SET DEFAULT NOW();
DROP TRIGGER IF EXISTS user_tasks_updated_at ON user_tasks;
CREATE TRIGGER user_tasks_updated_at BEFORE UPDATE ON user_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_date ON user_tasks (user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_user_tasks_pending ON user_tasks (user_id, completed, due_date) WHERE completed=false;
CREATE INDEX IF NOT EXISTS idx_user_tasks_recurring ON user_tasks (user_id) WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_tasks_recurrence_parent ON user_tasks (recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own tasks" ON user_tasks;
CREATE POLICY "Users manage own tasks" ON user_tasks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 16. collections ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'inbox', title TEXT NOT NULL,
  url TEXT, body TEXT DEFAULT '', body_text TEXT,
  word_count INT DEFAULT 0, content_format VARCHAR(20) DEFAULT 'markdown',
  source TEXT, status TEXT NOT NULL DEFAULT 'unread',
  snoozed_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Nâng cấp DB cũ (cột chết đã DROP ở migration v5.0.0 — data/RUNBOOK.sql Phần 3):
ALTER TABLE collections DROP COLUMN IF EXISTS resolved;
ALTER TABLE collections DROP COLUMN IF EXISTS course_name;
ALTER TABLE collections DROP COLUMN IF EXISTS duration_min;
ALTER TABLE collections DROP COLUMN IF EXISTS reviewed_at;
ALTER TABLE collections DROP COLUMN IF EXISTS priority;
CREATE OR REPLACE FUNCTION update_collections_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_collections_updated_at ON collections;
CREATE TRIGGER trg_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_collections_updated_at();
CREATE INDEX IF NOT EXISTS idx_collections_user_type ON collections (user_id, type);
CREATE INDEX IF NOT EXISTS idx_collections_user_status ON collections (user_id, status);
CREATE INDEX IF NOT EXISTS idx_collections_user_created ON collections (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_snooze ON collections (user_id, snoozed_until) WHERE snoozed_until IS NOT NULL;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "collections_select_own" ON collections;
CREATE POLICY "collections_select_own" ON collections FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "collections_insert_own" ON collections;
CREATE POLICY "collections_insert_own" ON collections FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "collections_update_own" ON collections;
CREATE POLICY "collections_update_own" ON collections FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "collections_delete_own" ON collections;
CREATE POLICY "collections_delete_own" ON collections FOR DELETE USING (user_id = auth.uid());

-- collections.type — migrate dữ liệu cũ rồi áp CHECK 8 loại cuối (v4.4.1 + v4.14.0 + v4.28.0: podcast thay emotion)
UPDATE collections SET type = 'idea'  WHERE type = 'want';
UPDATE collections SET type = 'note'  WHERE type = 'link';
UPDATE collections SET type = 'learn' WHERE type = 'experience';
UPDATE collections SET type = 'learn' WHERE type = 'knowledge';
UPDATE collections SET type = 'note'  WHERE type = 'emotion';
ALTER TABLE collections DROP CONSTRAINT IF EXISTS chk_collections_type;
ALTER TABLE collections ADD CONSTRAINT chk_collections_type
  CHECK (type IN ('inbox','note','quote','learn','idea','ai','entertainment','podcast'));

-- collections.status — chuẩn hoá còn unread/read/archived (v5.0.0, data/RUNBOOK.sql Phần 3)
UPDATE collections SET status = 'unread' WHERE status = 'inbox' OR status IS NULL;
ALTER TABLE collections DROP CONSTRAINT IF EXISTS chk_collections_status;
ALTER TABLE collections ADD CONSTRAINT chk_collections_status
  CHECK (status IN ('unread','read','archived'));
ALTER TABLE collections ALTER COLUMN status SET DEFAULT 'unread';

-- ── 17. task_collections (junction: user_tasks ↔ collections) ───────────────
CREATE TABLE IF NOT EXISTS task_collections (
  task_id       UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, collection_id)
);
ALTER TABLE task_collections ENABLE ROW LEVEL SECURITY;
-- RLS kiểm ownership CẢ HAI phía (v4.28.0 P0-2 — trước chỉ kiểm 1 phía → ghi được rác cross-user)
DROP POLICY IF EXISTS "task_collections_own" ON task_collections;
CREATE POLICY "task_collections_own" ON task_collections FOR ALL
  USING (
        EXISTS (SELECT 1 FROM user_tasks  WHERE id = task_id       AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM collections WHERE id = collection_id AND user_id = auth.uid())
  )
  WITH CHECK (
        EXISTS (SELECT 1 FROM user_tasks  WHERE id = task_id       AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM collections WHERE id = collection_id AND user_id = auth.uid())
  );
CREATE INDEX IF NOT EXISTS idx_task_collections_coll ON task_collections(collection_id);

-- ── 18. expenses ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL, category TEXT NOT NULL, note TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses (user_id, category);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses_select_own" ON expenses;
CREATE POLICY "expenses_select_own" ON expenses FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "expenses_insert_own" ON expenses;
CREATE POLICY "expenses_insert_own" ON expenses FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "expenses_update_own" ON expenses;
CREATE POLICY "expenses_update_own" ON expenses FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "expenses_delete_own" ON expenses;
CREATE POLICY "expenses_delete_own" ON expenses FOR DELETE USING (user_id = auth.uid());

-- ── 19. subscriptions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, amount INT NOT NULL,
  cycle TEXT NOT NULL DEFAULT 'monthly', next_due DATE NOT NULL,
  icon TEXT DEFAULT '📦', color TEXT DEFAULT '#8b5cf6',
  active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active ON subscriptions (user_id, active);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
CREATE POLICY "subscriptions_select_own" ON subscriptions FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "subscriptions_insert_own" ON subscriptions;
CREATE POLICY "subscriptions_insert_own" ON subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "subscriptions_update_own" ON subscriptions;
CREATE POLICY "subscriptions_update_own" ON subscriptions FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "subscriptions_delete_own" ON subscriptions;
CREATE POLICY "subscriptions_delete_own" ON subscriptions FOR DELETE USING (user_id = auth.uid());

-- ── 20. activity_logs (v5.0.0: lịch sử thay đổi + ghi chú của Task) ─────────
--
-- 3 loại dòng, MỌI dòng đều gắn task_id:
--   | Loại             | field | note |
--   | Sự kiện của task | NULL  | NULL |  task_created / task_completed / …
--   | Field-diff       | có    | NULL |  task_update, 1 dòng / field đổi
--   | Ghi chú cá nhân  | NULL  | có   |  note
--
-- v5.0.0 KHÔNG còn dòng "sự kiện rời rạc" (expense_add, inbox_*, focus_done,
-- challenge_done, habit_done…): heatmap Life Log là người đọc duy nhất của
-- chúng, mà Life Log + KPI "Hoạt động hôm nay" đã bị gỡ hẳn.
--
-- `action` CỐ Ý không có CHECK constraint: mọi lệnh ghi log đều fire-and-forget
-- nuốt lỗi, nên constraint bị vi phạm sẽ làm log biến mất ÂM THẦM thay vì lộ ra.
-- Chống gõ sai bằng hằng số ACTIONS trong src/utils/taskFields.js.
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES user_tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field TEXT, old_value TEXT, new_value TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Nâng cấp DB cũ (schema v1 có label/amount/meta). Bỏ 3 cột đó KHÔNG mất dữ
-- liệu nghiệp vụ: tiền đã có ở expenses/subscriptions, XP đã có ở xp_logs,
-- và không nơi nào trong src/ đọc 3 cột này (chỉ COUNT dòng).
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES user_tasks(id) ON DELETE CASCADE;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS field TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS new_value TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE activity_logs DROP COLUMN IF EXISTS label;
ALTER TABLE activity_logs DROP COLUMN IF EXISTS amount;
ALTER TABLE activity_logs DROP COLUMN IF EXISTS meta;
-- Dọn mọi dòng KHÔNG gắn task: đó là các sự kiện rời rạc của schema v1, giờ
-- không còn ai ghi lẫn ai đọc. Idempotent — lần chạy sau không còn gì khớp.
DELETE FROM activity_logs WHERE task_id IS NULL;
-- Index của schema v1 — không truy vấn nào còn dùng.
DROP INDEX IF EXISTS idx_activity_logs_user_action;
DROP INDEX IF EXISTS idx_activity_logs_user_date;
DROP INDEX IF EXISTS idx_activity_logs_heatmap;
-- Truy vấn ĐỌC duy nhất: "log của 1 task, mới nhất trước" (tab Activity/Note).
CREATE INDEX IF NOT EXISTS idx_activity_logs_task
  ON activity_logs (task_id, created_at DESC)
  WHERE task_id IS NOT NULL;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_logs_select_own" ON activity_logs;
CREATE POLICY "activity_logs_select_own" ON activity_logs FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "activity_logs_insert_own" ON activity_logs;
CREATE POLICY "activity_logs_insert_own" ON activity_logs FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "activity_logs_delete_own" ON activity_logs;
CREATE POLICY "activity_logs_delete_own" ON activity_logs FOR DELETE USING (user_id = auth.uid());
-- UPDATE chỉ mở cho dòng ghi chú: USING chặn không cho với tới dòng field-diff,
-- WITH CHECK chặn biến 1 dòng note thành dòng khác.
DROP POLICY IF EXISTS "activity_logs_update_own_note" ON activity_logs;
CREATE POLICY "activity_logs_update_own_note" ON activity_logs FOR UPDATE
  USING      (user_id = auth.uid() AND action = 'note')
  WITH CHECK (user_id = auth.uid() AND action = 'note');
-- GRANT tường minh (phòng khi bảng từng bị DROP làm mất quyền) + khoá UPDATE
-- xuống mức CỘT: chỉ sửa được đúng `note`, mọi cột khác bất biến ở mọi dòng.
GRANT SELECT, INSERT, DELETE ON activity_logs TO authenticated;
REVOKE UPDATE ON activity_logs FROM authenticated;
GRANT UPDATE (note) ON activity_logs TO authenticated;

-- ── 21. tags + junctions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, color TEXT DEFAULT '#8b5cf6',
  created_at TIMESTAMPTZ DEFAULT now(), UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags_own" ON tags;
CREATE POLICY "tags_own" ON tags FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS collection_tags (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, tag_id)
);
CREATE TABLE IF NOT EXISTS expense_tags (
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (expense_id, tag_id)
);
CREATE TABLE IF NOT EXISTS subscription_tags (
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (subscription_id, tag_id)
);
ALTER TABLE collection_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tags ENABLE ROW LEVEL SECURITY;
-- RLS kiểm ownership CẢ HAI phía (v4.28.0 P0-2 — trước chỉ kiểm 1 phía → ghi được rác cross-user)
DROP POLICY IF EXISTS "collection_tags_own" ON collection_tags;
CREATE POLICY "collection_tags_own" ON collection_tags FOR ALL
  USING (
        EXISTS (SELECT 1 FROM collections WHERE id = collection_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags        WHERE id = tag_id        AND user_id = auth.uid())
  )
  WITH CHECK (
        EXISTS (SELECT 1 FROM collections WHERE id = collection_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags        WHERE id = tag_id        AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS "expense_tags_own" ON expense_tags;
CREATE POLICY "expense_tags_own" ON expense_tags FOR ALL
  USING (
        EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags     WHERE id = tag_id     AND user_id = auth.uid())
  )
  WITH CHECK (
        EXISTS (SELECT 1 FROM expenses WHERE id = expense_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags     WHERE id = tag_id     AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS "subscription_tags_own" ON subscription_tags;
CREATE POLICY "subscription_tags_own" ON subscription_tags FOR ALL
  USING (
        EXISTS (SELECT 1 FROM subscriptions WHERE id = subscription_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags          WHERE id = tag_id          AND user_id = auth.uid())
  )
  WITH CHECK (
        EXISTS (SELECT 1 FROM subscriptions WHERE id = subscription_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags          WHERE id = tag_id          AND user_id = auth.uid())
  );
CREATE INDEX IF NOT EXISTS idx_collection_tags_coll ON collection_tags(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_tags_tag ON collection_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_expense_tags_expense ON expense_tags(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_tags_tag ON expense_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tags_sub ON subscription_tags(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tags_tag ON subscription_tags(tag_id);

-- ── 21b. task_tags (junction: user_tasks ↔ tags; v4.28.0 — Task lần đầu có tag) ──
CREATE TABLE IF NOT EXISTS task_tags (
  task_id UUID NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES tags(id)       ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_tags_own" ON task_tags;
CREATE POLICY "task_tags_own" ON task_tags FOR ALL
  USING (
        EXISTS (SELECT 1 FROM user_tasks WHERE id = task_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags       WHERE id = tag_id  AND user_id = auth.uid())
  )
  WITH CHECK (
        EXISTS (SELECT 1 FROM user_tasks WHERE id = task_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags       WHERE id = tag_id  AND user_id = auth.uid())
  );
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);

-- ── 21c. VIEW tagged_items — 1 mặt đọc hợp nhất cho "mọi thứ có tag X" (v4.28.0) ──
-- WITH (security_invoker = true) bắt buộc: mặc định view chạy bằng quyền OWNER
-- (postgres) và bỏ qua RLS của bảng dưới → leak data mọi user. Cần PostgreSQL >= 15.
DROP VIEW IF EXISTS tagged_items;
CREATE VIEW tagged_items WITH (security_invoker = true) AS
      SELECT tag_id, 'collection'::text   AS kind, collection_id   AS item_id FROM collection_tags
UNION ALL SELECT tag_id, 'task'::text,          task_id         FROM task_tags
UNION ALL SELECT tag_id, 'expense'::text,       expense_id      FROM expense_tags
UNION ALL SELECT tag_id, 'subscription'::text,  subscription_id FROM subscription_tags;

-- ── 22. intentions + intention_logs — Module Incubator ĐÃ GỠ khỏi frontend ──
-- Frontend gỡ Incubator từ v6.3.0. Bảng giữ lại trong baseline để DB hiện có
-- không lỗi. Chạy data/drop_incubator_tables.sql khi muốn dọn.
CREATE TABLE IF NOT EXISTS intentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, original_reason TEXT, description TEXT,
  estimated_cost NUMERIC(12,0), estimated_time SMALLINT,
  status TEXT NOT NULL DEFAULT 'incubating' CHECK (status IN ('incubating','executed','abandoned')),
  review_date DATE, converted_to TEXT[], converted_id UUID, converted_ids JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE intentions ADD COLUMN IF NOT EXISTS description TEXT; -- nâng cấp DB cũ
CREATE TABLE IF NOT EXISTS intention_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intention_id UUID NOT NULL REFERENCES intentions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created','deferred','executed','abandoned','reviewed')),
  reason_note TEXT, scheduled_for DATE, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intention_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intentions_own" ON intentions;
CREATE POLICY "intentions_own" ON intentions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "intention_logs_own" ON intention_logs;
CREATE POLICY "intention_logs_own" ON intention_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM intentions WHERE id = intention_id AND user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_intentions_user ON intentions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_intention_logs_intention ON intention_logs(intention_id);

-- ── 23. fitness_logs — ĐÃ DROP ở v5.0.0 (đợt 5 dọn bảng chết) ─────────────
-- Feature Fitness Log gỡ khỏi frontend từ v4.26.0, bảng bị bỏ quên lại.
DROP TABLE IF EXISTS fitness_logs CASCADE;

-- ── 24. knowledge_groups + collection_groups ────────────────────────────────
-- [ĐÃ BỎ v4.30.0/v4.31.0] Taxonomy M:N thứ 3 trên collections, trùng việc với
-- `tags` (quyết định P2-7, 2026-08-01). Data đã copy sang tags/collection_tags
-- trước khi DROP TABLE (data/RUNBOOK.sql Phần 2 rồi Phần 3, xác nhận 2026-08-02
-- — information_schema.tables trả 0 dòng cho cả 2 bảng). Fresh install KHÔNG
-- tạo 2 bảng này nữa — nếu cần xem lại định nghĩa gốc, dùng
-- `git log -- data/schema_v4.24.0.sql`.
DROP TABLE IF EXISTS collection_groups;
DROP TABLE IF EXISTS knowledge_groups;

-- ── 25. collection_notes (v4.11.0) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collection_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL, sort_order SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cnotes_collection ON collection_notes(collection_id);
ALTER TABLE collection_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cnotes_own" ON collection_notes;
CREATE POLICY "cnotes_own" ON collection_notes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 26. inspirational_quotes (v4.12.0) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspirational_quotes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL, author TEXT, audio_url TEXT, source TEXT,
  is_active  BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quotes_user_active ON inspirational_quotes(user_id, is_active);
ALTER TABLE inspirational_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own quotes" ON inspirational_quotes;
CREATE POLICY "Users manage own quotes" ON inspirational_quotes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Explicit Data API privileges. New Supabase projects no longer auto-grant
-- access to objects created by postgres; RLS still decides which rows are visible.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  profiles, focus_sessions, xp_logs, user_tasks, collections, task_collections,
  expenses, subscriptions, tags, collection_tags, expense_tags,
  subscription_tags, task_tags, intentions, intention_logs, collection_notes,
  inspirational_quotes
TO authenticated;
GRANT ALL ON TABLE
  profiles, focus_sessions, xp_logs, user_tasks, collections, task_collections,
  expenses, subscriptions, activity_logs, tags, collection_tags, expense_tags,
  subscription_tags, task_tags, intentions, intention_logs, collection_notes,
  inspirational_quotes
TO service_role;
REVOKE ALL ON TABLE
  profiles, focus_sessions, xp_logs, user_tasks, collections, task_collections,
  expenses, subscriptions, activity_logs, tags, collection_tags, expense_tags,
  subscription_tags, task_tags, intentions, intention_logs, collection_notes,
  inspirational_quotes
FROM anon;

-- ════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ════════════════════════════════════════════════════════════════════════════
-- v5.0.0: bỏ `progress` + `habits` khỏi publication — 2 bảng đã DROP.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE profiles; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE focus_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE xp_logs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- AUTH TRIGGER: tự tạo profile khi có user mới
-- (v5.0.0: bỏ INSERT vào streaks + notification_settings — 2 bảng đã DROP)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT; final_username TEXT; counter INT := 0;
BEGIN
  base_username := LOWER(REGEXP_REPLACE(
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(NEW.email,'@',1)
    ),
    '[^a-z0-9_.]','','g'));
  IF base_username = '' OR base_username IS NULL THEN base_username := 'user'; END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1; final_username := base_username || counter;
  END LOOP;

  BEGIN
    INSERT INTO public.profiles (id, username, display_name, avatar_url, email)
    VALUES (
      NEW.id, final_username,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', final_username),
      NEW.raw_user_meta_data->>'avatar_url', NEW.email
    ) ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[handle_new_user] profiles insert failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════════
-- v4.24.0 — Hàm cross-user an toàn (KHÔNG lộ email). Bù cho việc profiles giờ
-- chỉ đọc-hàng-mình. Frontend gọi qua supabase.rpc(...).
-- ════════════════════════════════════════════════════════════════════════════

-- Đăng nhập: username → email
DROP FUNCTION IF EXISTS public.login_email(text);
CREATE FUNCTION public.login_email(p_username text)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.profiles WHERE username = lower(p_username) LIMIT 1;
$$;

-- Đăng ký: username đã tồn tại chưa?
DROP FUNCTION IF EXISTS public.username_exists(text);
CREATE FUNCTION public.username_exists(p_username text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE username = lower(p_username));
$$;

-- Đăng ký/Cài đặt: email đã dùng bởi NGƯỜI KHÁC chưa? (loại trừ chính mình)
DROP FUNCTION IF EXISTS public.email_exists(text);
CREATE FUNCTION public.email_exists(p_email text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(email) = lower(p_email)
      AND (auth.uid() IS NULL OR id <> auth.uid())
  );
$$;

-- get_leaderboard() — ĐÃ BỎ ở v5.0.0. Bảng Xếp Hạng gỡ hẳn (tính năng xã hội
-- trong app 1 người dùng = giá trị 0). Hàm này JOIN streaks + progress, cả hai
-- đều thuộc phần đang dọn.
DROP FUNCTION IF EXISTS public.get_leaderboard();

GRANT EXECUTE ON FUNCTION public.login_email(text)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.username_exists(text)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_exists(text)     TO anon, authenticated;

-- (SEED 5 lộ trình mẫu đã bỏ ở v5.0.0 — bảng `programs` không còn tồn tại)

-- ✅ DONE (v5.0.0) — 18 bảng + 1 view (tagged_items) + RLS + indexes + triggers + functions (idempotent).
-- v5.0.0 DROP tổng 12 bảng: streaks (đợt 3), 8 bảng Habit/Lộ Trình (đợt 4),
-- notification_settings + friendships + fitness_logs (đợt 5). 30 → 18.

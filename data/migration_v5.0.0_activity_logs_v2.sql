-- ════════════════════════════════════════════════════════════════════════════
-- migration_v5.0.0_activity_logs_v2.sql
--
-- ⚠️ BREAKING — PHẦN 2 XOÁ HẲN BẢNG activity_logs. CHỈ CHẠY 1 LẦN.
--    Chạy lại lần 2 sẽ xoá sạch dữ liệu vừa ghi (khác mọi migration trước đó
--    của repo này — các file cũ đều re-run an toàn). Phần 1 thì idempotent.
--
-- ĐIỀU KIỆN TIÊN QUYẾT (làm ĐÚNG THỨ TỰ):
--   1. Chấp nhận MẤT TRẮNG mọi dòng log cũ. Không sao — Life Log (nơi duy
--      nhất đọc chúng) đã bị gỡ hẳn cùng đợt này. Xác nhận 2026-08-02.
--   2. Backup bảng nếu muốn giữ đường lùi:
--      CREATE TABLE activity_logs_backup_v1 AS SELECT * FROM activity_logs;
--   3. Deploy code v5.0.0 TRƯỚC hoặc SÁT ngay sau khi chạy file này. Giữa 2
--      mốc đó mọi lệnh ghi log sẽ fail ÂM THẦM (fire-and-forget nuốt lỗi).
--
-- Nội dung:
--   PHẦN 1 (an toàn, idempotent) — user_tasks.updated_at + trigger.
--   PHẦN 2 (breaking, 1 lần)     — dựng lại activity_logs theo schema v2.
--
-- Quyết định thiết kế đã chốt 2026-08-02 (KHÔNG tự đổi khi chạy):
--   • task_id là FK ON DELETE CASCADE, KHÔNG dùng cặp entity_type/entity_id
--     polymorphic — docs/DATABASE.md tự chê pattern đó ("entity_id không thể
--     có FK → xoá entity không xoá link → rác vĩnh viễn"). Đổi lại: xoá 1 task
--     là mất luôn log + ghi chú của nó, DB tự dọn, không bao giờ có dòng mồ côi.
--     Muốn log sống sót sau khi xoá task thì đổi CASCADE → SET NULL, nhưng
--     khi đó phải tự dọn dòng mồ côi bằng tay.
--   • MỌI dòng đều gắn task_id. Bảng này CHỈ phục vụ lịch sử + ghi chú của
--     Task. Life Log (heatmap) và KPI "Hoạt động hôm nay" trên Dashboard đã bị
--     gỡ hẳn cùng đợt này, nên không còn dòng "sự kiện rời rạc" (expense_add,
--     inbox_*, focus_done, challenge_done, habit_done…) nào được ghi nữa —
--     giữ lại thì thành ghi-mà-không-ai-đọc, đúng bệnh của schema v1.
--     (Cột task_id vẫn để NULLABLE — không có lý do ép NOT NULL, và giữ vậy
--      thì file này chạy được cả trên DB đã lỡ chạy bản trước.)
--   • Ghi chú SỬA ĐƯỢC: policy UPDATE giới hạn action='note', kèm GRANT chỉ
--     cột `note` → dòng field-diff vẫn bất biến tuyệt đối.
--   • CỐ Ý KHÔNG thêm CHECK constraint cho `action` (dù docs/TASKS.md liệt kê
--     "action free-form" là lỗi). Lý do: mọi lệnh ghi log đều fire-and-forget
--     nuốt lỗi, nên CHECK bị vi phạm sẽ làm log BIẾN MẤT ÂM THẦM thay vì lộ ra.
--     Chống gõ sai bằng hằng số ACTIONS dùng chung trong useActivityLog.js.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — user_tasks.updated_at (AN TOÀN, chạy lại được)
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- Thêm cột KHÔNG default trước, để backfill được giá trị đúng sự thật:
-- nếu để DEFAULT NOW() ngay từ đầu thì mọi task cũ sẽ mang dấu thời gian của
-- lúc chạy migration (sai — chúng đâu có vừa được sửa).
ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE user_tasks SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE user_tasks ALTER COLUMN updated_at SET DEFAULT NOW();

-- Tái dùng hàm update_updated_at() đã có sẵn (schema_v4.24.0.sql § đầu file),
-- đúng kiểu habits/friendships đang dùng — không viết hàm riêng.
DROP TRIGGER IF EXISTS user_tasks_updated_at ON user_tasks;
CREATE TRIGGER user_tasks_updated_at
  BEFORE UPDATE ON user_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — activity_logs v2 (BREAKING, CHỈ CHẠY 1 LẦN)
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DROP TABLE IF EXISTS activity_logs;

CREATE TABLE activity_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Dòng thuộc về 1 task; xoá task thì cascade xoá sạch lịch sử của nó.
  task_id    UUID REFERENCES user_tasks(id) ON DELETE CASCADE,

  action     TEXT NOT NULL,

  -- 3 cột dưới chỉ có giá trị ở dòng field-diff (action = 'task_update').
  field      TEXT,
  old_value  TEXT,
  new_value  TEXT,

  -- Chỉ có giá trị ở dòng ghi chú cá nhân (action = 'note').
  note       TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chỉ 1 index — tab Activity/Note của Task Detail ("log của 1 task, mới nhất
-- trước"). Đây là truy vấn ĐỌC duy nhất của bảng này.
CREATE INDEX idx_activity_logs_task
  ON activity_logs (task_id, created_at DESC)
  WHERE task_id IS NOT NULL;

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_select_own" ON activity_logs;
CREATE POLICY "activity_logs_select_own" ON activity_logs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "activity_logs_insert_own" ON activity_logs;
CREATE POLICY "activity_logs_insert_own" ON activity_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "activity_logs_delete_own" ON activity_logs;
CREATE POLICY "activity_logs_delete_own" ON activity_logs FOR DELETE
  USING (user_id = auth.uid());

-- UPDATE chỉ mở cho dòng ghi chú. USING chặn không cho với tới dòng field-diff,
-- WITH CHECK chặn biến 1 dòng note thành dòng khác.
DROP POLICY IF EXISTS "activity_logs_update_own_note" ON activity_logs;
CREATE POLICY "activity_logs_update_own_note" ON activity_logs FOR UPDATE
  USING      (user_id = auth.uid() AND action = 'note')
  WITH CHECK (user_id = auth.uid() AND action = 'note');

-- GRANT tường minh vì DROP TABLE xoá luôn quyền của bảng cũ. Nếu default
-- privileges của project không tự cấp lại, app sẽ ăn "permission denied for
-- table activity_logs" — mà lỗi đó cũng bị nuốt (fire-and-forget), rất khó lần.
GRANT SELECT, INSERT, DELETE ON activity_logs TO authenticated;

-- Khoá UPDATE xuống mức CỘT: kể cả policy trên cho phép chạm dòng note, cũng
-- chỉ sửa được đúng cột `note`. action/created_at/field/old_value/new_value
-- bất biến ở mọi dòng.
REVOKE UPDATE ON activity_logs FROM authenticated;
GRANT UPDATE (note) ON activity_logs TO authenticated;

COMMIT;


-- ── Verify sau khi chạy ─────────────────────────────────────────────────────
-- 1) user_tasks.updated_at tồn tại và đã backfill (KHÔNG dòng nào NULL):
--    SELECT count(*) FILTER (WHERE updated_at IS NULL) AS con_null,
--           count(*) AS tong
--      FROM user_tasks;                              -- con_null phải = 0
--
-- 2) Trigger updated_at đã gắn:
--    SELECT tgname FROM pg_trigger
--     WHERE tgrelid = 'user_tasks'::regclass AND NOT tgisinternal;
--                                                    -- phải có user_tasks_updated_at
--
-- 3) activity_logs đúng 9 cột, không còn label/amount/meta:
--    SELECT column_name, data_type, is_nullable FROM information_schema.columns
--     WHERE table_name = 'activity_logs' ORDER BY ordinal_position;
--    -- mong đợi: id, user_id, task_id, action, field, old_value, new_value,
--    --           note, created_at
--
-- 4) FK task_id là CASCADE:
--    SELECT conname, confdeltype FROM pg_constraint
--     WHERE conrelid = 'activity_logs'::regclass AND contype = 'f';
--                                                    -- task_id phải là 'c'
--
-- 5) Đủ 4 policy (select/insert/delete/update_own_note):
--    SELECT policyname, cmd FROM pg_policies
--     WHERE tablename = 'activity_logs' ORDER BY policyname;
--
-- 6) Quyền UPDATE bị bó về đúng 1 cột `note`:
--    SELECT column_name FROM information_schema.column_privileges
--     WHERE table_name = 'activity_logs' AND grantee = 'authenticated'
--       AND privilege_type = 'UPDATE';               -- chỉ ra đúng 1 dòng: note
--
-- 7) 2 index đã tạo:
--    SELECT indexname FROM pg_indexes WHERE tablename = 'activity_logs';
--    -- mong đợi: activity_logs_pkey, idx_activity_logs_task

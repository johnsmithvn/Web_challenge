-- ════════════════════════════════════════════════════════════════════════════
-- migration_v4.31.0_recurrence_chain.sql
--
-- AN TOÀN — chỉ ADD COLUMN + index, không mất data, idempotent (chạy lại được).
--
-- Nội dung:
--   1. Thêm user_tasks.recurrence_parent_id — link "task này được task nào SINH
--      RA" khi 1 task lặp lại (recurrence_rule) hoàn thành. Cố ý đặt tên khác
--      `parent_id` — tránh đụng cột `parent_id` subtask đang có kế hoạch riêng
--      (xem docs/TASKS.md § Còn nợ). 2 quan hệ khác nhau hoàn toàn, không dùng
--      chung 1 cột.
--   2. Index trên cột đó — dùng để tìm "task này đã sinh ra task con nào chưa"
--      (chống spawn trùng) và "tìm task con để xoá khi bỏ tích".
--
-- Quy tắc nghiệp vụ cột này phục vụ (code ở useUserTasks.js):
--   - Xoá task GỐC (recurrence_parent_id IS NULL) → chỉ xoá đúng nó, KHÔNG
--     cascade xuống hậu duệ.
--   - Xoá task KHÔNG PHẢI gốc (tự nó được sinh ra) → cascade xoá toàn bộ hậu
--     duệ phía sau (con, cháu...).
--   - ON DELETE CASCADE thuần của Postgres lan truyền vô điều kiện nên KHÔNG
--     tự làm được rule bất đối xứng trên — app phải "cắt dây" con của task gốc
--     (UPDATE ... SET recurrence_parent_id = NULL) TRƯỚC khi xoá task gốc, để
--     CASCADE không bị kích hoạt. Xoá task không phải gốc thì cứ xoá thẳng,
--     để CASCADE tự lo phần còn lại.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE user_tasks
  ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID REFERENCES user_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_user_tasks_recurrence_parent
  ON user_tasks (recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;

COMMIT;

-- ── Verify sau khi chạy ────────────────────────────────────────────────────
-- 1) Cột + FK đã có:
--    SELECT column_name, is_nullable, data_type FROM information_schema.columns
--     WHERE table_name = 'user_tasks' AND column_name = 'recurrence_parent_id';
--
-- 2) FK trỏ đúng bảng, ON DELETE CASCADE:
--    SELECT confdeltype FROM pg_constraint
--     WHERE conname LIKE '%recurrence_parent_id%'; -- phải là 'c' (cascade)

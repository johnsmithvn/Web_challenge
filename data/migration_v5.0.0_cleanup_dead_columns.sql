-- ════════════════════════════════════════════════════════════════════════════
-- migration_v5.0.0_cleanup_dead_columns.sql
--
-- 🚨 BREAKING — DROP COLUMN là KHÔNG HOÀN LẠI ĐƯỢC. ĐỌC HẾT TRƯỚC KHI CHẠY.
--
-- ĐIỀU KIỆN TIÊN QUYẾT (theo đúng thứ tự):
--   1. Đã chạy migration_v4.28.0_tags_rls_indexes.sql
--   2. Đã deploy code v4.28.0 lên production — code này đã bỏ ghi vào
--      collections.priority và user_tasks.collection_id, và đổi status
--      default 'inbox' → 'unread'. Chạy SQL này TRƯỚC khi deploy code sẽ
--      làm mọi INSERT collections/user_tasks fail (ghi vào cột đã xoá).
--   3. Đã backup: Supabase Dashboard → Database → Backups, hoặc
--      pg_dump "$DATABASE_URL" > backup_pre_v5.sql
--   4. Đã chạy các câu SELECT ở mục 0 và xác nhận không mất gì
--
-- Vì sao MAJOR: RULES §9 — "Database schema breaking changes" = MAJOR.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. KIỂM TRƯỚC — chạy riêng, ĐỪNG chạy chung transaction ─────────────────
-- Nếu bất kỳ câu nào trả về > 0 thì DỪNG, có data thật sẽ bị mất:
--
--   SELECT count(*) FROM collections WHERE resolved     IS NOT NULL AND resolved <> false;
--   SELECT count(*) FROM collections WHERE course_name  IS NOT NULL;
--   SELECT count(*) FROM collections WHERE duration_min IS NOT NULL;
--   SELECT count(*) FROM collections WHERE reviewed_at  IS NOT NULL;
--   SELECT count(*) FROM collections WHERE priority     IS NOT NULL;
--
-- collection_id: kiểm mọi link 1:1 cũ đã vào junction hết chưa (phải = 0):
--   SELECT count(*) FROM user_tasks t
--    WHERE t.collection_id IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM task_collections tc
--                       WHERE tc.task_id = t.id
--                         AND tc.collection_id = t.collection_id);

BEGIN;

-- ── 1. Backfill an toàn: đẩy nốt link 1:1 còn sót vào junction ──────────────
-- schema_v4.24.0.sql:333 đã làm việc này một lần, nhưng row tạo sau đó (nếu
-- có caller nào từng truyền collectionId) thì chưa. Chạy lại cho chắc.
INSERT INTO task_collections (task_id, collection_id)
SELECT id, collection_id FROM user_tasks WHERE collection_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 2. DROP cột chết trên collections ───────────────────────────────────────
-- Đếm usage trong useCollections.js + CollectPage.jsx + InboxPage.jsx +
-- ArticleCard.jsx: resolved 0, course_name 0, duration_min 0, reviewed_at 0.
-- priority: 1 hit duy nhất — passthrough lúc INSERT, không đọc/render ở đâu.
-- (Còn xung đột kiểu: collections.priority là TEXT, user_tasks.priority là
--  SMALLINT — hai thứ khác nhau trùng tên.)
ALTER TABLE collections DROP COLUMN IF EXISTS resolved;
ALTER TABLE collections DROP COLUMN IF EXISTS course_name;
ALTER TABLE collections DROP COLUMN IF EXISTS duration_min;
ALTER TABLE collections DROP COLUMN IF EXISTS reviewed_at;
ALTER TABLE collections DROP COLUMN IF EXISTS priority;

-- ── 3. DROP user_tasks.collection_id (deprecated từ v4.5.0) ─────────────────
-- schema_v4.24.0.sql:317 đã COMMENT 'DEPRECATED v4.5.0: use task_collections'
-- nhưng FK + index + cột vẫn sống, và addTask vẫn ghi vào. Hai đường link
-- song song cho cùng một quan hệ = nguồn bug.
ALTER TABLE user_tasks DROP CONSTRAINT IF EXISTS fk_user_tasks_collection;
DROP INDEX IF EXISTS idx_user_tasks_collection_id;
ALTER TABLE user_tasks DROP COLUMN IF EXISTS collection_id;

-- ── 4. Chuẩn hoá collections.status ─────────────────────────────────────────
-- Trước: 4 giá trị không có constraint — 'inbox', 'unread', 'read', 'archived'.
-- 'inbox' TRÙNG NGHĨA với type='inbox' (classifyItem set cả hai cùng lúc), và
-- không có query nào filter theo status='inbox' → dư thừa, sẽ lệch nhau.
--
-- ⚠️ GIỮ 'archived' — nó là soft-delete đang dùng thật:
--    CollectPage.jsx:1075  items.filter(i => i.status !== 'archived')
--    useCollections.js:32  q.neq('status','archived')
--    Chuẩn hoá về chỉ (unread, read) sẽ XOÁ MẤT chức năng archive.
UPDATE collections SET status = 'unread' WHERE status = 'inbox' OR status IS NULL;

ALTER TABLE collections DROP CONSTRAINT IF EXISTS chk_collections_status;
ALTER TABLE collections ADD CONSTRAINT chk_collections_status
  CHECK (status IN ('unread','read','archived'));

ALTER TABLE collections ALTER COLUMN status SET DEFAULT 'unread';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- KIỂM TRA SAU KHI CHẠY
-- ════════════════════════════════════════════════════════════════════════════
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'collections' ORDER BY ordinal_position;
--   -- KHÔNG còn: resolved, course_name, duration_min, reviewed_at, priority
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'user_tasks' AND column_name = 'collection_id';
--   -- phải trả 0 dòng
--
--   SELECT status, count(*) FROM collections GROUP BY status;
--   -- chỉ còn unread / read / archived
--
-- SMOKE TEST TRÊN APP (bắt buộc, không có test tự động cho phần này):
--   1. /inbox  — thêm item mới  → INSERT collections thành công
--   2. /inbox  — phân loại 1 item sang 🎧 Podcast → không lỗi constraint
--   3. /tasks  — thêm task mới  → INSERT user_tasks thành công
--   4. /tasks  — bấm 🔗 link 1 bài KB → task_collections vẫn hoạt động
--   5. /collect — archive 1 bài → vẫn ẩn khỏi danh sách
-- ════════════════════════════════════════════════════════════════════════════

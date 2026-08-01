-- ════════════════════════════════════════════════════════════════════════════
-- RUNBOOK.sql — chạy 1 lần, từ trên xuống, cho database hiện tại của bạn
-- (KHÔNG dùng để dựng DB mới từ đầu — việc đó dùng schema_v4.24.0.sql)
--
-- File này GỘP LẠI 3 migration đã viết riêng để bạn khỏi phải tự nhớ thứ tự.
-- 3 file gốc VẪN GIỮ NGUYÊN trong data/ — đó là hồ sơ lịch sử theo version
-- của dự án, không phải rác:
--   - migration_v4.28.0_tags_rls_indexes.sql
--   - migration_v5.0.0_cleanup_dead_columns.sql
--   - migration_v4.30.0_merge_knowledge_groups_into_tags.sql
--
-- CÁCH DÙNG: đọc và chạy từng PHẦN theo đúng thứ tự 1 → 2 → 3.
--   - PHẦN 1, 2: nhãn "AN TOÀN" — chạy thẳng, không mất dữ liệu, chạy lại
--     nhiều lần cũng không sao.
--   - Giữa PHẦN 2 và PHẦN 3 có mục "⛔ DỪNG LẠI" — PHẢI đọc và làm đúng
--     hướng dẫn ở đó trước khi qua PHẦN 3.
--   - PHẦN 3: BREAKING, KHÔNG HOÀN LẠI ĐƯỢC — đang để dạng COMMENT (không tự
--     chạy). Chỉ bỏ comment khi đã làm đủ điều kiện ở mục "⛔ DỪNG LẠI".
--
-- KHÔNG liên quan tới file này: reset_user_data.sql — đó là công cụ XOÁ DỮ
-- LIỆU (không phải sửa cấu trúc bảng), chỉ dùng khi bạn CHỦ ĐỘNG muốn xoá
-- sạch data để test lại từ đầu. Đừng nhầm 2 việc.
-- ════════════════════════════════════════════════════════════════════════════


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ PHẦN 1 — AN TOÀN — v4.28.0: fix constraint, RLS, index, thêm task_tags   │
-- └──────────────────────────────────────────────────────────────────────────┘

BEGIN;

-- 1a. chk_collections_type: thêm 'podcast', bỏ 'emotion' chết
UPDATE collections SET type = 'note' WHERE type = 'emotion';
ALTER TABLE collections DROP CONSTRAINT IF EXISTS chk_collections_type;
ALTER TABLE collections ADD CONSTRAINT chk_collections_type
  CHECK (type IN ('inbox','note','quote','learn','idea','ai','entertainment','podcast'));

-- 1b. RLS 4 junction — kiểm ownership CẢ HAI phía (trước chỉ kiểm 1 phía)
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

-- 1c. Index tag_id còn thiếu (filter theo tag đang full scan)
CREATE INDEX IF NOT EXISTS idx_expense_tags_tag      ON expense_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tags_tag ON subscription_tags(tag_id);

-- 1d. task_tags — Task lần đầu có tag
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

-- 1e. VIEW tagged_items — 1 mặt đọc hợp nhất cho "mọi thứ có tag X"
DROP VIEW IF EXISTS tagged_items;
CREATE VIEW tagged_items WITH (security_invoker = true) AS
      SELECT tag_id, 'collection'::text   AS kind, collection_id   AS item_id FROM collection_tags
UNION ALL SELECT tag_id, 'task'::text,          task_id         FROM task_tags
UNION ALL SELECT tag_id, 'expense'::text,       expense_id      FROM expense_tags
UNION ALL SELECT tag_id, 'subscription'::text,  subscription_id FROM subscription_tags;

COMMIT;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ PHẦN 2 — AN TOÀN — v4.30.0 Phase 1: gộp knowledge_groups vào tags        │
-- └──────────────────────────────────────────────────────────────────────────┘

BEGIN;

ALTER TABLE tags ADD COLUMN IF NOT EXISTS emoji TEXT;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS description TEXT;

-- name lowercase để khớp convention hiện có (useTags.addTag() luôn lowercase)
-- DISTINCT ON: code cũ không chặn 2 nhóm trùng tên — gộp về 1 dòng/tên trước
-- khi insert, tránh lỗi Postgres "ON CONFLICT DO UPDATE command cannot affect
-- row a second time" nếu user có ≥2 nhóm trùng lower(trim(title))
INSERT INTO tags (user_id, name, emoji, description)
SELECT DISTINCT ON (kg.user_id, lower(trim(kg.title)))
       kg.user_id, lower(trim(kg.title)), kg.emoji, kg.description
FROM knowledge_groups kg
ORDER BY kg.user_id, lower(trim(kg.title)), kg.emoji NULLS LAST, kg.created_at
ON CONFLICT (user_id, name) DO UPDATE
  SET emoji       = COALESCE(tags.emoji, EXCLUDED.emoji),
      description = COALESCE(tags.description, EXCLUDED.description);

-- sort_order CỐ Ý không mang sang (đã xác nhận không dùng tính năng sắp xếp thủ công)
INSERT INTO collection_tags (collection_id, tag_id)
SELECT cg.collection_id, t.id
FROM collection_groups cg
JOIN knowledge_groups kg ON kg.id = cg.group_id
JOIN tags t ON t.user_id = kg.user_id AND t.name = lower(trim(kg.title))
ON CONFLICT (collection_id, tag_id) DO NOTHING;

COMMIT;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ ⛔ DỪNG LẠI — chạy hết các SELECT dưới đây, đọc kỹ kết quả, rồi mới      │
-- │    quyết định có mở PHẦN 3 hay không. Đừng bỏ qua bước này.              │
-- └──────────────────────────────────────────────────────────────────────────┘

-- (A) Row rác cross-user trước khi RLS thắt chặt ở Phần 1 — cả 4 câu PHẢI = 0
--     dòng. Nếu có, phải DELETE bằng service_role trước, sau Phần 1 sẽ không
--     xoá được qua API nữa:
--   SELECT * FROM task_collections tc
--     JOIN user_tasks  t ON t.id = tc.task_id
--     JOIN collections c ON c.id = tc.collection_id
--    WHERE t.user_id <> c.user_id;
--   SELECT * FROM collection_tags ct
--     JOIN collections c ON c.id = ct.collection_id
--     JOIN tags        g ON g.id = ct.tag_id
--    WHERE c.user_id <> g.user_id;
--   SELECT * FROM expense_tags et
--     JOIN expenses e ON e.id = et.expense_id
--     JOIN tags     g ON g.id = et.tag_id
--    WHERE e.user_id <> g.user_id;
--   SELECT * FROM subscription_tags st
--     JOIN subscriptions s ON s.id = st.subscription_id
--     JOIN tags          g ON g.id = st.tag_id
--    WHERE s.user_id <> g.user_id;

-- (B) knowledge_groups đã copy đủ sang tags chưa — 2 số phải bằng nhau
--     (hoặc bên tags >= vì có thể gộp vào tag trùng tên đã có sẵn):
--   SELECT count(*) FROM knowledge_groups;
--   SELECT count(*) FROM tags WHERE emoji IS NOT NULL;
--   SELECT count(*) FROM collection_groups;
--   SELECT count(*) FROM collection_tags ct JOIN tags t ON t.id = ct.tag_id
--    WHERE t.emoji IS NOT NULL;

-- (C) Các cột chuẩn bị DROP ở Phần 3 — PHẢI = 0, nếu > 0 là có data thật:
--   SELECT count(*) FROM collections WHERE resolved     IS NOT NULL AND resolved <> false;
--   SELECT count(*) FROM collections WHERE course_name  IS NOT NULL;
--   SELECT count(*) FROM collections WHERE duration_min IS NOT NULL;
--   SELECT count(*) FROM collections WHERE reviewed_at  IS NOT NULL;
--   SELECT count(*) FROM collections WHERE priority     IS NOT NULL;
--   SELECT count(*) FROM user_tasks t
--    WHERE t.collection_id IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM task_collections tc
--                       WHERE tc.task_id = t.id AND tc.collection_id = t.collection_id);

-- (D) Điều kiện KHÔNG-thuộc-SQL, tự xác nhận trước khi qua Phần 3:
--     [ ] Đã deploy code app mới nhất (không còn ghi collections.priority /
--         user_tasks.collection_id; CollectPage.jsx KHÔNG còn UI "Nhóm",
--         không đọc tags.emoji/description; useCollections.js không select emoji)
--     [ ] Đã smoke test /collect → không còn tab 📁 Nhóm, mọi bài viết (kể cả
--         bài từng ở trong nhóm cũ) vẫn hiện đầy đủ với tag thường
--     [ ] Đã backup DB (Supabase Dashboard → Database → Backups, hoặc
--         pg_dump "$DATABASE_URL" > backup_pre_v5.sql)


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ PHẦN 3 — BREAKING, KHÔNG HOÀN LẠI — đang COMMENT, tự bỏ comment khi sẵn  │
-- │          sàng (bôi đen từ BEGIN tới COMMIT bên dưới, bỏ "-- " đầu dòng)  │
-- └──────────────────────────────────────────────────────────────────────────┘

-- BEGIN;
--
-- -- 3a. Backfill an toàn: đẩy nốt link 1:1 còn sót vào junction
-- INSERT INTO task_collections (task_id, collection_id)
-- SELECT id, collection_id FROM user_tasks WHERE collection_id IS NOT NULL
-- ON CONFLICT DO NOTHING;
--
-- -- 3b. DROP cột chết trên collections
-- ALTER TABLE collections DROP COLUMN IF EXISTS resolved;
-- ALTER TABLE collections DROP COLUMN IF EXISTS course_name;
-- ALTER TABLE collections DROP COLUMN IF EXISTS duration_min;
-- ALTER TABLE collections DROP COLUMN IF EXISTS reviewed_at;
-- ALTER TABLE collections DROP COLUMN IF EXISTS priority;
--
-- -- 3c. DROP user_tasks.collection_id (deprecated từ v4.5.0)
-- ALTER TABLE user_tasks DROP CONSTRAINT IF EXISTS fk_user_tasks_collection;
-- DROP INDEX IF EXISTS idx_user_tasks_collection_id;
-- ALTER TABLE user_tasks DROP COLUMN IF EXISTS collection_id;
--
-- -- 3d. Chuẩn hoá collections.status — GIỮ 'archived' (soft-delete đang dùng thật)
-- UPDATE collections SET status = 'unread' WHERE status = 'inbox' OR status IS NULL;
-- ALTER TABLE collections DROP CONSTRAINT IF EXISTS chk_collections_status;
-- ALTER TABLE collections ADD CONSTRAINT chk_collections_status
--   CHECK (status IN ('unread','read','archived'));
-- ALTER TABLE collections ALTER COLUMN status SET DEFAULT 'unread';
--
-- -- 3e. Xoá bảng group cũ (đã copy hết sang tags/collection_tags ở Phần 2)
-- DROP TABLE IF EXISTS collection_groups;
-- DROP TABLE IF EXISTS knowledge_groups;
--
-- -- 3f. Xoá cột emoji/description trên tags — quyết định sau (2026-08-01):
-- -- bỏ hẳn tính năng "Nhóm" khỏi UI, không còn ai đọc 2 cột này nữa
-- ALTER TABLE tags DROP COLUMN IF EXISTS emoji;
-- ALTER TABLE tags DROP COLUMN IF EXISTS description;
--
-- COMMIT;


-- ════════════════════════════════════════════════════════════════════════════
-- KIỂM TRA SAU KHI CHẠY PHẦN 3
-- ════════════════════════════════════════════════════════════════════════════
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'collections' AND column_name IN
--      ('resolved','course_name','duration_min','reviewed_at','priority');
--   -- phải trả 0 dòng
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'user_tasks' AND column_name = 'collection_id';
--   -- phải trả 0 dòng
--
--   SELECT status, count(*) FROM collections GROUP BY status;
--   -- chỉ còn unread / read / archived
--
--   SELECT table_name FROM information_schema.tables
--    WHERE table_name IN ('knowledge_groups','collection_groups');
--   -- phải trả 0 dòng
--
-- SMOKE TEST TRÊN APP (bắt buộc, không có test tự động cho phần này):
--   1. /inbox   — thêm item mới → INSERT collections thành công
--   2. /inbox   — phân loại 1 item sang 🎧 Podcast → không lỗi constraint
--   3. /tasks   — thêm task mới → INSERT user_tasks thành công
--   4. /tasks   — bấm 🔗 link 1 bài KB → task_collections vẫn hoạt động
--   5. /collect — archive 1 bài → vẫn ẩn khỏi danh sách
--   6. /collect — Kho Tàng hiện đúng nhóm cũ (giờ là tag có emoji), bấm vào
--      xem đúng danh sách bài, tạo nhóm mới vẫn hoạt động
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- migration_v4.28.0_tags_rls_indexes.sql
--
-- AN TOÀN — không DROP COLUMN, không mất data, idempotent (chạy lại được).
-- Chạy file này TRƯỚC migration_v5.0.0.
--
-- Nội dung:
--   1. P0-1  Sửa chk_collections_type: thêm 'podcast', bỏ 'emotion'
--   2. P0-2  4 junction RLS chỉ kiểm ownership 1 phía → kiểm cả 2 phía
--   3. P1-3  2 index tag_id còn thiếu (filter theo tag đang full scan)
--   4. Thêm  task_tags junction (Task hiện KHÔNG có tag nào)
--   5. Thêm  VIEW tagged_items — 1 mặt đọc hợp nhất cho filter/search
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. P0-1: chk_collections_type ───────────────────────────────────────────
-- Lỗi: src/data/knowledge.json có type 'podcast' nhưng CHECK cũ KHÔNG có
-- → classifyItem(id,'podcast') fail constraint. Ngược lại 'emotion' nằm trong
-- CHECK nhưng không tồn tại ở đâu trong src/ (grep 0 hit).
--
-- Dọn data trước rồi mới áp constraint, nếu không constraint sẽ fail khi có
-- row 'emotion' cũ. 'note' là type trung tính nhất để hạ cánh.
UPDATE collections SET type = 'note' WHERE type = 'emotion';

ALTER TABLE collections DROP CONSTRAINT IF EXISTS chk_collections_type;
ALTER TABLE collections ADD CONSTRAINT chk_collections_type
  CHECK (type IN ('inbox','note','quote','learn','idea','ai','entertainment','podcast'));

-- ── 2. P0-2: RLS junction — kiểm ownership CẢ HAI phía ──────────────────────
-- Trước: chỉ kiểm 1 phía → ghi được row trỏ sang collection/tag của user khác.
-- Không leak khi đọc (RLS của bảng đích chặn) nhưng tạo được rác vô nghĩa,
-- render thành link trắng.
--
-- ⚠️ Sau khi thắt USING, row rác cross-user (nếu có) sẽ KHÔNG select/delete
--    được qua API nữa. Chạy 4 câu SELECT ở cuối file để kiểm TRƯỚC nếu lo.

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

-- ── 3. P1-3: index tag_id còn thiếu ─────────────────────────────────────────
-- collection_tags đã có cả 2 chiều. expense_tags / subscription_tags chỉ có
-- chiều entity → query "mọi expense có tag X" đang full scan.
CREATE INDEX IF NOT EXISTS idx_expense_tags_tag      ON expense_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tags_tag ON subscription_tags(tag_id);

-- ── 4. task_tags — Task lần đầu có tag ──────────────────────────────────────
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

-- CHỈ index tag_id. KHÔNG tạo index task_id — PRIMARY KEY (task_id, tag_id)
-- đã index task_id làm cột dẫn đầu. (Các junction cũ tạo index trùng PK:
-- idx_collection_tags_coll, idx_expense_tags_expense, idx_subscription_tags_sub
-- — dư thừa, tốn write + disk. Không copy lỗi đó.)
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);

-- ── 5. VIEW tagged_items — 1 mặt đọc hợp nhất ───────────────────────────────
-- Trả lời "mọi thứ có tag X" bằng 1 query thay vì 4 query + ghép ở client.
-- Giữ N junction để GHI (có FK + CASCADE), 1 view để ĐỌC.
--
-- ⚠️ security_invoker = true là BẮT BUỘC. Mặc định view chạy bằng quyền của
--    OWNER (postgres) → BỎ QUA RLS của bảng dưới → leak data mọi user.
--    Cần PostgreSQL >= 15 (Supabase hiện tại đạt). Kiểm: SHOW server_version;
DROP VIEW IF EXISTS tagged_items;
CREATE VIEW tagged_items WITH (security_invoker = true) AS
      SELECT tag_id, 'collection'::text   AS kind, collection_id   AS item_id FROM collection_tags
UNION ALL SELECT tag_id, 'task'::text,          task_id         FROM task_tags
UNION ALL SELECT tag_id, 'expense'::text,       expense_id      FROM expense_tags
UNION ALL SELECT tag_id, 'subscription'::text,  subscription_id FROM subscription_tags;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- KIỂM TRA SAU KHI CHẠY
-- ════════════════════════════════════════════════════════════════════════════
-- 1) CHECK constraint đã có 'podcast', đã bỏ 'emotion':
--    SELECT pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conname = 'chk_collections_type';
--
-- 2) View chạy đúng quyền (phải trả về security_invoker=true):
--    SELECT reloptions FROM pg_class WHERE relname = 'tagged_items';
--
-- 3) Đếm theo tag qua view (thay <TAG_UUID>):
--    SELECT kind, count(*) FROM tagged_items
--     WHERE tag_id = '<TAG_UUID>' GROUP BY kind;
--
-- 4) Tìm row rác cross-user TRƯỚC khi thắt RLS (chạy bằng service_role).
--    Cả 4 phải trả về 0 dòng; nếu có, DELETE chúng bằng service_role
--    trước khi apply policy mới, không thì sau đó không xoá được qua API:
--    SELECT * FROM task_collections tc
--      JOIN user_tasks  t ON t.id = tc.task_id
--      JOIN collections c ON c.id = tc.collection_id
--     WHERE t.user_id <> c.user_id;
--    SELECT * FROM collection_tags ct
--      JOIN collections c ON c.id = ct.collection_id
--      JOIN tags        g ON g.id = ct.tag_id
--     WHERE c.user_id <> g.user_id;
--    SELECT * FROM expense_tags et
--      JOIN expenses e ON e.id = et.expense_id
--      JOIN tags     g ON g.id = et.tag_id
--     WHERE e.user_id <> g.user_id;
--    SELECT * FROM subscription_tags st
--      JOIN subscriptions s ON s.id = st.subscription_id
--      JOIN tags          g ON g.id = st.tag_id
--     WHERE s.user_id <> g.user_id;

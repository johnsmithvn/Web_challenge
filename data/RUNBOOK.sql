-- ============================================================================
-- RUNBOOK.sql -- nguon duy nhat cho phan SQL con phai chay (v4.28.0/v4.30.0/v5.0.0)
--
-- 2026-08-02: gop cac migration standalone (migration_v4.28.0_tags_rls_indexes.sql,
-- migration_v4.30.0_merge_knowledge_groups_into_tags.sql,
-- migration_v5.0.0_cleanup_dead_columns.sql) vao day roi XOA 3 file do -- toan bo
-- noi dung cua chung da nam du trong file nay, giu 2 noi trung nhau de chay tay
-- rat de nham (dung migrate_v5.0.0 chuan, lai lay nham file cu -> loi copy-paste
-- do ky tu Unicode trang tri trong file cu). Muon xem lai SQL nguyen ban tung
-- version, dung `git log -- data/migration_v4.28.0_tags_rls_indexes.sql` (va
-- tuong tu cho 2 file kia) -- van con trong git history, khong mat.
--
-- File nay CHI dung ASCII thuan, khong co ky tu Unicode trang tri (--, khong
-- phai em-dash hay box-drawing) -- tranh lap lai loi copy-paste tu ky tu la
-- "--" bi auto-correct thanh "-" (1 gach) khi dan qua clipboard/app khac.
--
-- KHONG dung de dung DB moi tu dau -- viec do dung schema_v4.24.0.sql.
--
-- TRANG THAI DA XAC NHAN (2026-08-02, user tu chay + kiem tra):
--   - PHAN 1 (v4.28.0)         : DA CHAY xong.
--   - PHAN 2 (v4.30.0 Phase 1) : DA CHAY xong.
--   - PHAN 3 (breaking)        : DA CHAY xong 2026-08-02, sau khi xac nhan da
--     deploy code moi nhat len prod. Bo buoc 3a (backfill user_tasks.collection_id
--     -> task_collections) khoi khoi chay vi cot collection_id da xac nhan KHONG
--     TON TAI tren DB nay -- chay se loi "column does not exist" (transaction tu
--     rollback, khong mat gi). Verify sau khi chay: ca 4 cau kiem tra (cot chet
--     collections, user_tasks.collection_id, bang knowledge_groups/collection_groups,
--     tags.emoji/description) deu tra 0 dong -- thanh cong hoan toan.
--   - Con lai: B6 (hop nhat file nay vao schema_v4.24.0.sql) -- can chi thi ro
--     rang truoc khi lam, xem docs/TASKS.md.
--
-- KHONG lien quan toi file nay: reset_user_data.sql -- do la cong cu XOA DU
-- LIEU (khong phai sua cau truc bang), chi dung khi ban CHU DONG muon xoa
-- sach data de test lai tu dau. Dung nham 2 viec.
--
-- migration_v4.31.0_recurrence_chain.sql (task recurrence_parent_id) KHONG nam
-- trong file nay -- da chay xong rieng, xac nhan qua information_schema.columns
-- (cot recurrence_parent_id da co tren user_tasks). Van con la file standalone
-- rieng, khong can gop vao day vi khong con gi phai chay them.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PHAN 1 -- AN TOAN -- v4.28.0: fix constraint, RLS, index, them task_tags
-- DA CHAY -- giu lai de tham khao / chay lai cung an toan (idempotent)
-- ----------------------------------------------------------------------------

BEGIN;

-- 1a. chk_collections_type: them 'podcast', bo 'emotion' chet
UPDATE collections SET type = 'note' WHERE type = 'emotion';
ALTER TABLE collections DROP CONSTRAINT IF EXISTS chk_collections_type;
ALTER TABLE collections ADD CONSTRAINT chk_collections_type
  CHECK (type IN ('inbox','note','quote','learn','idea','ai','entertainment','podcast'));

-- 1b. RLS 4 junction -- kiem ownership CA HAI phia (truoc chi kiem 1 phia)
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

-- 1c. Index tag_id con thieu (filter theo tag dang full scan)
CREATE INDEX IF NOT EXISTS idx_expense_tags_tag      ON expense_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tags_tag ON subscription_tags(tag_id);

-- 1d. task_tags -- Task lan dau co tag
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

-- 1e. VIEW tagged_items -- 1 mat doc hop nhat cho "moi thu co tag X"
DROP VIEW IF EXISTS tagged_items;
CREATE VIEW tagged_items WITH (security_invoker = true) AS
      SELECT tag_id, 'collection'::text   AS kind, collection_id   AS item_id FROM collection_tags
UNION ALL SELECT tag_id, 'task'::text,          task_id         FROM task_tags
UNION ALL SELECT tag_id, 'expense'::text,       expense_id      FROM expense_tags
UNION ALL SELECT tag_id, 'subscription'::text,  subscription_id FROM subscription_tags;

COMMIT;


-- ----------------------------------------------------------------------------
-- PHAN 2 -- AN TOAN -- v4.30.0 Phase 1: gop knowledge_groups vao tags
-- DA CHAY -- giu lai de tham khao / chay lai cung an toan (idempotent)
-- ----------------------------------------------------------------------------

BEGIN;

ALTER TABLE tags ADD COLUMN IF NOT EXISTS emoji TEXT;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS description TEXT;

-- name lowercase de khop convention hien co (useTags.addTag() luon lowercase)
-- DISTINCT ON: code cu khong chan 2 nhom trung ten -- gop ve 1 dong/ten truoc
-- khi insert, tranh loi Postgres "ON CONFLICT DO UPDATE command cannot affect
-- row a second time" neu user co >= 2 nhom trung lower(trim(title))
INSERT INTO tags (user_id, name, emoji, description)
SELECT DISTINCT ON (kg.user_id, lower(trim(kg.title)))
       kg.user_id, lower(trim(kg.title)), kg.emoji, kg.description
FROM knowledge_groups kg
ORDER BY kg.user_id, lower(trim(kg.title)), kg.emoji NULLS LAST, kg.created_at
ON CONFLICT (user_id, name) DO UPDATE
  SET emoji       = COALESCE(tags.emoji, EXCLUDED.emoji),
      description = COALESCE(tags.description, EXCLUDED.description);

-- sort_order CO Y khong mang sang (da xac nhan khong dung tinh nang sap xep thu cong)
INSERT INTO collection_tags (collection_id, tag_id)
SELECT cg.collection_id, t.id
FROM collection_groups cg
JOIN knowledge_groups kg ON kg.id = cg.group_id
JOIN tags t ON t.user_id = kg.user_id AND t.name = lower(trim(kg.title))
ON CONFLICT (collection_id, tag_id) DO NOTHING;

COMMIT;


-- ----------------------------------------------------------------------------
-- KIEM TRUOC KHI CHAY PHAN 3 -- chi doc (SELECT), khong doi gi ca
-- Da chay 2026-08-02: 6 cau kiem cot chet TRA VE 0 DONG (an toan).
-- Con thieu: chua tu xac nhan 3 dieu kien (D) ben duoi (deploy code, smoke
-- test, backup DB) truoc khi mo PHAN 3.
-- ----------------------------------------------------------------------------

-- (A) Row rac cross-user truoc khi RLS thắt chặt o Phan 1 -- ca 4 cau PHAI = 0
--     dong. Neu co, phai DELETE bang service_role truoc, sau Phan 1 se khong
--     xoa duoc qua API nua:
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

-- (B) knowledge_groups da copy du sang tags chua -- 2 so phai bang nhau
--     (hoac ben tags >= vi co the gop vao tag trung ten da co san):
--   SELECT count(*) FROM knowledge_groups;
--   SELECT count(*) FROM tags WHERE emoji IS NOT NULL;
--   SELECT count(*) FROM collection_groups;
--   SELECT count(*) FROM collection_tags ct JOIN tags t ON t.id = ct.tag_id
--    WHERE t.emoji IS NOT NULL;

-- (C) Cac cot chuan bi DROP o Phan 3 -- da xac nhan 2026-08-02, ca 6 cau tra
--     ve 0 dong (khong ton tai tren DB nay). Chay lai neu muon tu kiem chung:
--   SELECT count(*) FROM collections WHERE resolved     IS NOT NULL AND resolved <> false;
--   SELECT count(*) FROM collections WHERE course_name  IS NOT NULL;
--   SELECT count(*) FROM collections WHERE duration_min IS NOT NULL;
--   SELECT count(*) FROM collections WHERE reviewed_at  IS NOT NULL;
--   SELECT count(*) FROM collections WHERE priority     IS NOT NULL;
--   SELECT count(*) FROM user_tasks t
--    WHERE t.collection_id IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM task_collections tc
--                       WHERE tc.task_id = t.id AND tc.collection_id = t.collection_id);

-- (D) Dieu kien KHONG-thuoc-SQL, tu xac nhan truoc khi qua Phan 3:
--     [ ] Da deploy code app moi nhat (khong con ghi collections.priority /
--         user_tasks.collection_id; CollectPage.jsx KHONG con UI "Nhom",
--         khong doc tags.emoji/description; useCollections.js khong select emoji)
--     [ ] Da smoke test /collect -> khong con tab Nhom, moi bai viet (ke ca
--         bai tung o trong nhom cu) van hien day du voi tag thuong
--     [ ] Da backup DB (Supabase Dashboard -> Database -> Backups, hoac
--         pg_dump "$DATABASE_URL" > backup_pre_v5.sql)


-- ----------------------------------------------------------------------------
-- PHAN 3 -- BREAKING, KHONG HOAN LAI DUOC
-- DA CHAY XONG 2026-08-02 (bo buoc 3a, xem TRANG THAI o dau file). Giu nguyen
-- dang comment ben duoi lam ho so lich su SQL da chay -- KHONG chay lai (cac
-- ALTER/DROP deu co IF EXISTS nen chay lai an toan/no-op, nhung khong can thiet).
-- ----------------------------------------------------------------------------

-- BEGIN;
--
-- -- 3a. Backfill an toan: day not link 1:1 con sot vao junction
-- -- BO QUA khi chay that 2026-08-02: cot user_tasks.collection_id da xac nhan
-- -- KHONG TON TAI tren DB nay -- chay se loi "column does not exist". Neu DB
-- -- khac van con cot nay thi buoc nay van can chay truoc 3c.
-- INSERT INTO task_collections (task_id, collection_id)
-- SELECT id, collection_id FROM user_tasks WHERE collection_id IS NOT NULL
-- ON CONFLICT DO NOTHING;
--
-- -- 3b. DROP cot chet tren collections (da xac nhan 0 dong -- an toan)
-- ALTER TABLE collections DROP COLUMN IF EXISTS resolved;
-- ALTER TABLE collections DROP COLUMN IF EXISTS course_name;
-- ALTER TABLE collections DROP COLUMN IF EXISTS duration_min;
-- ALTER TABLE collections DROP COLUMN IF EXISTS reviewed_at;
-- ALTER TABLE collections DROP COLUMN IF EXISTS priority;
--
-- -- 3c. DROP user_tasks.collection_id (deprecated tu v4.5.0, da xac nhan 0 dong)
-- ALTER TABLE user_tasks DROP CONSTRAINT IF EXISTS fk_user_tasks_collection;
-- DROP INDEX IF EXISTS idx_user_tasks_collection_id;
-- ALTER TABLE user_tasks DROP COLUMN IF EXISTS collection_id;
--
-- -- 3d. Chuan hoa collections.status -- GIU 'archived' (soft-delete dang dung that)
-- UPDATE collections SET status = 'unread' WHERE status = 'inbox' OR status IS NULL;
-- ALTER TABLE collections DROP CONSTRAINT IF EXISTS chk_collections_status;
-- ALTER TABLE collections ADD CONSTRAINT chk_collections_status
--   CHECK (status IN ('unread','read','archived'));
-- ALTER TABLE collections ALTER COLUMN status SET DEFAULT 'unread';
--
-- -- 3e. Xoa bang group cu (da copy het sang tags/collection_tags o Phan 2)
-- DROP TABLE IF EXISTS collection_groups;
-- DROP TABLE IF EXISTS knowledge_groups;
--
-- -- 3f. Xoa cot emoji/description tren tags -- quyet dinh sau (2026-08-01):
-- -- bo han tinh nang "Nhom" khoi UI, khong con ai doc 2 cot nay nua
-- ALTER TABLE tags DROP COLUMN IF EXISTS emoji;
-- ALTER TABLE tags DROP COLUMN IF EXISTS description;
--
-- COMMIT;


-- ============================================================================
-- KIEM TRA SAU KHI CHAY PHAN 3
-- ============================================================================
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'collections' AND column_name IN
--      ('resolved','course_name','duration_min','reviewed_at','priority');
--   -- phai tra 0 dong
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'user_tasks' AND column_name = 'collection_id';
--   -- phai tra 0 dong
--
--   SELECT status, count(*) FROM collections GROUP BY status;
--   -- chi con unread / read / archived
--
--   SELECT table_name FROM information_schema.tables
--    WHERE table_name IN ('knowledge_groups','collection_groups');
--   -- phai tra 0 dong
--
-- SMOKE TEST TREN APP (bat buoc, khong co test tu dong cho phan nay):
--   1. /inbox   -- them item moi -> INSERT collections thanh cong
--   2. /inbox   -- phan loai 1 item sang Podcast -> khong loi constraint
--   3. /tasks   -- them task moi -> INSERT user_tasks thanh cong
--   4. /tasks   -- bam link 1 bai KB -> task_collections van hoat dong
--   5. /collect -- archive 1 bai -> van an khoi danh sach
--   6. /collect -- Kho Tang hien dung nhom cu (gio la tag co emoji), bam vao
--      xem dung danh sach bai, tao nhom moi van hoat dong
-- ============================================================================

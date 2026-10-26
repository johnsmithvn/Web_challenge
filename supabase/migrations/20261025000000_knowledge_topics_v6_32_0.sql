-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — KNOWLEDGE: CHỦ ĐỀ v6.32.0
-- Thiết kế: docs/MODULE_KNOWLEDGE.md (phần "Knowledge v2").
--
-- Mỗi bài Knowledge có tối đa một chủ đề (`collections.topic_id`), thay vai trò phân loại
-- của 7 giá trị `collections.type` cũ. Một user có tối đa 8 chủ đề.
--
-- 1. Bảng `collection_topics` + RLS + trigger updated_at + trigger giới hạn 8.
-- 2. Cột `collections.topic_id`, FK hai cột (user_id, topic_id) để bài và chủ đề luôn cùng
--    một chủ; xoá chủ đề → bài về "Chưa xếp" (SET NULL đúng cột topic_id, cần Postgres 15+).
-- 3. `seed_starter_collection_topics(user)`: nguồn DUY NHẤT của bộ 7 chủ đề khởi đầu. Chỉ chèn
--    khi user chưa có chủ đề nào, nên không bao giờ hồi sinh chủ đề user đã xoá. App gọi qua
--    RPC cho user mới; migration gọi cho user đang có bài.
-- 4. `merge_collection_topics(from, to)`: chuyển bài sang chủ đề đích rồi xoá chủ đề nguồn,
--    trong một transaction.
-- 5. Gán chủ đề cho bài cũ theo `type` cũ: ai, entertainment, learn, idea. Các loại còn lại về
--    "Chưa xếp". Không đổi `type`, `status`, `updated_at` của bài nào.
--
-- Không xoá dữ liệu. Idempotent: chạy lại không tạo trùng, không gán đè bài đã có chủ đề.
-- Preflight (chạy trước, chỉ đọc):
--   SHOW server_version;
--   SELECT type, status, count(*) FROM collections GROUP BY 1, 2 ORDER BY 1, 2;
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Preflight ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION 'Knowledge topics migration refused: Postgres 15+ required (ON DELETE SET NULL (topic_id)). Server is %.',
      current_setting('server_version');
  END IF;
  IF to_regclass('public.collections') IS NULL THEN
    RAISE EXCEPTION 'Knowledge topics migration refused: table collections is missing. Run the v5.0.0 base migration first.';
  END IF;
END
$$;

-- ── 1. collection_topics ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collection_topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 40),
  description TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#8b5cf6',
  sort_order  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_collection_topics_user_id UNIQUE (user_id, id)  -- đích của FK hai cột ở mục 2
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_collection_topics_user_name
  ON collection_topics (user_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS idx_collection_topics_user_order
  ON collection_topics (user_id, sort_order);

-- Dùng chung hàm updated_at của domain collections (thân hàm chỉ gán NEW.updated_at).
DROP TRIGGER IF EXISTS trg_collection_topics_updated_at ON collection_topics;
CREATE TRIGGER trg_collection_topics_updated_at BEFORE UPDATE ON collection_topics
  FOR EACH ROW EXECUTE FUNCTION update_collections_updated_at();

CREATE OR REPLACE FUNCTION enforce_collection_topics_limit()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Khoá theo user để hai insert đồng thời không cùng lọt qua phép đếm.
  PERFORM pg_advisory_xact_lock(hashtext('collection_topics:' || NEW.user_id::text));
  IF (SELECT count(*) FROM collection_topics WHERE user_id = NEW.user_id) >= 8 THEN
    RAISE EXCEPTION 'Tối đa 8 chủ đề. Gộp bớt chủ đề trước khi tạo thêm.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collection_topics_limit ON collection_topics;
CREATE TRIGGER trg_collection_topics_limit BEFORE INSERT ON collection_topics
  FOR EACH ROW EXECUTE FUNCTION enforce_collection_topics_limit();

ALTER TABLE collection_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "collection_topics_select_own" ON collection_topics;
CREATE POLICY "collection_topics_select_own" ON collection_topics FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "collection_topics_insert_own" ON collection_topics;
CREATE POLICY "collection_topics_insert_own" ON collection_topics FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "collection_topics_update_own" ON collection_topics;
CREATE POLICY "collection_topics_update_own" ON collection_topics FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "collection_topics_delete_own" ON collection_topics;
CREATE POLICY "collection_topics_delete_own" ON collection_topics FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE collection_topics IS
  'Chủ đề của Knowledge (mảng quan tâm lâu dài). Tối đa 8 mỗi user; mỗi bài thuộc tối đa một chủ đề.';

-- ── 2. collections.topic_id ──────────────────────────────────────────────────
ALTER TABLE collections ADD COLUMN IF NOT EXISTS topic_id UUID;

ALTER TABLE collections DROP CONSTRAINT IF EXISTS fk_collections_topic;
ALTER TABLE collections ADD CONSTRAINT fk_collections_topic
  FOREIGN KEY (user_id, topic_id) REFERENCES collection_topics (user_id, id)
  ON DELETE SET NULL (topic_id);

CREATE INDEX IF NOT EXISTS idx_collections_user_topic ON collections (user_id, topic_id);

COMMENT ON COLUMN collections.topic_id IS
  'Chủ đề của bài (collection_topics). NULL = Chưa xếp. FK (user_id, topic_id) nên chủ đề luôn cùng chủ với bài.';

-- ── 3. Bộ chủ đề khởi đầu ────────────────────────────────────────────────────
-- SECURITY INVOKER: gọi từ app thì RLS chỉ cho chèn chủ đề của chính mình.
CREATE OR REPLACE FUNCTION seed_starter_collection_topics(p_user UUID)
RETURNS VOID LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  INSERT INTO collection_topics (user_id, name, description, color, sort_order)
  SELECT p_user, s.name, s.description, s.color, s.sort_order
  FROM (VALUES
    ('Công nghệ & AI',       'Repo, công cụ AI, lập trình, web, tự động hoá',                    '#60a5fa', 1),
    ('Tâm lý & Con người',   'Hành vi, cảm xúc, giao tiếp, động lực, các mối quan hệ',           '#a78bfa', 2),
    ('Học tập & Năng suất',  'Phương pháp học, ghi nhớ, tập trung, quản lý thời gian, thói quen', '#f59e0b', 3),
    ('Ngôn ngữ & Giao tiếp', 'Tiếng Anh, từ vựng, nghe nói, phát âm, cách diễn đạt',              '#34d399', 4),
    ('Ý tưởng & Thiết kế',   'UX/UI, ý tưởng sản phẩm, cảm hứng thiết kế, tính năng muốn thử',    '#f472b6', 5),
    ('Góc nhìn & Cảm hứng',  'Quan điểm sống, trích dẫn, bài học cá nhân',                        '#22d3ee', 6),
    ('Giải trí',             'Đọc, xem cho vui: truyện hài, hội thoại hay',                       '#f87171', 7)
  ) AS s(name, description, color, sort_order)
  WHERE NOT EXISTS (SELECT 1 FROM collection_topics WHERE user_id = p_user);
$$;

REVOKE ALL ON FUNCTION seed_starter_collection_topics(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION seed_starter_collection_topics(UUID) TO authenticated;

-- ── 4. Gộp chủ đề ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION merge_collection_topics(p_from UUID, p_to UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    RAISE EXCEPTION 'Chọn hai chủ đề khác nhau để gộp.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- RLS chỉ cho thấy chủ đề của chính user: không thấy = không phải của mình.
  IF (SELECT count(*) FROM collection_topics WHERE id IN (p_from, p_to)) <> 2 THEN
    RAISE EXCEPTION 'Không tìm thấy chủ đề cần gộp.' USING ERRCODE = 'no_data_found';
  END IF;
  UPDATE collections SET topic_id = p_to WHERE topic_id = p_from;
  DELETE FROM collection_topics WHERE id = p_from;
END;
$$;

REVOKE ALL ON FUNCTION merge_collection_topics(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION merge_collection_topics(UUID, UUID) TO authenticated;

-- ── 5. Dữ liệu cũ ────────────────────────────────────────────────────────────
SELECT seed_starter_collection_topics(u.user_id)
FROM (SELECT DISTINCT user_id FROM collections WHERE type <> 'inbox') AS u;

-- Gán chủ đề là sắp xếp lại, không phải sửa bài: giữ nguyên updated_at.
ALTER TABLE collections DISABLE TRIGGER trg_collections_updated_at;

UPDATE collections c
SET topic_id = t.id
FROM collection_topics t
WHERE t.user_id = c.user_id
  AND c.topic_id IS NULL
  AND t.name = CASE c.type
    WHEN 'ai'            THEN 'Công nghệ & AI'
    WHEN 'entertainment' THEN 'Giải trí'
    WHEN 'learn'         THEN 'Học tập & Năng suất'
    WHEN 'idea'          THEN 'Ý tưởng & Thiết kế'
  END;

ALTER TABLE collections ENABLE TRIGGER trg_collections_updated_at;

-- ── VERIFY ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'collection_topics'::regclass) THEN
    RAISE EXCEPTION 'Knowledge topics migration failed: RLS is off on collection_topics.';
  END IF;

  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'collection_topics') <> 4 THEN
    RAISE EXCEPTION 'Knowledge topics migration failed: collection_topics must have exactly 4 policies.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'collections'::regclass AND conname = 'fk_collections_topic') THEN
    RAISE EXCEPTION 'Knowledge topics migration failed: FK fk_collections_topic is missing.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger
             WHERE tgrelid = 'collections'::regclass AND tgname = 'trg_collections_updated_at'
               AND tgenabled = 'D') THEN
    RAISE EXCEPTION 'Knowledge topics migration failed: trg_collections_updated_at was left disabled.';
  END IF;

  IF EXISTS (SELECT 1 FROM collection_topics GROUP BY user_id HAVING count(*) > 8) THEN
    RAISE EXCEPTION 'Knowledge topics migration failed: a user has more than 8 topics.';
  END IF;
END
$$;

COMMIT;

-- ── ROLLBACK (chỉ khi cần, xoá mọi chủ đề và cách gán) ───────────────────────
-- BEGIN;
-- ALTER TABLE collections DROP CONSTRAINT IF EXISTS fk_collections_topic;
-- DROP INDEX IF EXISTS idx_collections_user_topic;
-- ALTER TABLE collections DROP COLUMN IF EXISTS topic_id;
-- DROP FUNCTION IF EXISTS merge_collection_topics(UUID, UUID);
-- DROP FUNCTION IF EXISTS seed_starter_collection_topics(UUID);
-- DROP TABLE IF EXISTS collection_topics;
-- DROP FUNCTION IF EXISTS enforce_collection_topics_limit();
-- COMMIT;

-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — CHỐN v6.38.0: nơi muốn đến & nơi đã qua
-- Thiết kế: docs/PLAN_CHON.md §3.1.
--
-- 1. `places`        — một chốn (quán, cà phê, chỗ đi chơi, điểm du lịch, chỗ ở).
-- 2. `place_sources` — "Ai giới thiệu": một chốn gộp nhiều lần lưu (link, tác giả, lời trích,
--                      hoặc một bài Kiến thức).
-- 3. `place_visits`  — mỗi lần "thắp đèn" (đã đến): điểm, quay lại không, món, cảm nhận, chi phí.
-- 4. Trigger `places_check_refs` — bài Kiến thức / giao dịch Tài chính được trỏ tới phải cùng chủ.
-- 5. RPC `light_place` — ghi lần đến + (tuỳ chọn) giao dịch chi Tài chính trong MỘT transaction.
--
-- "Muốn đến" / "Đã đến" KHÔNG có cột: đã đến = có ít nhất một dòng place_visits (app tự suy ra).
-- Liên kết sang module khác chỉ bằng cột nằm ở bảng Chốn; không sửa bảng user_tasks,
-- collections, finance_transactions.
--
-- Additive, không xoá dữ liệu. Idempotent (chạy lại được).
-- Chạy: psql "$DATABASE_URL" -f supabase/migrations/20261119000000_places_v6_38_0.sql
-- Preflight (chỉ đọc): SHOW server_version;
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Preflight ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION 'Places migration refused: Postgres 15+ required (ON DELETE SET NULL (plan_task_id)). Server is %.',
      current_setting('server_version');
  END IF;
  IF to_regclass('public.user_tasks') IS NULL
     OR to_regclass('public.collections') IS NULL
     OR to_regclass('public.finance_transactions') IS NULL THEN
    RAISE EXCEPTION 'Places migration refused: user_tasks, collections or finance_transactions is missing. Run the earlier migrations first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tasks_id_user_key') THEN
    RAISE EXCEPTION 'Places migration refused: UNIQUE user_tasks_id_user_key is missing. Run task_parent_v6_19_0 first.';
  END IF;
  IF to_regprocedure('public.update_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'Places migration refused: function update_updated_at() is missing. Run the v5.0.0 base migration first.';
  END IF;
END
$$;

-- ── 1. places ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS places (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  kind             TEXT NOT NULL DEFAULT 'food'
                   CHECK (kind IN ('food', 'cafe', 'outing', 'travel', 'stay', 'other')),
  area             TEXT NOT NULL DEFAULT '' CHECK (length(area) <= 60),
  address          TEXT NOT NULL DEFAULT '' CHECK (length(address) <= 240),
  lat              DOUBLE PRECISION CHECK (lat BETWEEN -90 AND 90),
  lng              DOUBLE PRECISION CHECK (lng BETWEEN -180 AND 180),
  maps_url         TEXT CHECK (maps_url IS NULL OR (maps_url ~* '^https?://' AND length(maps_url) <= 2000)),
  price_per_person INTEGER CHECK (price_per_person >= 0),
  hours_note       TEXT NOT NULL DEFAULT '' CHECK (length(hours_note) <= 80),
  must_try         TEXT[] NOT NULL DEFAULT '{}'
                   CHECK (cardinality(must_try) <= 20 AND length(array_to_string(must_try, '')) <= 1200),
  occasions        TEXT[] NOT NULL DEFAULT '{}'
                   CHECK (occasions <@ ARRAY['friends', 'date', 'family', 'solo']::TEXT[]),
  note             TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  plan_task_id     UUID,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT places_latlng_pair CHECK ((lat IS NULL) = (lng IS NULL)),
  CONSTRAINT uq_places_id_user UNIQUE (id, user_id),           -- đích FK hai cột của bảng con
  -- Việc "Đi <tên chốn>" bên Nhiệm vụ: cùng chủ; xoá việc → chốn hết "đã hẹn", không xoá chốn.
  CONSTRAINT fk_places_plan_task FOREIGN KEY (plan_task_id, user_id)
    REFERENCES user_tasks (id, user_id) ON DELETE SET NULL (plan_task_id)
);

CREATE INDEX IF NOT EXISTS idx_places_user_active ON places (user_id, created_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_places_plan_task   ON places (plan_task_id) WHERE plan_task_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_places_updated_at ON places;
CREATE TRIGGER trg_places_updated_at BEFORE UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE places IS
  'Chốn: nơi muốn đến / đã đến. Đã đến = có place_visits. archived_at khác NULL = trong Thùng rác.';
COMMENT ON COLUMN places.plan_task_id IS
  'Việc hẹn ngày đi bên Nhiệm vụ (user_tasks). FK (plan_task_id, user_id) nên luôn cùng chủ; xoá việc → NULL.';

-- ── 2. place_sources ─────────────────────────────────────────────────────────
-- Không có CHECK "phải có ít nhất một trường": collection_id bị SET NULL khi xoá bài Kiến thức, một
-- CHECK như vậy sẽ chặn luôn việc xoá bài. App kiểm khi lưu.
CREATE TABLE IF NOT EXISTS place_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id      UUID NOT NULL,
  platform      TEXT NOT NULL DEFAULT 'other'
                CHECK (platform IN ('tiktok', 'facebook', 'instagram', 'youtube', 'threads',
                                    'google_maps', 'web', 'friend', 'other')),
  url           TEXT CHECK (url IS NULL OR (url ~* '^https?://' AND length(url) <= 2000)),
  author        TEXT NOT NULL DEFAULT '' CHECK (length(author) <= 80),
  quote         TEXT NOT NULL DEFAULT '' CHECK (length(quote) <= 500),
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_place_sources_place FOREIGN KEY (place_id, user_id)
    REFERENCES places (id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_place_sources_place      ON place_sources (place_id);
CREATE INDEX IF NOT EXISTS idx_place_sources_collection ON place_sources (collection_id) WHERE collection_id IS NOT NULL;

COMMENT ON TABLE place_sources IS
  'Ai giới thiệu một chốn. Một chốn gộp nhiều nguồn. collection_id = bài Kiến thức (cùng chủ, kiểm bằng trigger).';

-- ── 3. place_visits ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS place_visits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id      UUID NOT NULL,
  visited_on    DATE NOT NULL DEFAULT CURRENT_DATE
                CHECK (visited_on <= CURRENT_DATE + 1),        -- +1: lệch múi giờ giữa máy và server
  rating        SMALLINT CHECK (rating BETWEEN 1 AND 5),
  revisit       TEXT CHECK (revisit IN ('yes', 'maybe', 'no')),
  dishes        TEXT[] NOT NULL DEFAULT '{}'
                CHECK (cardinality(dishes) <= 30 AND length(array_to_string(dishes, '')) <= 1800),
  liked_dishes  TEXT[] NOT NULL DEFAULT '{}',
  party_size    SMALLINT CHECK (party_size BETWEEN 1 AND 50),
  note          TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 4000),
  photos        TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(photos) <= 10),
  spent         BIGINT CHECK (spent >= 0),
  finance_tx_id UUID REFERENCES finance_transactions(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT place_visits_liked_subset CHECK (liked_dishes <@ dishes),
  CONSTRAINT fk_place_visits_place FOREIGN KEY (place_id, user_id)
    REFERENCES places (id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_place_visits_place      ON place_visits (place_id, visited_on DESC);
CREATE INDEX IF NOT EXISTS idx_place_visits_finance_tx ON place_visits (finance_tx_id) WHERE finance_tx_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_place_visits_updated_at ON place_visits;
CREATE TRIGGER trg_place_visits_updated_at BEFORE UPDATE ON place_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE place_visits IS
  'Mỗi lần thắp đèn (đã đến) một chốn. finance_tx_id = giao dịch chi đã ghi (cùng chủ, kiểm bằng trigger); xoá giao dịch → NULL.';

-- ── 4. Kiểm tham chiếu chéo module cùng chủ ──────────────────────────────────
-- collections và finance_transactions không có UNIQUE (id, user_id) nên không dùng được FK hai cột;
-- trigger kiểm thay (giống cách Finance kiểm reference chéo domain). So user_id tường minh nên đúng
-- cả khi chạy bằng role bỏ qua RLS.
CREATE OR REPLACE FUNCTION places_check_refs()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'place_sources' AND NEW.collection_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM collections WHERE id = NEW.collection_id AND user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Bài Kiến thức không tồn tại hoặc không phải của bạn.' USING ERRCODE = 'foreign_key_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'place_visits' AND NEW.finance_tx_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM finance_transactions WHERE id = NEW.finance_tx_id AND user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Giao dịch không tồn tại hoặc không phải của bạn.' USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_place_sources_refs ON place_sources;
CREATE TRIGGER trg_place_sources_refs BEFORE INSERT OR UPDATE OF collection_id, user_id ON place_sources
  FOR EACH ROW EXECUTE FUNCTION places_check_refs();
DROP TRIGGER IF EXISTS trg_place_visits_refs ON place_visits;
CREATE TRIGGER trg_place_visits_refs BEFORE INSERT OR UPDATE OF finance_tx_id, user_id ON place_visits
  FOR EACH ROW EXECUTE FUNCTION places_check_refs();

-- ── RLS + grants ─────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['places', 'place_sources', 'place_visits'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select_own', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (user_id = auth.uid())', t || '_select_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert_own', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (user_id = auth.uid())', t || '_insert_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update_own', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t || '_update_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_delete_own', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (user_id = auth.uid())', t || '_delete_own', t);
    -- config.toml đặt auto_expose_new_tables = false: cấp quyền tường minh, không cho anon.
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, public', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO authenticated', t);
  END LOOP;
END
$$;

-- ── 5. RPC light_place ───────────────────────────────────────────────────────
-- SECURITY INVOKER: chạy dưới RLS của chính user, chỉ thấy / ghi được dữ liệu của mình.
-- Danh mục + necessity do app tính (deriveNecessity của Finance) rồi truyền vào; CHECK của
-- finance_transactions vẫn là chốt cuối.
CREATE OR REPLACE FUNCTION light_place(
  p_place_id       UUID,
  p_visited_on     DATE     DEFAULT CURRENT_DATE,
  p_rating         SMALLINT DEFAULT NULL,
  p_revisit        TEXT     DEFAULT NULL,
  p_dishes         TEXT[]   DEFAULT '{}',
  p_liked_dishes   TEXT[]   DEFAULT '{}',
  p_party_size     SMALLINT DEFAULT NULL,
  p_note           TEXT     DEFAULT '',
  p_photos         TEXT[]   DEFAULT '{}',
  p_spent          BIGINT   DEFAULT NULL,
  p_to_finance     BOOLEAN  DEFAULT FALSE,
  p_category_id    TEXT     DEFAULT NULL,
  p_subcategory_id TEXT     DEFAULT NULL,
  p_necessity      TEXT     DEFAULT NULL
)
RETURNS place_visits LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_name  TEXT;
  v_tx_id UUID;
  v_visit place_visits;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Cần đăng nhập.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- RLS chỉ cho thấy chốn của chính user: không thấy = không phải của mình.
  SELECT name INTO v_name FROM places
   WHERE id = p_place_id AND user_id = v_user AND archived_at IS NULL;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy chốn (có thể đã vào Thùng rác).' USING ERRCODE = 'no_data_found';
  END IF;

  IF p_to_finance THEN
    IF p_spent IS NULL OR p_spent <= 0 THEN
      RAISE EXCEPTION 'Nhập chi phí lớn hơn 0 để ghi vào Tài chính.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF p_category_id IS NULL OR p_necessity IS NULL THEN
      RAISE EXCEPTION 'Thiếu danh mục Tài chính.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    INSERT INTO finance_transactions (user_id, amount, occurred_at, type, category_id, subcategory_id,
                                      necessity, merchant, note)
    VALUES (v_user, p_spent, COALESCE(p_visited_on, CURRENT_DATE), 'expense', p_category_id, p_subcategory_id,
            p_necessity, left(v_name, 120), 'Chốn · ' || v_name)
    RETURNING id INTO v_tx_id;
  END IF;

  INSERT INTO place_visits (user_id, place_id, visited_on, rating, revisit, dishes, liked_dishes,
                            party_size, note, photos, spent, finance_tx_id)
  VALUES (v_user, p_place_id, COALESCE(p_visited_on, CURRENT_DATE), p_rating, p_revisit,
          COALESCE(p_dishes, '{}'), COALESCE(p_liked_dishes, '{}'), p_party_size,
          COALESCE(p_note, ''), COALESCE(p_photos, '{}'), p_spent, v_tx_id)
  RETURNING * INTO v_visit;

  RETURN v_visit;
END;
$$;

REVOKE ALL ON FUNCTION light_place(UUID, DATE, SMALLINT, TEXT, TEXT[], TEXT[], SMALLINT, TEXT, TEXT[], BIGINT, BOOLEAN, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION light_place(UUID, DATE, SMALLINT, TEXT, TEXT[], TEXT[], SMALLINT, TEXT, TEXT[], BIGINT, BOOLEAN, TEXT, TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION light_place(UUID, DATE, SMALLINT, TEXT, TEXT[], TEXT[], SMALLINT, TEXT, TEXT[], BIGINT, BOOLEAN, TEXT, TEXT, TEXT) IS
  'Thắp đèn một chốn: ghi place_visits và (nếu p_to_finance) giao dịch chi finance_transactions trong một transaction.';

-- ── VERIFY ───────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['places', 'place_sources', 'place_visits'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.' || t)) THEN
      RAISE EXCEPTION 'Places migration failed: RLS is off on %.', t;
    END IF;
    IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t) <> 4 THEN
      RAISE EXCEPTION 'Places migration failed: % must have exactly 4 policies.', t;
    END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'Places migration failed: anon can read %.', t;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_places_plan_task') THEN
    RAISE EXCEPTION 'Places migration failed: fk_places_plan_task is missing.';
  END IF;
  IF has_function_privilege('anon',
       'light_place(uuid, date, smallint, text, text[], text[], smallint, text, text[], bigint, boolean, text, text, text)',
       'EXECUTE') THEN
    RAISE EXCEPTION 'Places migration failed: anon can execute light_place.';
  END IF;
END
$$;

COMMIT;

-- ── ROLLBACK (xoá mọi chốn, nguồn, lần đến đã lưu — CHỈ khi user đồng ý) ──────
-- Giao dịch Tài chính đã ghi qua light_place vẫn còn bên finance_transactions.
-- DROP FUNCTION IF EXISTS light_place(UUID, DATE, SMALLINT, TEXT, TEXT[], TEXT[], SMALLINT, TEXT, TEXT[], BIGINT, BOOLEAN, TEXT, TEXT, TEXT);
-- DROP TABLE IF EXISTS place_visits;
-- DROP TABLE IF EXISTS place_sources;
-- DROP TABLE IF EXISTS places;
-- DROP FUNCTION IF EXISTS places_check_refs();

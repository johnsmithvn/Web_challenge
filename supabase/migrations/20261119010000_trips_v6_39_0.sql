-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — CHỐN · CHUYẾN ĐI v6.39.0
-- Thiết kế: docs/PLAN_CHON.md §3.2. Cần places_v6_38_0.sql chạy trước.
--
-- 1. `trips`         — một chuyến đi: tên, vùng, ngày đi / về, số người, trạng thái, chốn đích (tuỳ chọn),
--                      danh sách chuẩn bị, chi phí khác, chấm điểm sau chuyến.
-- 2. `trip_options`  — các lựa chọn tour / cách đi để so sánh cạnh nhau. `pick`: NULL | 'leaning' (đang
--                      nghiêng về) | 'chosen' (đã chốt) — mỗi chuyến tối đa một cái mỗi loại.
-- 3. `trip_places`   — chốn trong chuyến, xếp theo ngày.
-- 4. `places_check_refs()` mở rộng: trips.finance_tx_id phải cùng chủ.
-- 5. RPC `choose_trip_option` — chốt một lựa chọn (+ tuỳ chọn ghi giao dịch Tài chính) trong một transaction.
--
-- Danh sách chuẩn bị: trước khi "Đẩy sang Nhiệm vụ" nằm ở `trips.prep_items` (jsonb). Đẩy rồi thì app tạo
-- việc cha "Chuẩn bị <chuyến>" + việc con bên Nhiệm vụ, lưu `prep_task_id` và xoá `prep_items` — mỗi lúc chỉ
-- có MỘT nguồn sự thật.
--
-- Additive, không xoá dữ liệu, không sửa bảng module khác. Idempotent.
-- Chạy: psql "$DATABASE_URL" -f supabase/migrations/20261119010000_trips_v6_39_0.sql
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Preflight ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION 'Trips migration refused: Postgres 15+ required. Server is %.', current_setting('server_version');
  END IF;
  IF to_regclass('public.places') IS NULL OR to_regprocedure('public.places_check_refs()') IS NULL THEN
    RAISE EXCEPTION 'Trips migration refused: run 20261119000000_places_v6_38_0.sql first.';
  END IF;
END
$$;

-- ── 1. trips ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  tagline       TEXT NOT NULL DEFAULT '' CHECK (length(tagline) <= 80),     -- "mùa tam giác mạch"
  region        TEXT NOT NULL DEFAULT '' CHECK (length(region) <= 60),      -- "Hà Giang"
  start_date    DATE,
  end_date      DATE,
  people        SMALLINT NOT NULL DEFAULT 1 CHECK (people BETWEEN 1 AND 50),
  status        TEXT NOT NULL DEFAULT 'planning'
                CHECK (status IN ('planning', 'booked', 'done', 'cancelled')),
  place_id      UUID,                                                      -- chốn đích (vd thẻ "Hà Giang loop")
  prep_items    JSONB NOT NULL DEFAULT '[]'::JSONB
                CHECK (jsonb_typeof(prep_items) = 'array' AND jsonb_array_length(prep_items) <= 60),
  prep_task_id  UUID,
  extra_costs   JSONB NOT NULL DEFAULT '[]'::JSONB
                CHECK (jsonb_typeof(extra_costs) = 'array' AND jsonb_array_length(extra_costs) <= 30),
  finance_tx_id UUID REFERENCES finance_transactions(id) ON DELETE SET NULL,
  rating        SMALLINT CHECK (rating BETWEEN 1 AND 5),
  review        TEXT NOT NULL DEFAULT '' CHECK (length(review) <= 4000),
  note          TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  archived_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trips_dates_order CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT uq_trips_id_user UNIQUE (id, user_id),
  CONSTRAINT fk_trips_place FOREIGN KEY (place_id, user_id)
    REFERENCES places (id, user_id) ON DELETE SET NULL (place_id),
  CONSTRAINT fk_trips_prep_task FOREIGN KEY (prep_task_id, user_id)
    REFERENCES user_tasks (id, user_id) ON DELETE SET NULL (prep_task_id)
);

CREATE INDEX IF NOT EXISTS idx_trips_user_active ON trips (user_id, start_date) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trips_place       ON trips (place_id) WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trips_prep_task   ON trips (prep_task_id) WHERE prep_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trips_finance_tx  ON trips (finance_tx_id) WHERE finance_tx_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_trips_updated_at ON trips;
CREATE TRIGGER trg_trips_updated_at BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE trips IS
  'Chuyến đi của Chốn. prep_items (jsonb [{id,text,done}]) là danh sách chuẩn bị TRƯỚC khi đẩy sang Nhiệm vụ; '
  'đẩy rồi thì prep_task_id trỏ việc cha (việc con = danh sách) và prep_items rỗng.';

-- ── 2. trip_options ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_options (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id          UUID NOT NULL,
  name             TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),   -- "Easy rider"
  provider         TEXT NOT NULL DEFAULT '' CHECK (length(provider) <= 120),     -- "Mây Trắng Travel · có người lái"
  price_per_person BIGINT CHECK (price_per_person >= 0),
  price_note       TEXT NOT NULL DEFAULT '' CHECK (length(price_note) <= 80),    -- "trọn gói", "chưa gồm xăng"
  schedule         TEXT NOT NULL DEFAULT '' CHECK (length(schedule) <= 120),
  schedule_note    TEXT NOT NULL DEFAULT '' CHECK (length(schedule_note) <= 120),
  includes         TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(includes) <= 30),
  excludes         TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(excludes) <= 30),
  source_url       TEXT CHECK (source_url IS NULL OR (source_url ~* '^https?://' AND length(source_url) <= 2000)),
  source_note      TEXT NOT NULL DEFAULT '' CHECK (length(source_note) <= 200),
  pros             TEXT NOT NULL DEFAULT '' CHECK (length(pros) <= 500),
  cons             TEXT NOT NULL DEFAULT '' CHECK (length(cons) <= 500),
  my_note          TEXT NOT NULL DEFAULT '' CHECK (length(my_note) <= 1000),
  pick             TEXT CHECK (pick IN ('leaning', 'chosen')),
  sort_order       INT NOT NULL DEFAULT 0,
  rating           SMALLINT CHECK (rating BETWEEN 1 AND 5),                     -- chấm sau chuyến
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_trip_options_id_user UNIQUE (id, user_id),
  CONSTRAINT fk_trip_options_trip FOREIGN KEY (trip_id, user_id)
    REFERENCES trips (id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trip_options_trip ON trip_options (trip_id, sort_order);
-- Mỗi chuyến: tối đa một lựa chọn "đang nghiêng về" và một lựa chọn "đã chốt"
CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_options_leaning ON trip_options (trip_id) WHERE pick = 'leaning';
CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_options_chosen  ON trip_options (trip_id) WHERE pick = 'chosen';

DROP TRIGGER IF EXISTS trg_trip_options_updated_at ON trip_options;
CREATE TRIGGER trg_trip_options_updated_at BEFORE UPDATE ON trip_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE trip_options IS
  'Lựa chọn tour / cách đi của một chuyến, so sánh cạnh nhau. Nhãn A/B/C suy từ sort_order. pick: leaning | chosen.';

-- ── 3. trip_places ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_places (
  trip_id    UUID NOT NULL,
  place_id   UUID NOT NULL,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_index  SMALLINT CHECK (day_index BETWEEN 1 AND 60),      -- NULL = chưa xếp ngày
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trip_id, place_id),
  CONSTRAINT fk_trip_places_trip FOREIGN KEY (trip_id, user_id)
    REFERENCES trips (id, user_id) ON DELETE CASCADE,
  CONSTRAINT fk_trip_places_place FOREIGN KEY (place_id, user_id)
    REFERENCES places (id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trip_places_place ON trip_places (place_id);

COMMENT ON TABLE trip_places IS 'Chốn trong một chuyến, theo ngày (day_index 1 = ngày đầu). FK hai phía cùng chủ.';

-- ── 4. Kiểm tham chiếu chéo module cùng chủ (thêm nhánh trips) ───────────────
-- IF lồng nhau như bản vá v6.38.1 (đọc cột không có ở bảng đang chạy → lỗi 42703); thêm nhánh trips.
CREATE OR REPLACE FUNCTION places_check_refs()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'place_sources' THEN
    IF NEW.collection_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM collections WHERE id = NEW.collection_id AND user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Bài Kiến thức không tồn tại hoặc không phải của bạn.' USING ERRCODE = 'foreign_key_violation';
    END IF;
  ELSIF TG_TABLE_NAME IN ('place_visits', 'trips') THEN
    IF NEW.finance_tx_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM finance_transactions WHERE id = NEW.finance_tx_id AND user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Giao dịch không tồn tại hoặc không phải của bạn.' USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_refs ON trips;
CREATE TRIGGER trg_trips_refs BEFORE INSERT OR UPDATE OF finance_tx_id, user_id ON trips
  FOR EACH ROW EXECUTE FUNCTION places_check_refs();

-- ── RLS + grants ─────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['trips', 'trip_options', 'trip_places'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select_own', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (user_id = auth.uid())', t || '_select_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert_own', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (user_id = auth.uid())', t || '_insert_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update_own', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t || '_update_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_delete_own', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (user_id = auth.uid())', t || '_delete_own', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, public', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO authenticated', t);
  END LOOP;
END
$$;

-- ── 5. RPC choose_trip_option ────────────────────────────────────────────────
-- SECURITY INVOKER: chạy dưới RLS của chính user. Bỏ "đã chốt" cũ + mọi "đang nghiêng về", chốt lựa chọn mới,
-- chuyến đang lên kế hoạch → đã đặt; nếu p_to_finance thì ghi một giao dịch chi (giao dịch cũ của chuyến, nếu có,
-- vẫn giữ bên Tài chính — chỉ trỏ sang giao dịch mới).
CREATE OR REPLACE FUNCTION choose_trip_option(
  p_trip_id        UUID,
  p_option_id      UUID,
  p_amount         BIGINT  DEFAULT NULL,
  p_to_finance     BOOLEAN DEFAULT FALSE,
  p_category_id    TEXT    DEFAULT NULL,
  p_subcategory_id TEXT    DEFAULT NULL,
  p_necessity      TEXT    DEFAULT NULL
)
RETURNS trips LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_title TEXT;
  v_opt   trip_options;
  v_tx_id UUID;
  v_trip  trips;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Cần đăng nhập.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT title INTO v_title FROM trips WHERE id = p_trip_id AND user_id = v_user AND archived_at IS NULL;
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy chuyến đi (có thể đã vào Thùng rác).' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO v_opt FROM trip_options WHERE id = p_option_id AND trip_id = p_trip_id AND user_id = v_user;
  IF v_opt.id IS NULL THEN
    RAISE EXCEPTION 'Lựa chọn này không thuộc chuyến đi.' USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE trip_options SET pick = NULL WHERE trip_id = p_trip_id AND pick IS NOT NULL;
  UPDATE trip_options SET pick = 'chosen' WHERE id = p_option_id;

  IF p_to_finance THEN
    IF p_amount IS NULL OR p_amount <= 0 THEN
      RAISE EXCEPTION 'Nhập số tiền lớn hơn 0 để ghi vào Tài chính.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF p_category_id IS NULL OR p_necessity IS NULL THEN
      RAISE EXCEPTION 'Thiếu danh mục Tài chính.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    INSERT INTO finance_transactions (user_id, amount, occurred_at, type, category_id, subcategory_id,
                                      necessity, merchant, note)
    VALUES (v_user, p_amount, CURRENT_DATE, 'expense', p_category_id, p_subcategory_id, p_necessity,
            left(COALESCE(NULLIF(btrim(v_opt.provider), ''), v_opt.name), 120),
            'Chuyến đi · ' || v_title || ' · ' || v_opt.name)
    RETURNING id INTO v_tx_id;
  END IF;

  UPDATE trips
     SET status = CASE WHEN status = 'planning' THEN 'booked' ELSE status END,
         finance_tx_id = COALESCE(v_tx_id, finance_tx_id)
   WHERE id = p_trip_id
  RETURNING * INTO v_trip;
  RETURN v_trip;
END;
$$;

REVOKE ALL ON FUNCTION choose_trip_option(UUID, UUID, BIGINT, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION choose_trip_option(UUID, UUID, BIGINT, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION choose_trip_option(UUID, UUID, BIGINT, BOOLEAN, TEXT, TEXT, TEXT) IS
  'Chốt một lựa chọn của chuyến đi (bỏ chốt / nghiêng về cũ), planning → booked, tuỳ chọn ghi giao dịch chi — một transaction.';

-- ── VERIFY ───────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['trips', 'trip_options', 'trip_places'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.' || t)) THEN
      RAISE EXCEPTION 'Trips migration failed: RLS is off on %.', t;
    END IF;
    IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t) <> 4 THEN
      RAISE EXCEPTION 'Trips migration failed: % must have exactly 4 policies.', t;
    END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'Trips migration failed: anon can read %.', t;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_trip_options_chosen') THEN
    RAISE EXCEPTION 'Trips migration failed: uq_trip_options_chosen is missing.';
  END IF;
  IF has_function_privilege('anon', 'choose_trip_option(uuid, uuid, bigint, boolean, text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Trips migration failed: anon can execute choose_trip_option.';
  END IF;
END
$$;

COMMIT;

-- ── ROLLBACK (xoá mọi chuyến đi đã lưu — CHỈ khi user đồng ý) ────────────────
-- Giao dịch Tài chính và việc bên Nhiệm vụ đã tạo vẫn giữ nguyên.
-- DROP FUNCTION IF EXISTS choose_trip_option(UUID, UUID, BIGINT, BOOLEAN, TEXT, TEXT, TEXT);
-- DROP TRIGGER IF EXISTS trg_trips_refs ON trips;
-- DROP TABLE IF EXISTS trip_places;
-- DROP TABLE IF EXISTS trip_options;
-- DROP TABLE IF EXISTS trips;
-- (places_check_refs() vẫn dùng cho place_sources / place_visits — không xoá.)

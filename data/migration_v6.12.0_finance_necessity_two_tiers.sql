-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: Gộp bậc necessity need + want → want (2 bậc) · v6.12.0
-- Run after migration_v6.11.0_finance_taxonomy.sql.
--
-- VÌ SAO:
--   Trước đây hệ thống có 3 bậc: must ('Phải trả'), need ('Cắt bớt được'),
--   want ('Không bắt buộc'). Ranh giới giữa 'need' và 'want' mờ nhạt — cả hai
--   đều do người dùng tự quyết định có chi hay không.
--   v6.12.0 gộp 'need' vào 'want' thành 2 bậc duy nhất:
--     - 'must' : Phải trả (bắt buộc từ bên ngoài: tiền nhà, điện nước, nợ)
--     - 'want' : Tùy chọn (do mình quyết định chi/cắt: ăn ngoài, mua sắm...)
--
-- ĐỔI DỮ LIỆU:
--   1. Gộp mọi dòng necessity = 'need' → 'want' trên:
--      - finance_transactions
--      - finance_shortcuts
--      - finance_category_overrides
--   2. Gộp trong subs JSONB của finance_category_overrides nếu có.
--
-- RÀNG BUỘC & HÀM:
--   1. CHECK constraint trên 3 bảng đổi từ ('must', 'need', 'want') → ('must', 'want').
--   2. Hàm finance_valid_subcategories kiểm tra necessity IN ('must', 'want').
--   3. RPC finance_pay_bill đổi p_necessity DEFAULT 'want' và kiểm tra IN ('must', 'want').
--
-- Idempotent: chạy lại an toàn.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Cập nhật dữ liệu cũ: need → want ──────────────────────────────────────
UPDATE finance_transactions
SET necessity = 'want'
WHERE necessity = 'need';

UPDATE finance_shortcuts
SET necessity = 'want'
WHERE necessity = 'need';

UPDATE finance_category_overrides
SET necessity = 'want'
WHERE necessity = 'need';

-- Cập nhật necessity trong mảng subs JSONB của finance_category_overrides
UPDATE finance_category_overrides
SET subs = (
  SELECT JSONB_AGG(
    CASE
      WHEN elem->>'necessity' = 'need' THEN JSONB_SET(elem, '{necessity}', '"want"'::JSONB)
      ELSE elem
    END
  )
  FROM JSONB_ARRAY_ELEMENTS(subs) AS elem
)
WHERE subs IS NOT NULL
  AND JSONB_TYPEOF(subs) = 'array'
  AND subs::TEXT LIKE '%"need"%';

-- ── 2. Đổi CHECK constraints trên các bảng ───────────────────────────────────
ALTER TABLE finance_transactions
  DROP CONSTRAINT IF EXISTS finance_transactions_necessity_check;

ALTER TABLE finance_shortcuts
  DROP CONSTRAINT IF EXISTS finance_shortcuts_necessity_check;

ALTER TABLE finance_category_overrides
  DROP CONSTRAINT IF EXISTS finance_category_overrides_necessity_check;

-- Xóa thêm bất kỳ ràng buộc check cũ nào khác liên quan đến necessity (nếu có)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conrelid::regclass::TEXT AS table_name, conname
    FROM pg_constraint
    WHERE conrelid IN (
      'finance_transactions'::regclass,
      'finance_shortcuts'::regclass,
      'finance_category_overrides'::regclass
    )
    AND contype = 'c'
    AND conname LIKE '%necessity%'
  ) LOOP
    EXECUTE FORMAT('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.table_name, r.conname);
  END LOOP;
END $$;

ALTER TABLE finance_transactions
  ADD CONSTRAINT finance_transactions_necessity_check
  CHECK (necessity IS NULL OR necessity IN ('must', 'want'));

ALTER TABLE finance_shortcuts
  ADD CONSTRAINT finance_shortcuts_necessity_check
  CHECK (necessity IS NULL OR necessity IN ('must', 'want'));

ALTER TABLE finance_category_overrides
  ADD CONSTRAINT finance_category_overrides_necessity_check
  CHECK (necessity IS NULL OR necessity IN ('must', 'want'));

-- ── 3. Cập nhật hàm validate danh mục con ────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_valid_subcategories(p_subs JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_item JSONB;
  v_keys TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF JSONB_TYPEOF(p_subs) <> 'array' THEN RETURN FALSE; END IF;
  FOR v_item IN SELECT value FROM JSONB_ARRAY_ELEMENTS(p_subs) LOOP
    IF JSONB_TYPEOF(v_item) <> 'object'
      OR BTRIM(COALESCE(v_item->>'key', '')) = ''
      OR BTRIM(COALESCE(v_item->>'label', '')) = ''
      OR COALESCE(v_item->>'necessity', 'want') NOT IN ('must', 'want')
      OR v_item->>'key' = ANY(v_keys)
    THEN RETURN FALSE; END IF;
    v_keys := ARRAY_APPEND(v_keys, v_item->>'key');
  END LOOP;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- ── 4. Cập nhật RPC finance_pay_bill ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_pay_bill(
  p_bill_id UUID,
  p_amount BIGINT DEFAULT NULL,
  p_occurred_at DATE DEFAULT CURRENT_DATE,
  p_source_card_id UUID DEFAULT NULL,
  p_task_id UUID DEFAULT NULL,
  p_necessity TEXT DEFAULT 'want',
  p_bill_period TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_bill finance_bills%ROWTYPE;
  v_amount BIGINT;
  v_period TEXT;
  v_tx_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_occurred_at IS NULL THEN RAISE EXCEPTION 'Payment date is required' USING ERRCODE = '22023'; END IF;
  IF p_necessity NOT IN ('must', 'want') THEN
    RAISE EXCEPTION 'Invalid necessity' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_bill FROM finance_bills
  WHERE id = p_bill_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT v_bill.enabled OR v_bill.finished_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bill is not active' USING ERRCODE = '23514';
  END IF;

  v_amount := COALESCE(p_amount, v_bill.amount);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'A positive bill amount is required' USING ERRCODE = '23514';
  END IF;
  v_period := COALESCE(p_bill_period, TO_CHAR(p_occurred_at, 'YYYY-MM'));
  IF v_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Invalid bill period' USING ERRCODE = '22023';
  END IF;

  INSERT INTO finance_transactions (
    user_id, amount, occurred_at, type, category_id, subcategory_id,
    source_card_id, excluded, necessity, is_fixed, note,
    bill_id, bill_period, task_id
  ) VALUES (
    v_user, v_amount, p_occurred_at, 'expense', v_bill.category_id, v_bill.subcategory_id,
    p_source_card_id, FALSE, p_necessity, TRUE, v_bill.name,
    v_bill.id, v_period, p_task_id
  ) RETURNING id INTO v_tx_id;

  UPDATE finance_bills
  SET skipped_periods = COALESCE((
    SELECT JSONB_AGG(value)
    FROM JSONB_ARRAY_ELEMENTS_TEXT(skipped_periods) item(value)
    WHERE value <> v_period
  ), '[]'::JSONB)
  WHERE id = v_bill.id;

  RETURN v_tx_id;
END;
$$;

COMMIT;

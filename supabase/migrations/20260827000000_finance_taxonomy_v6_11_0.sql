-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — TAXONOMY CHI TIÊU: shopping → personal, xóa entertainment · v6.11.0
-- Run after migration_v6.10.0_drop_inspirational_quotes.sql.
--
-- VÌ SAO: nhóm `shopping` đã đổi vai thành "Cá nhân & Giải trí" (gộp luôn phần
-- giải trí), nên khóa `shopping` đọc lên là sai nghĩa; và `entertainment` không
-- còn được dùng — mọi sub của nó đã chuyển sang `personal` (riêng
-- entertainment.party sang `food`) trong src/data/finance-categories.json.
--
-- ĐỔI DỮ LIỆU (không chỉ đổi định nghĩa):
--   category_id 'shopping'      → 'personal'   (giữ nguyên mọi thứ khác)
--   category_id 'entertainment' → 'personal'
--   trên 5 bảng: finance_transactions, finance_bills, finance_shortcuts,
--   finance_budgets, finance_category_overrides.
--
-- SUBCATEGORY_ID GIỮ NGUYÊN. `shopping.clothes`, `entertainment.game`... không
-- đổi tiền tố. Sub key là định danh bền: đổi nó là giao dịch cũ mất nhãn danh mục
-- con (subLabel trả null). Repo đã sống với chuyện tiền tố sub khác nhóm cha từ
-- v6.0.0 (housing.internet nằm trong nhóm `subscription`) — xem `_movedSubs`.
--
-- MẤT DỮ LIỆU CÓ CHỦ Ý — đọc kỹ:
--   Dòng override của nhóm `entertainment` trong finance_category_overrides bị
--   XÓA, không chuyển. Đó là phần tùy biến hình thức của một nhóm không còn tồn
--   tại: tên, màu, icon, cờ ẩn và DANH SÁCH SUB TỰ THÊM của riêng nhóm đó. Không
--   chuyển được vì UNIQUE (user_id, category_id) chỉ cho một dòng `personal` mỗi
--   user, và dòng `personal` (từ `shopping`) mới là dòng đúng. Giao dịch, hóa đơn
--   và số tiền KHÔNG mất gì — chỉ nhãn tùy biến của nhóm đã bỏ.
--   Sub tự thêm nào bạn còn muốn giữ thì thêm lại vào nhóm "Cá nhân & Giải trí"
--   ở màn Danh mục TRƯỚC khi chạy file này.
--
--   Hạn mức trong finance_budgets thì KHÔNG bỏ: nếu một user có hạn mức cho cả
--   hai nhóm, hai số được CỘNG vào một dòng `personal`.
--
-- Idempotent: chạy lại không đổi gì thêm (mọi UPDATE đều lọc theo khóa cũ).
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Tập khóa hợp lệ: 11 → 10 ───────────────────────────────────────────────
-- CREATE OR REPLACE chứ không DROP: hàm này đang bị 5 CHECK constraint phụ thuộc,
-- DROP sẽ lỗi. Postgres KHÔNG kiểm tra lại dòng cũ khi thân hàm đổi — dòng nào còn
-- mang khóa chết chỉ vỡ ở lần UPDATE kế tiếp. Bước 2 dọn hết ngay trong transaction
-- này nên không có khoảng hở đó.
CREATE OR REPLACE FUNCTION finance_valid_expense_category(p_category TEXT)
RETURNS BOOLEAN LANGUAGE SQL IMMUTABLE AS $$
  SELECT p_category = ANY(ARRAY[
    'food', 'transport', 'housing', 'personal', 'subscription', 'health',
    'family', 'social', 'finance', 'other'
  ]);
$$;

-- ── 2. Chuyển dữ liệu ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tx     BIGINT;
  v_bills  BIGINT;
  v_short  BIGINT;
  v_bud    BIGINT;
  v_merged BIGINT;
  v_ovr    BIGINT;
  v_dropped BIGINT;
BEGIN
  -- Bảng không có UNIQUE trên category_id: đổi thẳng.
  UPDATE finance_transactions SET category_id = 'personal'
   WHERE category_id IN ('shopping', 'entertainment');
  GET DIAGNOSTICS v_tx = ROW_COUNT;

  UPDATE finance_bills SET category_id = 'personal'
   WHERE category_id IN ('shopping', 'entertainment');
  GET DIAGNOSTICS v_bills = ROW_COUNT;

  UPDATE finance_shortcuts SET category_id = 'personal'
   WHERE category_id IN ('shopping', 'entertainment');
  GET DIAGNOSTICS v_short = ROW_COUNT;

  -- finance_budgets — UNIQUE (user_id, category_id).
  -- `shopping` đi trước vì nó là dòng sẽ sống tiếp.
  UPDATE finance_budgets SET category_id = 'personal', updated_at = NOW()
   WHERE category_id = 'shopping';
  GET DIAGNOSTICS v_bud = ROW_COUNT;

  -- User có hạn mức cho cả hai nhóm: cộng vào dòng personal rồi bỏ dòng thừa.
  -- Bỏ thẳng sẽ làm hạn mức tháng tụt đi một khoản mà không ai thấy.
  UPDATE finance_budgets b
     SET limit_amount = b.limit_amount + e.limit_amount, updated_at = NOW()
    FROM finance_budgets e
   WHERE e.user_id = b.user_id
     AND e.category_id = 'entertainment'
     AND b.category_id = 'personal';

  DELETE FROM finance_budgets e
   WHERE e.category_id = 'entertainment'
     AND EXISTS (SELECT 1 FROM finance_budgets p
                  WHERE p.user_id = e.user_id AND p.category_id = 'personal');
  GET DIAGNOSTICS v_merged = ROW_COUNT;

  -- Còn lại là user chỉ có hạn mức entertainment → đổi khóa là xong.
  UPDATE finance_budgets SET category_id = 'personal', updated_at = NOW()
   WHERE category_id = 'entertainment';

  -- finance_category_overrides — UNIQUE (user_id, category_id).
  UPDATE finance_category_overrides SET category_id = 'personal', updated_at = NOW()
   WHERE category_id = 'shopping' AND kind = 'expense';
  GET DIAGNOSTICS v_ovr = ROW_COUNT;

  -- Override của nhóm đã bỏ: xóa (xem phần MẤT DỮ LIỆU ở đầu file).
  DELETE FROM finance_category_overrides WHERE category_id = 'entertainment';
  GET DIAGNOSTICS v_dropped = ROW_COUNT;

  RAISE NOTICE 'transactions: % · bills: % · shortcuts: % · budgets đổi khóa: % (gộp % dòng) · override đổi khóa: % · override entertainment đã xóa: %',
    v_tx, v_bills, v_short, v_bud, v_merged, v_ovr, v_dropped;
END
$$;

-- ── 3. Verify — không còn khóa chết ở đâu ─────────────────────────────────────
DO $$
DECLARE
  v_left BIGINT;
BEGIN
  SELECT
      (SELECT COUNT(*) FROM finance_transactions       WHERE category_id IN ('shopping', 'entertainment'))
    + (SELECT COUNT(*) FROM finance_bills              WHERE category_id IN ('shopping', 'entertainment'))
    + (SELECT COUNT(*) FROM finance_shortcuts          WHERE category_id IN ('shopping', 'entertainment'))
    + (SELECT COUNT(*) FROM finance_budgets            WHERE category_id IN ('shopping', 'entertainment'))
    + (SELECT COUNT(*) FROM finance_category_overrides WHERE category_id IN ('shopping', 'entertainment'))
  INTO v_left;

  IF v_left > 0 THEN
    RAISE EXCEPTION 'Migration failed: còn % dòng mang khóa shopping/entertainment.', v_left;
  END IF;

  IF finance_valid_expense_category('shopping') OR finance_valid_expense_category('entertainment') THEN
    RAISE EXCEPTION 'Migration failed: hàm validate vẫn nhận khóa đã bỏ.';
  END IF;
  IF NOT finance_valid_expense_category('personal') THEN
    RAISE EXCEPTION 'Migration failed: hàm validate không nhận khóa personal.';
  END IF;
END
$$;

COMMIT;

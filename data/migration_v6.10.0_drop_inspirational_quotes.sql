-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — DROP BẢNG inspirational_quotes v6.10.0
-- Run after migration_v6.9.0_finance_rule_detach.sql.
--
-- VÌ SAO XÓA: bảng này chưa bao giờ được đọc. `QuoteWidget` lấy quote từ
-- `src/data/quotes.json` (pool hệ thống) và từ item Knowledge `type='quote'`;
-- tab Quotes trong Cài Đặt CRUD vào đây rồi không hiện ra ở đâu cả. Tab đó đã bị
-- xóa ở v6.9.0 cùng `useQuotes.js`, nên từ đó tới giờ không còn một dòng code nào
-- chạm tới bảng. Không có view, FK hay trigger nào trỏ vào nó (chỉ có index của
-- chính nó và FK user_id trỏ RA auth.users).
--
-- FAIL-CLOSED: nếu bảng còn dù chỉ MỘT dòng thì migration TỪ CHỐI chạy, không
-- xóa gì. Quote đã gõ vào đó là nội dung người dùng viết ra — mất là mất thật,
-- và không có cách nào lấy lại. Muốn giữ thì chuyển sang Knowledge (item
-- `type='quote'`) trước, rồi chạy lại file này.
--
-- Idempotent: bảng đã biến mất thì chạy lại không lỗi, chỉ báo NOTICE.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_rows BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'inspirational_quotes') THEN
    RAISE NOTICE 'inspirational_quotes không tồn tại — đã drop trước đó, không cần làm gì.';
    RETURN;
  END IF;

  EXECUTE 'SELECT COUNT(*) FROM public.inspirational_quotes' INTO v_rows;
  IF v_rows > 0 THEN
    RAISE EXCEPTION
      'Refused: inspirational_quotes còn % dòng. Chuyển chúng sang Knowledge (item type=quote) trước rồi chạy lại.',
      v_rows;
  END IF;

  -- Không CASCADE: nếu có thứ gì đó phụ thuộc mà tôi chưa biết, thà để lệnh này
  -- lỗi còn hơn im lặng kéo theo một object khác xuống.
  DROP TABLE public.inspirational_quotes;
  RAISE NOTICE 'Đã drop inspirational_quotes (0 dòng).';
END
$$;

-- Verify: bảng phải không còn tồn tại sau khi COMMIT.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'inspirational_quotes') THEN
    RAISE EXCEPTION 'Drop migration failed: inspirational_quotes vẫn còn.';
  END IF;
END
$$;

COMMIT;

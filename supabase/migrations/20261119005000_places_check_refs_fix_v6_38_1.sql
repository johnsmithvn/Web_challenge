-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — CHỐN v6.38.1: vá trigger places_check_refs
--
-- Lỗi (v6.38.0): hàm viết `IF TG_TđểABLE_NAME = 'place_sources' AND NEW.collection_id … ELSIF TG_TABLE_NAME =
-- 'place_visits' AND NEW.finance_tx_id …`. PL/pgSQL chuẩn bị cả biểu thức, nên khi trigger chạy trên
-- place_sources nó vẫn đọc NEW.finance_tx_id (bảng không có cột này) → lỗi 42703 "record new has no field",
-- PostgREST trả 400: lưu chốn có lời giới thiệu thất bại, thắp đèn cũng thất bại tương tự.
-- Sửa: IF lồng nhau — chỉ đọc cột của đúng bảng đang chạy.
--
-- Chỉ thay thân hàm, không đổi bảng / dữ liệu. Idempotent.
-- Chạy: psql "$DATABASE_URL" -f supabase/migrations/20261119005000_places_check_refs_fix_v6_38_1.sql
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.places_check_refs()') IS NULL THEN
    RAISE EXCEPTION 'Fix refused: places_check_refs() is missing. Run 20261119000000_places_v6_38_0.sql first.';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION places_check_refs()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'place_sources' THEN
    IF NEW.collection_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM collections WHERE id = NEW.collection_id AND user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Bài Kiến thức không tồn tại hoặc không phải của bạn.' USING ERRCODE = 'foreign_key_violation';
    END IF;
  ELSIF TG_TABLE_NAME = 'place_visits' THEN
    IF NEW.finance_tx_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM finance_transactions WHERE id = NEW.finance_tx_id AND user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Giao dịch không tồn tại hoặc không phải của bạn.' USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

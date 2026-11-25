-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — FINANCE: TRẢ TRƯỚC DƯ NỢ THẺ (KỲ CHƯA CHỐT) v6.40.0
-- Run after 20260808000000_finance_v6_0_0.sql.
--
-- VẤN ĐỀ: màn Thẻ tín dụng có nút "Trả sớm dư nợ" khi sao kê vừa chốt đã trả hết mà
-- thẻ vẫn còn tiền quẹt của kỳ mới. RPC `finance_pay_card_statement` v6.0.0 từ chối
-- mọi khoản trả cho kỳ chưa chốt ("Cannot pay a statement before it closes"), còn gắn
-- vào kỳ vừa chốt thì báo "already paid" → không có cách nào ghi trả sớm.
--
-- SỬA: cho trả trước ĐÚNG MỘT kỳ — kỳ kế tiếp đang mở (ngày chốt kỳ trước ≤ ngày trả <
-- ngày chốt kỳ này). Số trả vẫn bị chặn bởi tiền đã quẹt trong kỳ đó trừ số đã trả cho
-- kỳ đó, nên tới ngày chốt sao kê khoản trả trước được trừ đúng chỗ. Trả trước hai kỳ
-- trở lên vẫn bị chặn.
--
-- Chỉ thay thân hàm (CREATE OR REPLACE, cùng chữ ký) — quyền GRANT/REVOKE giữ nguyên.
-- Không đụng bảng hay dữ liệu. Idempotent: chạy lại nhiều lần không hỏng gì.
-- Rollback: chạy lại định nghĩa hàm trong 20260808000000_finance_v6_0_0.sql.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Preflight ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('finance_pay_card_statement(uuid, bigint, date, text, uuid)') IS NULL THEN
    RAISE EXCEPTION
      'Card prepay migration refused: finance_pay_card_statement is missing. Run the v6.0.0 finance migration first.';
  END IF;
  IF to_regprocedure('finance_cycle_statement_date(text, integer)') IS NULL THEN
    RAISE EXCEPTION
      'Card prepay migration refused: finance_cycle_statement_date is missing. Run the v6.0.0 finance migration first.';
  END IF;
END
$$;

-- ── 1. RPC trả sao kê: nhận trả trước cho kỳ kế tiếp ─────────────────────────
CREATE OR REPLACE FUNCTION finance_pay_card_statement(
  p_card_id UUID,
  p_amount BIGINT DEFAULT NULL,
  p_occurred_at DATE DEFAULT CURRENT_DATE,
  p_card_period TEXT DEFAULT NULL,
  p_task_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_card finance_cards%ROWTYPE;
  v_period TEXT;
  v_statement DATE;
  v_previous_statement DATE;
  v_statement_total BIGINT;
  v_paid BIGINT;
  v_outstanding BIGINT;
  v_amount BIGINT;
  v_tx_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_occurred_at IS NULL THEN RAISE EXCEPTION 'Payment date is required' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_card FROM finance_cards
  WHERE id = p_card_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card not found' USING ERRCODE = 'P0002'; END IF;
  IF v_card.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Card is closed' USING ERRCODE = '23514'; END IF;

  v_period := COALESCE(p_card_period, TO_CHAR(p_occurred_at, 'YYYY-MM'));
  v_statement := finance_cycle_statement_date(v_period, v_card.statement_day);
  IF p_card_period IS NULL AND v_statement > p_occurred_at THEN
    v_period := TO_CHAR(v_statement - INTERVAL '1 month', 'YYYY-MM');
    v_statement := finance_cycle_statement_date(v_period, v_card.statement_day);
  END IF;
  v_previous_statement := finance_cycle_statement_date(
    TO_CHAR(v_statement - INTERVAL '1 month', 'YYYY-MM'), v_card.statement_day
  );
  -- Kỳ chưa chốt (v_statement > ngày trả) vẫn trả trước được, nhưng chỉ kỳ đang mở:
  -- kỳ trước nó phải chốt rồi. Xa hơn nữa là ghi nhầm kỳ.
  IF v_previous_statement > p_occurred_at THEN
    RAISE EXCEPTION 'Cannot prepay more than the next open statement' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM(amount), 0)::BIGINT INTO v_statement_total
  FROM finance_transactions
  WHERE user_id = v_user AND source_card_id = v_card.id
    AND type = 'expense' AND excluded = FALSE
    AND occurred_at > v_previous_statement AND occurred_at <= v_statement;

  SELECT COALESCE(SUM(amount), 0)::BIGINT INTO v_paid
  FROM finance_transactions
  WHERE user_id = v_user AND card_id = v_card.id AND card_period = v_period;

  v_outstanding := GREATEST(0, v_statement_total - v_paid);
  v_amount := COALESCE(p_amount, v_outstanding);
  IF v_outstanding <= 0 THEN RAISE EXCEPTION 'Card statement is already paid' USING ERRCODE = '23514'; END IF;
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > v_outstanding THEN
    RAISE EXCEPTION 'Card payment must be positive and not exceed the outstanding statement'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO finance_transactions (
    user_id, amount, occurred_at, type, category_id, subcategory_id,
    excluded, note, card_id, card_period, task_id
  ) VALUES (
    v_user, v_amount, p_occurred_at, 'expense', 'finance', 'finance.card', TRUE,
    'Tra sao ke ' || v_card.name, v_card.id, v_period, p_task_id
  ) RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- ── VERIFY ───────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_src TEXT;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc
  WHERE oid = to_regprocedure('finance_pay_card_statement(uuid, bigint, date, text, uuid)');
  IF v_src IS NULL OR v_src LIKE '%Cannot pay a statement before it closes%'
     OR v_src NOT LIKE '%Cannot prepay more than the next open statement%' THEN
    RAISE EXCEPTION 'Card prepay migration failed: finance_pay_card_statement was not replaced.';
  END IF;
  IF NOT has_function_privilege('authenticated',
       'finance_pay_card_statement(uuid, bigint, date, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Card prepay migration failed: authenticated lost EXECUTE on finance_pay_card_statement.';
  END IF;
END
$$;

COMMIT;

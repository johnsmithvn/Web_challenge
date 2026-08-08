-- Finance v6.0.0 - clean rebuild from the approved handoff.
--
-- DESTRUCTIVE BY DESIGN:
--   This migration removes the legacy expense module and every existing
--   finance_* table before rebuilding them. The user explicitly approved
--   discarding old Finance data on 2026-08-08.
--
-- Contract enforced here:
--   1. Reports are recomputed from finance_transactions.occurred_at.
--   2. Income and savings never become an implicit account balance.
--   3. Paying a rule creates linked transaction rows; the app never auto-pays.
--   4. Loan principal and credit-card statement payments are excluded from spend.
--   5. Bill, income, loan, card, and saving actions are atomic RPC operations.
--   6. Every Finance row is owner-isolated with RLS, including linked records.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Clean reset
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS tagged_items;

DROP FUNCTION IF EXISTS finance_pay_bill(UUID, BIGINT, DATE, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS finance_pay_bill(UUID, BIGINT, DATE, UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS finance_skip_bill_period(UUID, TEXT);
DROP FUNCTION IF EXISTS finance_receive_income(UUID, BIGINT, DATE, UUID);
DROP FUNCTION IF EXISTS finance_receive_income(UUID, BIGINT, DATE, UUID, TEXT);
DROP FUNCTION IF EXISTS finance_record_loan_payment(UUID, BIGINT, BIGINT, DATE, UUID);
DROP FUNCTION IF EXISTS finance_record_loan_payment(UUID, BIGINT, BIGINT, DATE, UUID, TEXT);
DROP FUNCTION IF EXISTS finance_pay_card_statement(UUID, BIGINT, DATE, TEXT, UUID);
DROP FUNCTION IF EXISTS finance_request_saving_withdrawal(UUID, UUID, BIGINT);
DROP FUNCTION IF EXISTS finance_move_saving(UUID, UUID, TEXT, BIGINT, DATE, TEXT, UUID);
DROP FUNCTION IF EXISTS finance_sync_transaction_rule_progress() CASCADE;
DROP FUNCTION IF EXISTS finance_refresh_bill_progress(UUID);
DROP FUNCTION IF EXISTS finance_refresh_income_progress(UUID);
DROP FUNCTION IF EXISTS finance_refresh_loan_progress(UUID);
DROP FUNCTION IF EXISTS finance_validate_transaction_references() CASCADE;
DROP FUNCTION IF EXISTS finance_validate_shortcut_reference() CASCADE;
DROP FUNCTION IF EXISTS finance_cycle_statement_date(TEXT, INT);
DROP FUNCTION IF EXISTS finance_valid_rrule(JSONB);
DROP FUNCTION IF EXISTS finance_valid_expense_category(TEXT);
DROP FUNCTION IF EXISTS finance_valid_income_category(TEXT);
DROP FUNCTION IF EXISTS finance_valid_category_color(TEXT);
DROP FUNCTION IF EXISTS finance_valid_subcategories(JSONB);
DROP FUNCTION IF EXISTS finance_valid_auto_deposit(JSONB);
DROP FUNCTION IF EXISTS finance_valid_withdrawal_request(JSONB);

DROP TABLE IF EXISTS finance_transaction_tags CASCADE;
DROP TABLE IF EXISTS finance_transactions CASCADE;
DROP TABLE IF EXISTS finance_category_overrides CASCADE;
DROP TABLE IF EXISTS finance_budgets CASCADE;
DROP TABLE IF EXISTS finance_shortcuts CASCADE;
DROP TABLE IF EXISTS finance_income_rules CASCADE;
DROP TABLE IF EXISTS finance_deposits CASCADE;
DROP TABLE IF EXISTS finance_saving_goals CASCADE;
DROP TABLE IF EXISTS finance_loans CASCADE;
DROP TABLE IF EXISTS finance_bills CASCADE;
DROP TABLE IF EXISTS finance_cards CASCADE;

DROP TABLE IF EXISTS expense_tags CASCADE;
DROP TABLE IF EXISTS subscription_tags CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;

-- Same recurrence shape already used by user_tasks.recurrence_rule.
CREATE FUNCTION finance_valid_rrule(p_rule JSONB)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT COALESCE(
    CASE p_rule->>'type'
      WHEN 'interval' THEN CASE
        WHEN p_rule->>'days' ~ '^[0-9]+$' THEN (p_rule->>'days')::INT > 0
        ELSE FALSE
      END
      WHEN 'weekly' THEN CASE
        WHEN p_rule->>'weekday' ~ '^[0-6]$' THEN TRUE
        ELSE FALSE
      END
      WHEN 'monthly' THEN CASE
        WHEN p_rule->>'day' ~ '^[0-9]+$'
          THEN (p_rule->>'day')::INT BETWEEN 1 AND 31
        ELSE FALSE
      END
      ELSE FALSE
    END,
    FALSE
  );
$$;

CREATE FUNCTION finance_valid_expense_category(p_category TEXT)
RETURNS BOOLEAN LANGUAGE SQL IMMUTABLE AS $$
  SELECT p_category = ANY(ARRAY[
    'food', 'transport', 'housing', 'shopping', 'subscription', 'health',
    'entertainment', 'family', 'social', 'finance', 'other'
  ]);
$$;

CREATE FUNCTION finance_valid_income_category(p_category TEXT)
RETURNS BOOLEAN LANGUAGE SQL IMMUTABLE AS $$
  SELECT p_category = ANY(ARRAY['luong', 'thuong', 'ngoai', 'dautu', 'banha', 'duoctang', 'hoantien']);
$$;

CREATE FUNCTION finance_valid_category_color(p_color TEXT)
RETURNS BOOLEAN LANGUAGE SQL IMMUTABLE AS $$
  SELECT p_color = ANY(ARRAY[
    '#e2a94e', '#5aa3dd', '#48b3a2', '#e07f93', '#b47fd8', '#7fc060',
    '#e58159', '#6fd0c6', '#dd76bd', '#9184d9', '#8b91a6'
  ]);
$$;

CREATE FUNCTION finance_valid_subcategories(p_subs JSONB)
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
      OR COALESCE(v_item->>'necessity', 'need') NOT IN ('must', 'need', 'want')
      OR v_item->>'key' = ANY(v_keys)
    THEN RETURN FALSE; END IF;
    v_keys := ARRAY_APPEND(v_keys, v_item->>'key');
  END LOOP;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

CREATE FUNCTION finance_valid_auto_deposit(p_plan JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN JSONB_TYPEOF(p_plan) = 'object'
    AND JSONB_TYPEOF(p_plan->'amount') = 'number'
    AND p_plan->>'amount' ~ '^[1-9][0-9]*$'
    AND (p_plan->>'amount')::BIGINT > 0
    AND JSONB_TYPEOF(p_plan->'day') = 'number'
    AND p_plan->>'day' ~ '^[0-9]+$'
    AND (p_plan->>'day')::INT BETWEEN 1 AND 31;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

CREATE FUNCTION finance_valid_withdrawal_request(p_request JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN JSONB_TYPEOF(p_request) = 'object'
    AND COALESCE(p_request->>'deposit_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND JSONB_TYPEOF(p_request->'amount') = 'number'
    AND p_request->>'amount' ~ '^[1-9][0-9]*$'
    AND (p_request->>'amount')::BIGINT > 0
    AND BTRIM(COALESCE(p_request->>'requested_at', '')) <> ''
    AND BTRIM(COALESCE(p_request->>'available_at', '')) <> '';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Rule and reference tables
-- ---------------------------------------------------------------------------
CREATE TABLE finance_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  bank TEXT,
  last4 TEXT CHECK (last4 IS NULL OR last4 ~ '^[0-9]{4}$'),
  credit_limit BIGINT NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  statement_day INT NOT NULL CHECK (statement_day BETWEEN 1 AND 31),
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  grace INT CHECK (grace IS NULL OR grace >= 0),
  annual_fee BIGINT NOT NULL DEFAULT 0 CHECK (annual_fee >= 0),
  cash_advance_fee BIGINT NOT NULL DEFAULT 0 CHECK (cash_advance_fee >= 0),
  min_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (min_pct BETWEEN 0 AND 100),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE finance_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  provider TEXT,
  customer_code TEXT,
  category_id TEXT NOT NULL CHECK (finance_valid_expense_category(category_id)),
  subcategory_id TEXT NOT NULL CHECK (BTRIM(subcategory_id) <> ''),
  rrule JSONB NOT NULL CHECK (finance_valid_rrule(rrule)),
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  amount_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (amount_mode IN ('fixed', 'ask')),
  amount BIGINT,
  term_total INT CHECK (term_total IS NULL OR term_total > 0),
  term_done INT NOT NULL DEFAULT 0 CHECK (term_done >= 0),
  skipped_periods JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (JSONB_TYPEOF(skipped_periods) = 'array'),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (amount_mode = 'fixed' AND amount IS NOT NULL AND amount > 0)
    OR (amount_mode = 'ask' AND amount IS NULL)
  ),
  CHECK (term_total IS NULL OR term_done <= term_total)
);

CREATE TABLE finance_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  lender TEXT,
  principal BIGINT NOT NULL CHECK (principal > 0),
  rate NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  kind TEXT NOT NULL DEFAULT 'amort' CHECK (kind IN ('interest', 'amort')),
  term INT NOT NULL CHECK (term > 0),
  done INT NOT NULL DEFAULT 0 CHECK (done >= 0),
  pay_day INT NOT NULL CHECK (pay_day BETWEEN 1 AND 31),
  opened_at DATE NOT NULL DEFAULT CURRENT_DATE,
  due_at DATE,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (done <= term),
  CHECK (due_at IS NULL OR due_at >= opened_at)
);

CREATE TABLE finance_saving_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  goal BIGINT NOT NULL DEFAULT 0 CHECK (goal >= 0),
  lock_mode TEXT NOT NULL DEFAULT 'soft' CHECK (lock_mode IN ('soft', 'term', 'external')),
  lock_until DATE,
  in_wallet BOOLEAN NOT NULL DEFAULT TRUE,
  auto_deposit JSONB CHECK (auto_deposit IS NULL OR finance_valid_auto_deposit(auto_deposit)),
  withdrawal_request JSONB
    CHECK (withdrawal_request IS NULL OR finance_valid_withdrawal_request(withdrawal_request)),
  break_count INT NOT NULL DEFAULT 0 CHECK (break_count >= 0),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, user_id),
  CHECK ((lock_mode = 'term' AND lock_until IS NOT NULL) OR (lock_mode <> 'term' AND lock_until IS NULL))
);

CREATE TABLE finance_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fund_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  bank TEXT,
  account_no TEXT,
  amount BIGINT NOT NULL DEFAULT 0 CHECK (amount >= 0),
  rate NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  term INT CHECK (term IS NULL OR term > 0),
  opened_at DATE,
  matures_at DATE GENERATED ALWAYS AS (
    CASE WHEN term IS NULL OR opened_at IS NULL THEN NULL
      ELSE (opened_at + MAKE_INTERVAL(months => term))::DATE END
  ) STORED,
  closed_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (fund_id, user_id)
    REFERENCES finance_saving_goals(id, user_id) ON DELETE CASCADE,
  CHECK (term IS NULL OR opened_at IS NOT NULL),
  CHECK (closed_on IS NULL OR opened_at IS NULL OR closed_on >= opened_at)
);

CREATE TABLE finance_income_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  source TEXT,
  category_id TEXT NOT NULL DEFAULT 'luong' CHECK (finance_valid_income_category(category_id)),
  rrule JSONB NOT NULL CHECK (finance_valid_rrule(rrule)),
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  amount BIGINT NOT NULL CHECK (amount > 0),
  received_periods JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (JSONB_TYPEOF(received_periods) = 'array'),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE finance_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  category_id TEXT NOT NULL CHECK (finance_valid_expense_category(category_id)),
  subcategory_id TEXT NOT NULL CHECK (BTRIM(subcategory_id) <> ''),
  necessity TEXT CHECK (necessity IN ('must', 'need', 'want')),
  recent_amounts JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (JSONB_TYPEOF(recent_amounts) = 'array'),
  use_count INT NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  source_card_id UUID REFERENCES finance_cards(id) ON DELETE RESTRICT,
  sort_order INT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE finance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL CHECK (finance_valid_expense_category(category_id)),
  limit_amount BIGINT NOT NULL DEFAULT 0 CHECK (limit_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id)
);

-- Parent groups are closed by the handoff. Users can rename, recolor, hide, and
-- edit child rows, but cannot create a new parent category.
CREATE TABLE finance_category_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  label TEXT,
  color TEXT CHECK (color IS NULL OR finance_valid_category_color(color)),
  icon TEXT,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  necessity TEXT CHECK (necessity IN ('must', 'need', 'want')),
  nature TEXT CHECK (nature IN ('fixed', 'variable')),
  subs JSONB CHECK (subs IS NULL OR finance_valid_subcategories(subs)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id),
  CHECK (
    (kind = 'expense' AND finance_valid_expense_category(category_id))
    OR
    (kind = 'income' AND finance_valid_income_category(category_id))
  )
);

-- ---------------------------------------------------------------------------
-- 2. Single transaction ledger
-- ---------------------------------------------------------------------------
CREATE TABLE finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income', 'saving')),
  category_id TEXT,
  subcategory_id TEXT,
  source_card_id UUID REFERENCES finance_cards(id) ON DELETE RESTRICT,
  source_kind TEXT GENERATED ALWAYS AS (
    CASE WHEN source_card_id IS NULL THEN 'cash' ELSE 'card' END
  ) STORED,
  excluded BOOLEAN NOT NULL DEFAULT FALSE,
  necessity TEXT CHECK (necessity IN ('must', 'need', 'want')),
  is_fixed BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  merchant TEXT,
  items JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (JSONB_TYPEOF(items) = 'array'),
  attachments JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (JSONB_TYPEOF(attachments) = 'array'),
  shortcut_id UUID REFERENCES finance_shortcuts(id) ON DELETE SET NULL,
  bill_id UUID REFERENCES finance_bills(id) ON DELETE RESTRICT,
  bill_period TEXT,
  income_rule_id UUID REFERENCES finance_income_rules(id) ON DELETE RESTRICT,
  income_period TEXT,
  loan_id UUID REFERENCES finance_loans(id) ON DELETE RESTRICT,
  loan_period TEXT,
  loan_part TEXT CHECK (loan_part IN ('interest', 'principal')),
  card_id UUID REFERENCES finance_cards(id) ON DELETE RESTRICT,
  card_period TEXT,
  saving_goal_id UUID REFERENCES finance_saving_goals(id) ON DELETE RESTRICT,
  saving_dir TEXT CHECK (saving_dir IN ('in', 'out')),
  inbox_item_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  task_id UUID REFERENCES user_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK ((bill_id IS NULL AND bill_period IS NULL) OR
         (bill_id IS NOT NULL AND bill_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')),
  CHECK ((income_rule_id IS NULL AND income_period IS NULL) OR
         (income_rule_id IS NOT NULL AND income_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')),
  CHECK ((loan_id IS NULL AND loan_period IS NULL AND loan_part IS NULL) OR
         (loan_id IS NOT NULL AND loan_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
          AND loan_part IS NOT NULL)),
  CHECK ((card_id IS NULL AND card_period IS NULL) OR
         (card_id IS NOT NULL AND card_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')),
  CHECK ((saving_goal_id IS NULL AND saving_dir IS NULL) OR
         (saving_goal_id IS NOT NULL AND saving_dir IS NOT NULL)),
  CHECK (NUM_NONNULLS(bill_id, income_rule_id, loan_id, card_id, saving_goal_id) <= 1),
  CHECK (
    (type = 'saving' AND category_id IS NULL AND subcategory_id IS NULL)
    OR (type = 'expense' AND category_id IS NOT NULL AND finance_valid_expense_category(category_id))
    OR (type = 'income' AND category_id IS NOT NULL AND finance_valid_income_category(category_id))
  ),

  CHECK (
    (type = 'saving' AND saving_goal_id IS NOT NULL
      AND bill_id IS NULL AND income_rule_id IS NULL AND loan_id IS NULL AND card_id IS NULL
      AND source_card_id IS NULL AND necessity IS NULL AND excluded = FALSE)
    OR
    (type = 'income' AND saving_goal_id IS NULL AND bill_id IS NULL AND loan_id IS NULL
      AND card_id IS NULL AND source_card_id IS NULL AND necessity IS NULL AND excluded = FALSE)
    OR
    (type = 'expense' AND saving_goal_id IS NULL AND income_rule_id IS NULL
      AND (excluded = TRUE OR necessity IS NOT NULL))
  ),
  CHECK (source_card_id IS NULL OR (type = 'expense' AND excluded = FALSE AND card_id IS NULL)),
  CHECK (
    excluded = FALSE
    OR (loan_id IS NOT NULL AND loan_part = 'principal')
    OR (card_id IS NOT NULL AND card_period IS NOT NULL)
  ),
  CHECK (loan_part IS DISTINCT FROM 'interest' OR excluded = FALSE),
  CHECK (loan_part IS DISTINCT FROM 'principal' OR excluded = TRUE)
);

CREATE TABLE finance_transaction_tags (
  transaction_id UUID NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- 3. Indexes and update timestamps
-- ---------------------------------------------------------------------------
CREATE INDEX idx_finance_cards_user ON finance_cards(user_id, closed_at);
CREATE INDEX idx_finance_bills_user ON finance_bills(user_id, enabled, finished_at);
CREATE INDEX idx_finance_loans_user ON finance_loans(user_id, closed_at);
CREATE INDEX idx_finance_goals_user ON finance_saving_goals(user_id, closed_at);
CREATE INDEX idx_finance_deposits_user_fund ON finance_deposits(user_id, fund_id);
CREATE INDEX idx_finance_income_rules_user ON finance_income_rules(user_id, enabled);
CREATE INDEX idx_finance_shortcuts_user ON finance_shortcuts(user_id, sort_order);
CREATE INDEX idx_finance_category_overrides_user ON finance_category_overrides(user_id, kind);
CREATE INDEX idx_finance_tx_user_date ON finance_transactions(user_id, occurred_at DESC, created_at DESC);
CREATE INDEX idx_finance_tx_task ON finance_transactions(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_finance_tx_inbox ON finance_transactions(inbox_item_id) WHERE inbox_item_id IS NOT NULL;
CREATE INDEX idx_finance_tx_bill ON finance_transactions(bill_id, bill_period) WHERE bill_id IS NOT NULL;
CREATE INDEX idx_finance_tx_income ON finance_transactions(income_rule_id, income_period) WHERE income_rule_id IS NOT NULL;
CREATE INDEX idx_finance_tx_loan ON finance_transactions(loan_id, loan_period) WHERE loan_id IS NOT NULL;
CREATE INDEX idx_finance_tx_card_source ON finance_transactions(source_card_id, occurred_at) WHERE source_card_id IS NOT NULL;
CREATE INDEX idx_finance_tx_card_payment ON finance_transactions(card_id, card_period) WHERE card_id IS NOT NULL;
CREATE INDEX idx_finance_tx_saving ON finance_transactions(saving_goal_id, occurred_at) WHERE saving_goal_id IS NOT NULL;
CREATE INDEX idx_finance_tx_tags_tag ON finance_transaction_tags(tag_id);

CREATE UNIQUE INDEX unique_finance_tx_bill_period
  ON finance_transactions(bill_id, bill_period)
  WHERE bill_id IS NOT NULL;
CREATE UNIQUE INDEX unique_finance_tx_income_period
  ON finance_transactions(income_rule_id, income_period)
  WHERE income_rule_id IS NOT NULL;
CREATE UNIQUE INDEX unique_finance_tx_loan_part_period
  ON finance_transactions(loan_id, loan_period, loan_part)
  WHERE loan_id IS NOT NULL;

CREATE TRIGGER finance_cards_updated_at BEFORE UPDATE ON finance_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER finance_bills_updated_at BEFORE UPDATE ON finance_bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER finance_loans_updated_at BEFORE UPDATE ON finance_loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER finance_goals_updated_at BEFORE UPDATE ON finance_saving_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER finance_deposits_updated_at BEFORE UPDATE ON finance_deposits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER finance_income_rules_updated_at BEFORE UPDATE ON finance_income_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER finance_shortcuts_updated_at BEFORE UPDATE ON finance_shortcuts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER finance_budgets_updated_at BEFORE UPDATE ON finance_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER finance_category_overrides_updated_at BEFORE UPDATE ON finance_category_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER finance_transactions_updated_at BEFORE UPDATE ON finance_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Ownership checks for links not expressible as composite foreign keys
-- ---------------------------------------------------------------------------
CREATE FUNCTION finance_validate_shortcut_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_card_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_cards c
    WHERE c.id = NEW.source_card_id AND c.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Finance card does not belong to this user'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER finance_shortcut_reference_guard
BEFORE INSERT OR UPDATE ON finance_shortcuts
FOR EACH ROW EXECUTE FUNCTION finance_validate_shortcut_reference();

CREATE FUNCTION finance_validate_transaction_references()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_card_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_cards WHERE id = NEW.source_card_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Source card does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.card_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_cards WHERE id = NEW.card_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Statement card does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.bill_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_bills WHERE id = NEW.bill_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Bill does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.income_rule_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_income_rules WHERE id = NEW.income_rule_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Income rule does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.loan_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_loans WHERE id = NEW.loan_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Loan does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.saving_goal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_saving_goals WHERE id = NEW.saving_goal_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Saving goal does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.shortcut_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_shortcuts WHERE id = NEW.shortcut_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Shortcut does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.task_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_tasks WHERE id = NEW.task_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Task does not belong to this user' USING ERRCODE = '23503'; END IF;

  IF NEW.inbox_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM collections WHERE id = NEW.inbox_item_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'Inbox item does not belong to this user' USING ERRCODE = '23503'; END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER finance_transaction_reference_guard
BEFORE INSERT OR UPDATE ON finance_transactions
FOR EACH ROW EXECUTE FUNCTION finance_validate_transaction_references();

-- ---------------------------------------------------------------------------
-- 5. Rule progress is derived from linked transactions
-- ---------------------------------------------------------------------------
CREATE FUNCTION finance_refresh_bill_progress(p_bill_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF p_bill_id IS NULL THEN RETURN; END IF;
  SELECT COUNT(*)::INT INTO v_count
  FROM finance_transactions WHERE bill_id = p_bill_id;

  UPDATE finance_bills
  SET term_done = LEAST(COALESCE(term_total, v_count), v_count),
      finished_at = CASE
        WHEN finished_at IS NOT NULL THEN finished_at
        WHEN term_total IS NOT NULL AND v_count >= term_total THEN NOW()
        ELSE NULL
      END
  WHERE id = p_bill_id;
END;
$$;

CREATE FUNCTION finance_refresh_income_progress(p_rule_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_periods JSONB;
BEGIN
  IF p_rule_id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(JSONB_AGG(period ORDER BY period), '[]'::JSONB)
  INTO v_periods
  FROM (
    SELECT DISTINCT income_period AS period
    FROM finance_transactions
    WHERE income_rule_id = p_rule_id AND income_period IS NOT NULL
  ) periods;

  UPDATE finance_income_rules SET received_periods = v_periods WHERE id = p_rule_id;
END;
$$;

CREATE FUNCTION finance_refresh_loan_progress(p_loan_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT;
  v_term INT;
  v_principal BIGINT;
  v_principal_total BIGINT;
  v_done INT;
  v_principal_paid BOOLEAN;
BEGIN
  IF p_loan_id IS NULL THEN RETURN; END IF;
  SELECT kind, term, principal INTO v_kind, v_term, v_principal
  FROM finance_loans WHERE id = p_loan_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM finance_transactions
    WHERE loan_id = p_loan_id AND loan_part = 'principal'
  ) INTO v_principal_paid;
  SELECT COALESCE(SUM(amount), 0)::BIGINT INTO v_principal_total
  FROM finance_transactions
  WHERE loan_id = p_loan_id AND loan_part = 'principal';

  IF v_kind = 'interest' AND v_principal_paid THEN
    v_done := v_term;
  ELSE
    SELECT COUNT(DISTINCT loan_period)::INT INTO v_done
    FROM finance_transactions
    WHERE loan_id = p_loan_id
      AND loan_part = CASE WHEN v_kind = 'interest' THEN 'interest' ELSE 'principal' END;
    v_done := LEAST(v_term, COALESCE(v_done, 0));
  END IF;

  UPDATE finance_loans
  SET done = v_done,
      closed_at = CASE
        WHEN v_principal_total >= v_principal THEN COALESCE(closed_at, NOW())
        ELSE closed_at
      END
  WHERE id = p_loan_id;
END;
$$;

CREATE FUNCTION finance_sync_transaction_rule_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old_bill UUID;
  v_new_bill UUID;
  v_old_income UUID;
  v_new_income UUID;
  v_old_loan UUID;
  v_new_loan UUID;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_bill := OLD.bill_id;
    v_old_income := OLD.income_rule_id;
    v_old_loan := OLD.loan_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_bill := NEW.bill_id;
    v_new_income := NEW.income_rule_id;
    v_new_loan := NEW.loan_id;
  END IF;

  PERFORM finance_refresh_bill_progress(v_old_bill);
  IF v_new_bill IS DISTINCT FROM v_old_bill THEN PERFORM finance_refresh_bill_progress(v_new_bill); END IF;
  PERFORM finance_refresh_income_progress(v_old_income);
  IF v_new_income IS DISTINCT FROM v_old_income THEN PERFORM finance_refresh_income_progress(v_new_income); END IF;
  PERFORM finance_refresh_loan_progress(v_old_loan);
  IF v_new_loan IS DISTINCT FROM v_old_loan THEN PERFORM finance_refresh_loan_progress(v_new_loan); END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER finance_transaction_progress_sync
AFTER INSERT OR UPDATE OR DELETE ON finance_transactions
FOR EACH ROW EXECUTE FUNCTION finance_sync_transaction_rule_progress();

-- ---------------------------------------------------------------------------
-- 6. Atomic business operations called by useFinance
-- ---------------------------------------------------------------------------
CREATE FUNCTION finance_pay_bill(
  p_bill_id UUID,
  p_amount BIGINT DEFAULT NULL,
  p_occurred_at DATE DEFAULT CURRENT_DATE,
  p_source_card_id UUID DEFAULT NULL,
  p_task_id UUID DEFAULT NULL,
  p_necessity TEXT DEFAULT 'need',
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
  IF p_necessity NOT IN ('must', 'need', 'want') THEN
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

CREATE FUNCTION finance_skip_bill_period(p_bill_id UUID, p_period TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_bill finance_bills%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Invalid bill period' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_bill FROM finance_bills
  WHERE id = p_bill_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT v_bill.enabled OR v_bill.finished_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bill is not active' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM finance_transactions WHERE bill_id = p_bill_id AND bill_period = p_period) THEN
    RAISE EXCEPTION 'A paid bill period cannot be skipped' USING ERRCODE = '23514';
  END IF;

  UPDATE finance_bills
  SET skipped_periods = CASE
    WHEN skipped_periods ? p_period THEN skipped_periods
    ELSE skipped_periods || JSONB_BUILD_ARRAY(p_period)
  END
  WHERE id = p_bill_id;
  RETURN TRUE;
END;
$$;

CREATE FUNCTION finance_receive_income(
  p_rule_id UUID,
  p_amount BIGINT DEFAULT NULL,
  p_occurred_at DATE DEFAULT CURRENT_DATE,
  p_task_id UUID DEFAULT NULL,
  p_income_period TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rule finance_income_rules%ROWTYPE;
  v_amount BIGINT;
  v_period TEXT;
  v_tx_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_occurred_at IS NULL THEN RAISE EXCEPTION 'Received date is required' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_rule FROM finance_income_rules
  WHERE id = p_rule_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Income rule not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT v_rule.enabled THEN RAISE EXCEPTION 'Income rule is disabled' USING ERRCODE = '23514'; END IF;

  v_amount := COALESCE(p_amount, v_rule.amount);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'A positive income amount is required' USING ERRCODE = '23514';
  END IF;
  v_period := COALESCE(p_income_period, TO_CHAR(p_occurred_at, 'YYYY-MM'));
  IF v_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Invalid income period' USING ERRCODE = '22023';
  END IF;

  INSERT INTO finance_transactions (
    user_id, amount, occurred_at, type, category_id, note,
    income_rule_id, income_period, task_id
  ) VALUES (
    v_user, v_amount, p_occurred_at, 'income', v_rule.category_id, v_rule.name,
    v_rule.id, v_period, p_task_id
  ) RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

CREATE FUNCTION finance_record_loan_payment(
  p_loan_id UUID,
  p_interest BIGINT DEFAULT 0,
  p_principal BIGINT DEFAULT 0,
  p_occurred_at DATE DEFAULT CURRENT_DATE,
  p_task_id UUID DEFAULT NULL,
  p_loan_period TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_loan finance_loans%ROWTYPE;
  v_period TEXT;
  v_principal_paid BIGINT;
  v_interest_id UUID;
  v_principal_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_occurred_at IS NULL THEN RAISE EXCEPTION 'Payment date is required' USING ERRCODE = '22023'; END IF;
  IF COALESCE(p_interest, 0) < 0 OR COALESCE(p_principal, 0) < 0
     OR COALESCE(p_interest, 0) + COALESCE(p_principal, 0) <= 0 THEN
    RAISE EXCEPTION 'Loan payment parts must total a positive amount' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_loan FROM finance_loans
  WHERE id = p_loan_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found' USING ERRCODE = 'P0002'; END IF;
  IF v_loan.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Loan is closed' USING ERRCODE = '23514'; END IF;
  v_period := COALESCE(p_loan_period, TO_CHAR(p_occurred_at, 'YYYY-MM'));
  IF v_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Invalid loan period' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(amount), 0)::BIGINT INTO v_principal_paid
  FROM finance_transactions
  WHERE loan_id = v_loan.id AND loan_part = 'principal';
  IF COALESCE(p_principal, 0) > v_loan.principal - v_principal_paid THEN
    RAISE EXCEPTION 'Principal payment exceeds the remaining principal' USING ERRCODE = '23514';
  END IF;
  IF v_loan.kind = 'interest' AND COALESCE(p_principal, 0) > 0
     AND p_principal <> v_loan.principal - v_principal_paid THEN
    RAISE EXCEPTION 'Interest-only loan principal must be settled in full' USING ERRCODE = '23514';
  END IF;

  IF COALESCE(p_interest, 0) > 0 THEN
    INSERT INTO finance_transactions (
      user_id, amount, occurred_at, type, category_id, subcategory_id,
      excluded, necessity, is_fixed, note, loan_id, loan_period, loan_part, task_id
    ) VALUES (
      v_user, p_interest, p_occurred_at, 'expense', 'finance', 'finance.interest',
      FALSE, 'must', TRUE, 'Lai ' || v_loan.name,
      v_loan.id, v_period, 'interest', p_task_id
    ) RETURNING id INTO v_interest_id;
  END IF;

  IF COALESCE(p_principal, 0) > 0 THEN
    INSERT INTO finance_transactions (
      user_id, amount, occurred_at, type, category_id, subcategory_id, excluded, is_fixed, note,
      loan_id, loan_period, loan_part, task_id
    ) VALUES (
      v_user, p_principal, p_occurred_at, 'expense', 'finance', 'finance.principal', TRUE, FALSE, 'Tra goc ' || v_loan.name,
      v_loan.id, v_period, 'principal', p_task_id
    ) RETURNING id INTO v_principal_id;
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'interest_id', v_interest_id,
    'principal_id', v_principal_id,
    'interest', COALESCE(p_interest, 0),
    'principal', COALESCE(p_principal, 0)
  );
END;
$$;

CREATE FUNCTION finance_cycle_statement_date(p_period TEXT, p_day INT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_first DATE;
  v_last_day INT;
BEGIN
  IF p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' OR p_day NOT BETWEEN 1 AND 31 THEN
    RAISE EXCEPTION 'Invalid card statement period or day' USING ERRCODE = '22023';
  END IF;
  v_first := TO_DATE(p_period || '-01', 'YYYY-MM-DD');
  v_last_day := EXTRACT(DAY FROM (v_first + INTERVAL '1 month - 1 day'))::INT;
  RETURN v_first + (LEAST(p_day, v_last_day) - 1);
END;
$$;

CREATE FUNCTION finance_pay_card_statement(
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
  IF v_statement > p_occurred_at THEN
    RAISE EXCEPTION 'Cannot pay a statement before it closes' USING ERRCODE = '23514';
  END IF;
  v_previous_statement := finance_cycle_statement_date(
    TO_CHAR(v_statement - INTERVAL '1 month', 'YYYY-MM'), v_card.statement_day
  );

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

CREATE FUNCTION finance_request_saving_withdrawal(
  p_goal_id UUID,
  p_deposit_id UUID,
  p_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_goal finance_saving_goals%ROWTYPE;
  v_deposit finance_deposits%ROWTYPE;
  v_request JSONB;
  v_available TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'A positive amount is required' USING ERRCODE = '23514'; END IF;

  SELECT * INTO v_goal FROM finance_saving_goals
  WHERE id = p_goal_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saving goal not found' USING ERRCODE = 'P0002'; END IF;
  IF v_goal.lock_mode <> 'term' OR v_goal.lock_until <= CURRENT_DATE THEN
    RAISE EXCEPTION 'This goal no longer requires a withdrawal request' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_deposit FROM finance_deposits
  WHERE id = p_deposit_id AND fund_id = p_goal_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saving deposit not found' USING ERRCODE = 'P0002'; END IF;
  IF p_amount > v_deposit.amount THEN RAISE EXCEPTION 'Insufficient deposit amount' USING ERRCODE = '23514'; END IF;

  v_available := NOW() + INTERVAL '48 hours';
  v_request := JSONB_BUILD_OBJECT(
    'deposit_id', p_deposit_id,
    'amount', p_amount,
    'requested_at', NOW(),
    'available_at', v_available
  );
  UPDATE finance_saving_goals SET withdrawal_request = v_request WHERE id = p_goal_id;
  RETURN v_request;
END;
$$;

CREATE FUNCTION finance_move_saving(
  p_goal_id UUID,
  p_deposit_id UUID,
  p_direction TEXT,
  p_amount BIGINT,
  p_occurred_at DATE DEFAULT CURRENT_DATE,
  p_note TEXT DEFAULT NULL,
  p_task_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_goal finance_saving_goals%ROWTYPE;
  v_deposit finance_deposits%ROWTYPE;
  v_request JSONB;
  v_tx_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_direction NOT IN ('in', 'out') THEN RAISE EXCEPTION 'Invalid saving direction' USING ERRCODE = '22023'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'A positive amount is required' USING ERRCODE = '23514'; END IF;
  IF p_occurred_at IS NULL THEN RAISE EXCEPTION 'Transaction date is required' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_goal FROM finance_saving_goals
  WHERE id = p_goal_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saving goal not found' USING ERRCODE = 'P0002'; END IF;
  IF v_goal.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Saving goal is closed' USING ERRCODE = '23514'; END IF;

  SELECT * INTO v_deposit FROM finance_deposits
  WHERE id = p_deposit_id AND fund_id = p_goal_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saving deposit not found' USING ERRCODE = 'P0002'; END IF;

  IF p_direction = 'out' THEN
    IF p_amount > v_deposit.amount THEN RAISE EXCEPTION 'Insufficient deposit amount' USING ERRCODE = '23514'; END IF;
    IF v_goal.lock_mode = 'term' AND v_goal.lock_until > CURRENT_DATE THEN
      v_request := v_goal.withdrawal_request;
      IF v_request IS NULL
        OR v_request->>'deposit_id' <> p_deposit_id::TEXT
        OR COALESCE((v_request->>'amount')::BIGINT, 0) < p_amount
        OR COALESCE((v_request->>'available_at')::TIMESTAMPTZ, 'infinity'::TIMESTAMPTZ) > NOW()
      THEN
        RAISE EXCEPTION 'Term withdrawal request is missing or not ready' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  INSERT INTO finance_transactions (
    user_id, amount, occurred_at, type, note, saving_goal_id, saving_dir, task_id
  ) VALUES (
    v_user, p_amount, p_occurred_at, 'saving',
    COALESCE(p_note, CASE WHEN p_direction = 'out' THEN 'Rut ' ELSE 'Gui ' END || v_goal.name || ' - ' || v_deposit.name),
    v_goal.id, p_direction, p_task_id
  ) RETURNING id INTO v_tx_id;

  UPDATE finance_deposits
  SET amount = CASE WHEN p_direction = 'out' THEN amount - p_amount ELSE amount + p_amount END
  WHERE id = v_deposit.id;

  IF p_direction = 'out' THEN
    UPDATE finance_saving_goals
    SET withdrawal_request = NULL, break_count = break_count + 1
    WHERE id = v_goal.id;
  END IF;
  RETURN v_tx_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. RLS and grants
-- ---------------------------------------------------------------------------
ALTER TABLE finance_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_saving_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_income_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_shortcuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_category_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transaction_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_cards_own ON finance_cards FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY finance_bills_own ON finance_bills FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY finance_loans_own ON finance_loans FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY finance_goals_own ON finance_saving_goals FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY finance_deposits_own ON finance_deposits FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY finance_income_rules_own ON finance_income_rules FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY finance_shortcuts_own ON finance_shortcuts FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY finance_budgets_own ON finance_budgets FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY finance_category_overrides_own ON finance_category_overrides FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY finance_transactions_own ON finance_transactions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY finance_transaction_tags_own ON finance_transaction_tags FOR ALL
  USING (
    EXISTS (SELECT 1 FROM finance_transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags WHERE id = tag_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM finance_transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags WHERE id = tag_id AND user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  finance_cards, finance_bills, finance_loans, finance_saving_goals,
  finance_deposits, finance_income_rules, finance_shortcuts, finance_budgets,
  finance_category_overrides, finance_transactions, finance_transaction_tags
TO authenticated;

GRANT ALL ON TABLE
  finance_cards, finance_bills, finance_loans, finance_saving_goals,
  finance_deposits, finance_income_rules, finance_shortcuts, finance_budgets,
  finance_category_overrides, finance_transactions, finance_transaction_tags
TO service_role;

REVOKE ALL ON TABLE
  finance_cards, finance_bills, finance_loans, finance_saving_goals,
  finance_deposits, finance_income_rules, finance_shortcuts, finance_budgets,
  finance_category_overrides, finance_transactions, finance_transaction_tags
FROM anon;

REVOKE ALL ON FUNCTION finance_valid_rrule(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_cycle_statement_date(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_refresh_bill_progress(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_refresh_income_progress(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_refresh_loan_progress(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_validate_transaction_references() FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_validate_shortcut_reference() FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_sync_transaction_rule_progress() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION finance_valid_rrule(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_cycle_statement_date(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_refresh_bill_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_refresh_income_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_refresh_loan_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_valid_rrule(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION finance_cycle_statement_date(TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION finance_refresh_bill_progress(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION finance_refresh_income_progress(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION finance_refresh_loan_progress(UUID) TO service_role;

REVOKE ALL ON FUNCTION finance_pay_bill(UUID, BIGINT, DATE, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_skip_bill_period(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_receive_income(UUID, BIGINT, DATE, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_record_loan_payment(UUID, BIGINT, BIGINT, DATE, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_pay_card_statement(UUID, BIGINT, DATE, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_request_saving_withdrawal(UUID, UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION finance_move_saving(UUID, UUID, TEXT, BIGINT, DATE, TEXT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION finance_pay_bill(UUID, BIGINT, DATE, UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_skip_bill_period(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_receive_income(UUID, BIGINT, DATE, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_record_loan_payment(UUID, BIGINT, BIGINT, DATE, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_pay_card_statement(UUID, BIGINT, DATE, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_request_saving_withdrawal(UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION finance_move_saving(UUID, UUID, TEXT, BIGINT, DATE, TEXT, UUID) TO authenticated;

-- Rebuild the shared tag view after removing the legacy expense branches.
CREATE VIEW tagged_items WITH (security_invoker = TRUE) AS
      SELECT tag_id, 'collection'::TEXT AS kind, collection_id AS item_id FROM collection_tags
UNION ALL SELECT tag_id, 'task'::TEXT, task_id FROM task_tags
UNION ALL SELECT tag_id, 'account'::TEXT, account_id FROM account_tags
UNION ALL SELECT tag_id, 'finance'::TEXT, transaction_id FROM finance_transaction_tags;

GRANT SELECT ON tagged_items TO authenticated;
GRANT SELECT ON tagged_items TO service_role;
REVOKE ALL ON tagged_items FROM anon;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification queries (run after the migration; they do not mutate data)
-- ---------------------------------------------------------------------------
-- Must return 11 rows:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN (
--   'finance_transactions', 'finance_bills', 'finance_loans', 'finance_cards',
--   'finance_saving_goals', 'finance_deposits', 'finance_income_rules',
--   'finance_shortcuts', 'finance_budgets', 'finance_transaction_tags',
--   'finance_category_overrides'
-- );
--
-- Must return 7 rows:
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name IN (
--   'finance_pay_bill', 'finance_skip_bill_period', 'finance_receive_income',
--   'finance_record_loan_payment', 'finance_pay_card_statement',
--   'finance_request_saving_withdrawal', 'finance_move_saving'
-- );
--
-- Must return 0 rows:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN
--   ('expenses', 'subscriptions', 'expense_tags', 'subscription_tags');

-- ═══════════════════════════════════════════════════════════════
-- RESET USER DATA — Xóa toàn bộ data app, GIỮ lại auth accounts
-- Synced with: schema_v4.24.0.sql + Vault v6.2.0 + Finance v6.0.0
-- Last updated: 2026-08-09
-- Chạy trong Supabase SQL Editor
-- ⚠️  KHÔNG THỂ HOÀN TÁC SAU COMMIT — chỉ chạy khi chắc chắn muốn reset
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 0. Encrypted Account Vault
DELETE FROM accounts;
DELETE FROM vault_config;

-- 1. Tag junctions, trước tags và entity
DELETE FROM collection_tags;
DELETE FROM task_tags;
DELETE FROM finance_transaction_tags;

-- Incubator (module đã gỡ khỏi frontend v6.3.0; bỏ comment nếu bảng còn tồn tại)
-- DELETE FROM intention_logs;
-- DELETE FROM intentions;
DELETE FROM activity_logs;
DELETE FROM task_collections;
DELETE FROM collection_notes;

-- 3. Tags, tasks và Knowledge
DELETE FROM tags;
DELETE FROM user_tasks;
DELETE FROM collections;

-- 4. Finance: transactions trước các row được tham chiếu
DELETE FROM finance_transactions;
DELETE FROM finance_deposits;
DELETE FROM finance_shortcuts;
DELETE FROM finance_bills;
DELETE FROM finance_income_rules;
DELETE FROM finance_loans;
DELETE FROM finance_cards;
DELETE FROM finance_saving_goals;
DELETE FROM finance_budgets;
DELETE FROM finance_category_overrides;

-- 5. Sessions và nội dung độc lập
DELETE FROM focus_sessions;

-- 6. Tùy chọn: mở comment nếu muốn xóa cả XP/profile
-- DELETE FROM xp_logs;
-- DELETE FROM profiles;

COMMIT;

-- DONE: giữ nguyên auth.users. Nếu bất kỳ statement nào lỗi trước COMMIT,
-- PostgreSQL abort toàn transaction và không reset dở dang.

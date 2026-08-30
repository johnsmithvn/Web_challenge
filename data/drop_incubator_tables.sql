-- ═══════════════════════════════════════════════════════════════
-- DROP INCUBATOR TABLES — Tùy chọn, chạy thủ công
-- Module Incubator (ấp trứng) đã gỡ khỏi frontend từ v6.3.0.
-- Chạy script này NẾU muốn xóa bảng và data intentions khỏi DB.
-- ⚠️  KHÔNG THỂ HOÀN TÁC — data intentions sẽ mất vĩnh viễn.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 1. Drop policies
DROP POLICY IF EXISTS "intentions_own" ON intentions;
DROP POLICY IF EXISTS "intention_logs_own" ON intention_logs;

-- 2. Drop indexes
DROP INDEX IF EXISTS idx_intentions_user;
DROP INDEX IF EXISTS idx_intention_logs_intention;

-- 3. Drop tables (logs trước vì FK)
DROP TABLE IF EXISTS intention_logs CASCADE;
DROP TABLE IF EXISTS intentions CASCADE;

COMMIT;

-- DONE: Bảng intentions và intention_logs đã bị xóa vĩnh viễn.

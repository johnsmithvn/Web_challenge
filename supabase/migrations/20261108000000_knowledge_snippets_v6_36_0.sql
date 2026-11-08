-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — KNOWLEDGE: SỔ LỆNH v6.36.0
-- Thiết kế: docs/MODULE_KNOWLEDGE.md §4.11.
--
-- Bảng `snippets`: mỗi dòng là một lệnh / đoạn code ngắn kèm tên theo việc cần làm
-- ("Đổi đuôi hàng loạt file"). Nhóm (`group_name`) và công cụ (`tool`) là chữ tự do:
-- gõ tên mới là có nhóm mới, không có bảng nhóm riêng. `copy_count` để xếp mục "Hay dùng".
--
-- Additive, không đụng bảng khác, không xoá dữ liệu. Idempotent.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS snippets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  code        TEXT NOT NULL CHECK (length(btrim(code)) BETWEEN 1 AND 100000),
  tool        TEXT NOT NULL DEFAULT '' CHECK (length(tool) <= 30),
  group_name  TEXT NOT NULL DEFAULT '' CHECK (length(group_name) <= 40),
  note        TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  warning     TEXT NOT NULL DEFAULT '' CHECK (length(warning) <= 500),
  copy_count  INT  NOT NULL DEFAULT 0 CHECK (copy_count >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snippets_user ON snippets (user_id);

ALTER TABLE snippets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "snippets_select_own" ON snippets;
CREATE POLICY "snippets_select_own" ON snippets FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "snippets_insert_own" ON snippets;
CREATE POLICY "snippets_insert_own" ON snippets FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "snippets_update_own" ON snippets;
CREATE POLICY "snippets_update_own" ON snippets FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "snippets_delete_own" ON snippets;
CREATE POLICY "snippets_delete_own" ON snippets FOR DELETE USING (user_id = auth.uid());

-- config.toml đặt auto_expose_new_tables = false: cấp quyền tường minh, không cho anon.
REVOKE ALL ON TABLE snippets FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE snippets TO authenticated;

COMMENT ON TABLE snippets IS
  'Sổ lệnh của Knowledge: lệnh / đoạn code theo việc cần làm. group_name, tool là chữ tự do; copy_count xếp mục Hay dùng.';

-- ── VERIFY ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'snippets'::regclass) THEN
    RAISE EXCEPTION 'Snippets migration failed: RLS is off on snippets.';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'snippets') <> 4 THEN
    RAISE EXCEPTION 'Snippets migration failed: snippets must have exactly 4 policies.';
  END IF;
  IF has_table_privilege('anon', 'snippets', 'SELECT') THEN
    RAISE EXCEPTION 'Snippets migration failed: anon can read snippets.';
  END IF;
END
$$;

COMMIT;

-- ── ROLLBACK (xoá mọi lệnh đã lưu — chỉ khi user đồng ý) ─────────────────────
-- DROP TABLE IF EXISTS snippets;

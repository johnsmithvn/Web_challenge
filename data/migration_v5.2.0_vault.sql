-- ═══════════════════════════════════════════════════════════════════════════
-- migration_v5.2.0_vault.sql — Account Vault v2 (thiết kế Keyplate)
--
-- Schema ĐẦY ĐỦ của module vault, không phải bản vá. File này thay hẳn
-- `migration_v5.1.0_accounts.sql` (đã xoá) — bản đó CHƯA TỪNG chạy trên
-- Supabase (xác nhận với user 2026-08-05) nên không có dữ liệu nào cần giữ và
-- không có nhánh nâng cấp nào cần viết. 6 bảng dưới đây dựng từ trạng thái
-- trắng.
--
-- Idempotent — chạy lại an toàn (CREATE ... IF NOT EXISTS + DROP POLICY IF
-- EXISTS trước mỗi CREATE POLICY, cùng pattern master schema).
-- Chạy 1 lần trên Supabase SQL Editor rồi deploy code.
--
-- ⚠️ CHƯA CÓ MÃ HOÁ. `account_fields.value` là PLAINTEXT trong Supabase.
--    Type `password`/`secret` CHỈ mask trên UI (chống lộ khi screenshot / share
--    màn hình) — KHÔNG bảo vệ dữ liệu. Đừng nhập secret thật vào bản này;
--    secret thật vẫn ở Bitwarden tới khi xong envelope encryption.
--
-- Hai quy tắc dùng xuyên file, để đọc chỗ nào cũng suy ra được chỗ khác:
--
--   1. BẢNG vs CỘT JSONB — có lifecycle hoặc ràng buộc riêng thì làm bảng; chỉ
--      là giá trị của một field thì làm cột.
--      → account_auth / account_codes / account_logs là bảng (bật/tắt, đánh
--        dấu đã dùng, ghi log đều xảy ra độc lập với việc sửa item).
--      → account_fields.multi_values / .links là cột jsonb (chỉ được sửa cùng
--        chính field chứa nó).
--
--   2. CHECK — chỉ đặt trên giá trị mà code render PHÂN NHÁNH theo
--      (account_fields.type, account_auth.state). KHÔNG đặt trên giá trị chỉ
--      được tra bảng để lấy nhãn (accounts.tpl, account_auth.kind) — chúng là
--      *content* nằm trong src/data/account-templates.json, thêm một template
--      hay một kiểu đăng nhập mới không nên cần một migration.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. accounts = Item ─────────────────────────────────────────────────────
-- `service_name` mang nghĩa `Item.title` của đặc tả. Giữ tên cột cũ chứ không
-- thêm cột `title`: cột này đã NOT NULL và đúng nghĩa, thêm nữa là 2 nguồn cho
-- 1 thứ.
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  tpl TEXT NOT NULL DEFAULT 'login',
  favorite BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts (user_id, service_name);

-- Tái dùng hàm trigger dùng chung đã có (schema_v4.24.0.sql dòng 47).
DROP TRIGGER IF EXISTS accounts_updated_at ON accounts;
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounts_select_own" ON accounts;
CREATE POLICY "accounts_select_own" ON accounts FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "accounts_insert_own" ON accounts;
CREATE POLICY "accounts_insert_own" ON accounts FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "accounts_update_own" ON accounts;
CREATE POLICY "accounts_update_own" ON accounts FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "accounts_delete_own" ON accounts;
CREATE POLICY "accounts_delete_own" ON accounts FOR DELETE USING (user_id = auth.uid());

-- ── 2. account_fields = Field ──────────────────────────────────────────────
-- `type` quyết định HÀNH VI, `label` mang nghĩa. `password` và `secret` KHÔNG
-- được gộp: cả hai cùng mask + reveal được, nhưng chỉ `password` được tính điểm
-- mạnh/yếu; `secret` dành cho secret có định dạng cố định (PIN, CVV, số giấy
-- tờ) nơi điểm mạnh/yếu là vô nghĩa.
--
-- `multi_values` (type='multi'): mảng chuỗi, index 0 là giá trị chính.
--   Tên cột KHÔNG phải `values` — VALUES là từ khoá SQL, dùng nó thì mọi câu
--   lệnh phải quote "values".
--
-- `links` (type='link'): [{ id, itemId, value }], NHIỀU link trong 1 field.
--   ponytail: jsonb chứ không phải bảng con + FK. Đổi lại là mất ràng buộc
--   khoá ngoại — xoá item đích thì link thành orphan và UI hiện "Missing item".
--   Đó ĐÚNG hành vi đặc tả yêu cầu, nên FK ở đây không mua được gì.
--   Nâng cấp khi cần dọn orphan tự động: bảng `account_field_links` + FK
--   ON DELETE CASCADE.
--
-- ⚠️ Hệ quả bảo mật đã cân nhắc: vì `links` là jsonb chứ không phải FK, policy
--    dưới đây KHÔNG kiểm được ownership của item ĐÍCH (bản v5.1.0 kiểm cả hai
--    phía nhờ FK thật). User tự sửa payload có thể nhét id của người khác vào.
--    KHÔNG rò rỉ gì: UI resolve itemId trong đúng bộ account đã fetch của
--    chính user → id lạ không khớp → hiện "Missing item"; RLS trên `accounts`
--    vẫn chặn mọi đường đọc dòng của người khác.
CREATE TABLE IF NOT EXISTS account_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  -- ⚠️ 10 giá trị này phải khớp `TYPES` trong src/utils/vaultLogic.js. File đó
  --    là nguồn duy nhất; gõ lệch là insert fail lúc runtime, không phải lúc
  --    build. Có test khoá cứng danh sách trong src/__tests__/vaultLogic.test.js.
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN
    ('text','password','secret','url','email','phone','multi','link','number','date')),
  value TEXT,
  multi_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_fields_account ON account_fields (account_id, sort_order);

ALTER TABLE account_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account_fields_own" ON account_fields;
CREATE POLICY "account_fields_own" ON account_fields FOR ALL
  USING (
        user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM accounts WHERE id = account_id AND user_id = auth.uid())
  )
  WITH CHECK (
        user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM accounts WHERE id = account_id AND user_id = auth.uid())
  );

-- ── 3. account_auth = Auth (phương thức đăng nhập) ─────────────────────────
-- Bảng vì có lifecycle riêng (bật / tắt / đặt làm chính được ngay ngoài chế độ
-- sửa, mỗi lần đều ghi log) và có một ràng buộc thật: mỗi item ĐÚNG 1 `primary`.
-- `kind`: 9 giá trị trong `authKinds` của src/data/account-templates.json.
CREATE TABLE IF NOT EXISTS account_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  note TEXT,
  state TEXT NOT NULL DEFAULT 'on' CHECK (state IN ('primary','on','off')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_auth_account ON account_auth (account_id, sort_order);

-- Index này ép "KHÔNG QUÁ 1 primary mỗi item" — không ép "đúng 1", vì 0 primary
-- là trạng thái hợp lệ (item chưa chọn phương thức chính nào).
-- ⚠️ Hệ quả cho code: đổi primary phải HẠ CÁI CŨ TRƯỚC rồi mới nâng cái mới.
--    Đảo thứ tự thì lệnh nâng vi phạm index ngay. `setAuthState` trong
--    src/hooks/useAccounts.js làm đúng thứ tự này; đừng đổi.
--    (Một câu duy nhất cũng được nếu viết được CASE —
--       UPDATE account_auth SET state = CASE WHEN id = $1 THEN 'primary'
--         ELSE 'on' END WHERE account_id = $2 AND state <> 'off';
--     — nhưng supabase-js không gửi được dạng này.)
CREATE UNIQUE INDEX IF NOT EXISTS unique_account_auth_primary
  ON account_auth (account_id) WHERE state = 'primary';

ALTER TABLE account_auth ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account_auth_own" ON account_auth;
CREATE POLICY "account_auth_own" ON account_auth FOR ALL
  USING (
        user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM accounts WHERE id = account_id AND user_id = auth.uid())
  )
  WITH CHECK (
        user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM accounts WHERE id = account_id AND user_id = auth.uid())
  );

-- ── 4. account_codes = Code (mã dự phòng dùng 1 lần) ───────────────────────
-- Bảng vì từng mã được đánh dấu đã dùng / hoàn lại NGOÀI chế độ sửa và mỗi lần
-- đều ghi log — lifecycle riêng, không phải giá trị của một field.
CREATE TABLE IF NOT EXISTS account_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_codes_account ON account_codes (account_id, sort_order);

ALTER TABLE account_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account_codes_own" ON account_codes;
CREATE POLICY "account_codes_own" ON account_codes FOR ALL
  USING (
        user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM accounts WHERE id = account_id AND user_id = auth.uid())
  )
  WITH CHECK (
        user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM accounts WHERE id = account_id AND user_id = auth.uid())
  );

-- ── 5. account_logs = Log (lịch sử thay đổi từng field) ────────────────────
-- APPEND-ONLY, ép bằng RLS chứ không bằng quy ước: bảng này CỐ Ý chỉ có policy
-- SELECT + INSERT. Không có policy UPDATE/DELETE → client không sửa hay xoá
-- được một dòng log nào, kể cả khi code có bug hoặc bị gọi sai. Dòng log chết
-- theo item qua FK CASCADE, đó là đường xoá duy nhất.
--
-- `logged_at` chứ không phải `at`: AT là từ khoá SQL (AT TIME ZONE), không đặt
-- cược migration vào chuyện Postgres có cho dùng làm tên cột hay không. Tầng
-- hook map `logged_at` → `at` để trùng shape `Log` của đặc tả.
--
-- ⚠️ `text`/`detail` KHÔNG BAO GIỜ được chứa giá trị secret thật. `diffLog`
--    trong src/utils/vaultLogic.js mask password/secret thành '•' × min(len,24)
--    trước khi tạo dòng log — bất biến của module, có test khẳng định.
CREATE TABLE IF NOT EXISTS account_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  text TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_account_logs_account ON account_logs (account_id, logged_at DESC);

ALTER TABLE account_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account_logs_select_own" ON account_logs;
CREATE POLICY "account_logs_select_own" ON account_logs FOR SELECT
  USING (
        user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM accounts WHERE id = account_id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS "account_logs_insert_own" ON account_logs;
CREATE POLICY "account_logs_insert_own" ON account_logs FOR INSERT
  WITH CHECK (
        user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM accounts WHERE id = account_id AND user_id = auth.uid())
  );
-- KHÔNG có policy UPDATE/DELETE — đó là cách append-only được ép. Đừng thêm.

-- ── 6. account_tags (junction: accounts ↔ tags) ────────────────────────────
-- Tag của item dùng bảng `tags` có sẵn, KHÔNG thêm cột category — đúng pattern
-- expense_tags / task_tags.
CREATE TABLE IF NOT EXISTS account_tags (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
  PRIMARY KEY (account_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_account_tags_tag ON account_tags(tag_id);

ALTER TABLE account_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account_tags_own" ON account_tags;
CREATE POLICY "account_tags_own" ON account_tags FOR ALL
  USING (
        EXISTS (SELECT 1 FROM accounts WHERE id = account_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags     WHERE id = tag_id     AND user_id = auth.uid())
  )
  WITH CHECK (
        EXISTS (SELECT 1 FROM accounts WHERE id = account_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags     WHERE id = tag_id     AND user_id = auth.uid())
  );

-- ── 7. VIEW tagged_items — thêm 'account' vào mặt đọc hợp nhất ─────────────
-- useTags.js đọc view này để đếm tag đang được dùng ở đâu. Phải chạy SAU §6,
-- view tham chiếu account_tags.
DROP VIEW IF EXISTS tagged_items;
CREATE VIEW tagged_items WITH (security_invoker = true) AS
      SELECT tag_id, 'collection'::text   AS kind, collection_id   AS item_id FROM collection_tags
UNION ALL SELECT tag_id, 'task'::text,          task_id         FROM task_tags
UNION ALL SELECT tag_id, 'expense'::text,       expense_id      FROM expense_tags
UNION ALL SELECT tag_id, 'subscription'::text,  subscription_id FROM subscription_tags
UNION ALL SELECT tag_id, 'account'::text,       account_id      FROM account_tags;

-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- 6 bảng tồn tại (phải ra 6 dòng):
--   SELECT table_name FROM information_schema.tables
--    WHERE table_name IN ('accounts','account_fields','account_auth',
--                         'account_codes','account_logs','account_tags');
--
-- RLS bật đủ 6 bảng (true cả 6):
--   SELECT relname, relrowsecurity FROM pg_class
--    WHERE relname IN ('accounts','account_fields','account_auth',
--                      'account_codes','account_logs','account_tags');
--
-- account_logs append-only — đúng 2 policy, đúng 2 lệnh SELECT + INSERT:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'account_logs';
--
-- View đã có mặt 'account' (không lỗi, dù chưa có dòng nào):
--   SELECT * FROM tagged_items WHERE kind = 'account';
--
-- ── 3 phép thử PHẢI BÁO LỖI (thay '<id>' bằng id 1 account của mình) ──
-- CHECK trên type — 'totp' không phải loại field (nó là phương thức đăng nhập):
--   INSERT INTO account_fields (user_id, account_id, label, type)
--   VALUES (auth.uid(), '<id>', 'thử', 'totp');
--
-- "Đúng 1 primary" — dòng thứ hai phải bị chặn:
--   INSERT INTO account_auth (user_id, account_id, kind, state) VALUES
--     (auth.uid(), '<id>', 'password', 'primary'),
--     (auth.uid(), '<id>', 'passkey',  'primary');
--
-- Log không sửa/xoá được (phải ra 0 dòng bị ảnh hưởng, KHÔNG phải báo lỗi —
-- RLS lọc hết dòng chứ không từ chối câu lệnh):
--   UPDATE account_logs SET text = 'hacked' WHERE true;
--   DELETE FROM account_logs WHERE true;

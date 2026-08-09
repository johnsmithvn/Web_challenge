-- ══════════════════════════════════════════════════════════════════════════════
-- LIFE HUB — VAULT FULL-CONTENT ENCRYPTION v6.2.0
-- Run after migration_v5.2.0_vault.sql.
--
-- This is intentionally an EMPTY-VAULT cutover. It refuses to run when any
-- account row exists, so an incorrect assumption can never erase user data.
-- After the cutover every user-authored item property lives inside one AES-GCM
-- ciphertext. Supabase sees only ownership, timestamps, nonce and version.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM accounts LIMIT 1) THEN
    RAISE EXCEPTION
      'Vault encryption cutover refused: accounts is not empty. Export or remove test data first.';
  END IF;
END
$$;

-- The old normalized child tables cannot safely represent full-content
-- encryption: labels, URLs, usernames, tags, auth notes and logs were plaintext.
-- They are guaranteed empty by the accounts guard and their foreign keys.
DROP VIEW IF EXISTS tagged_items;
DROP TABLE IF EXISTS account_tags;
DROP TABLE IF EXISTS account_logs;
DROP TABLE IF EXISTS account_codes;
DROP TABLE IF EXISTS account_auth;
DROP TABLE IF EXISTS account_fields;

DROP INDEX IF EXISTS idx_accounts_user;

ALTER TABLE accounts
  DROP COLUMN service_name,
  DROP COLUMN tpl,
  DROP COLUMN favorite,
  DROP COLUMN notes,
  ADD COLUMN encrypted_payload TEXT NOT NULL CHECK (BTRIM(encrypted_payload) <> ''),
  ADD COLUMN encryption_nonce TEXT NOT NULL CHECK (BTRIM(encryption_nonce) <> ''),
  ADD COLUMN encryption_version SMALLINT NOT NULL DEFAULT 1
    CHECK (encryption_version = 1);

CREATE INDEX idx_accounts_user_updated
  ON accounts (user_id, updated_at DESC);

-- One configuration row per authenticated user. The passphrase, KEK and raw
-- DEK are never stored; only the random DEK wrapped by the derived KEK is saved.
CREATE TABLE vault_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kdf_algorithm TEXT NOT NULL CHECK (kdf_algorithm = 'PBKDF2-SHA256'),
  kdf_salt TEXT NOT NULL CHECK (BTRIM(kdf_salt) <> ''),
  kdf_iterations INTEGER NOT NULL CHECK (kdf_iterations BETWEEN 600000 AND 5000000),
  wrapped_key TEXT NOT NULL CHECK (BTRIM(wrapped_key) <> ''),
  wrapped_key_nonce TEXT NOT NULL CHECK (BTRIM(wrapped_key_nonce) <> ''),
  encryption_version SMALLINT NOT NULL DEFAULT 1 CHECK (encryption_version = 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER vault_config_updated_at BEFORE UPDATE ON vault_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE vault_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vault_config_select_own" ON vault_config
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "vault_config_insert_own" ON vault_config
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Remove broad Supabase default ACLs first: RLS does not protect TRUNCATE.
REVOKE ALL ON TABLE accounts, vault_config FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE accounts TO authenticated;
GRANT SELECT, INSERT ON TABLE vault_config TO authenticated;
GRANT ALL ON TABLE accounts, vault_config TO service_role;

-- Vault tags now live inside ciphertext, so the shared plaintext tag view keeps
-- only modules whose tag relationships remain server-readable.
CREATE VIEW tagged_items WITH (security_invoker = TRUE) AS
      SELECT tag_id, 'collection'::TEXT AS kind, collection_id AS item_id FROM collection_tags
UNION ALL SELECT tag_id, 'task'::TEXT, task_id FROM task_tags
UNION ALL SELECT tag_id, 'finance'::TEXT, transaction_id FROM finance_transaction_tags;

GRANT SELECT ON tagged_items TO authenticated;
GRANT SELECT ON tagged_items TO service_role;
REVOKE ALL ON tagged_items FROM anon;

COMMIT;

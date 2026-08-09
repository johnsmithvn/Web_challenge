import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const snapshots = [
  ['../../data/schema_v4.24.0.sql', '../../supabase/migrations/20260802000000_base_v5_0_0.sql'],
  ['../../data/migration_v5.2.0_vault.sql', '../../supabase/migrations/20260805000000_vault_v5_2_0.sql'],
  ['../../data/migration_v6.0.0_finance.sql', '../../supabase/migrations/20260808000000_finance_v6_0_0.sql'],
  ['../../data/migration_v6.2.0_vault_encryption.sql', '../../supabase/migrations/20260809000000_vault_encryption_v6_2_0.sql'],
];

for (const [source, migration] of snapshots) {
  assert.equal(read(migration), read(source), `${migration} must mirror ${source}`);
}

const config = read('../../supabase/config.toml');
const core = read('../../data/schema_v4.24.0.sql');
const vault = read('../../data/migration_v5.2.0_vault.sql');
const vaultEncryption = read('../../data/migration_v6.2.0_vault_encryption.sql');
const finance = read('../../data/migration_v6.0.0_finance.sql');

assert.match(config, /^auto_expose_new_tables = false$/m);
assert.match(config, /\[db\.seed\][\s\S]*?enabled = false/);
assert.match(config, /\[edge_runtime\]\s*enabled = false/);
assert.match(config, /\[analytics\]\s*enabled = false/);
assert.match(config, /^site_url = "http:\/\/127\.0\.0\.1:5173"$/m);
assert.match(core, /username TEXT UNIQUE, email TEXT, display_name TEXT, avatar_url TEXT, bio TEXT/);
assert.match(core, /FUNCTION public\.handle_new_user\(\)[\s\S]*?SECURITY DEFINER SET search_path = '';/);
assert.match(core, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE[\s\S]*profiles[\s\S]*TO authenticated;/);
assert.match(vault, /GRANT SELECT, INSERT ON TABLE account_logs TO authenticated;/);
assert.match(vaultEncryption, /IF EXISTS \(SELECT 1 FROM accounts LIMIT 1\)/);
assert.match(vaultEncryption, /DROP COLUMN service_name,[\s\S]*ADD COLUMN encrypted_payload TEXT NOT NULL/);
assert.match(vaultEncryption, /kdf_iterations INTEGER NOT NULL CHECK \(kdf_iterations BETWEEN 600000 AND 5000000\)/);
assert.match(vaultEncryption, /ALTER TABLE vault_config ENABLE ROW LEVEL SECURITY;/);
assert.match(vaultEncryption, /REVOKE ALL ON TABLE accounts, vault_config FROM anon, authenticated;/);
assert.match(vaultEncryption, /GRANT SELECT, INSERT ON TABLE vault_config TO authenticated;/);
assert.doesNotMatch(vaultEncryption, /vault_config_(?:update|delete)_own/);
assert.match(vaultEncryption, /DROP VIEW IF EXISTS tagged_items;[\s\S]*DROP TABLE IF EXISTS account_tags;/);
assert.doesNotMatch(vaultEncryption, /'account'::TEXT/);
assert.equal(
  (finance.match(/subcategory_id TEXT CHECK \(subcategory_id IS NULL OR BTRIM\(subcategory_id\) <> ''\)/g) || []).length,
  2,
);

console.log('database contract check: OK');

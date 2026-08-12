import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hook = readFileSync(new URL('../hooks/useAccounts.js', import.meta.url), 'utf8');

assert.match(hook, /const sessionRef = useRef\(0\);[\s\S]*const fetchRef = useRef\(0\);/);
assert.match(
  hook,
  /sessionRef\.current === session[\s\S]*fetchRef\.current === request[\s\S]*keyRef\.current === key/
);
assert.match(
  hook,
  /const lockVault = useCallback\(\(\) => \{\s*sessionRef\.current \+= 1;[\s\S]*keyRef\.current = null;[\s\S]*setItems\(\[\]\)/
);
assert.equal(
  (hook.match(/\.eq\('updated_at', item\.updated\)/g) || []).length,
  2,
  'both whole-row update and delete must use the loaded revision timestamp'
);
assert.match(hook, /\.update\(encrypted\)[\s\S]*\.select\('updated_at'\)[\s\S]*\.maybeSingle\(\)/);
assert.match(
  hook,
  /const payload = cleanItem\(item\);[\s\S]*encryptVaultItem\(key, userId, item\.id, payload\)[\s\S]*hydrateItem\([\s\S]*payload\)/,
  'local state must use the same normalized payload that was encrypted'
);
assert.doesNotMatch(
  hook,
  /await fetchAll\(\);/,
  'post-write refetch can restore a stale plaintext snapshot'
);
assert.match(
  hook,
  /if \(!data\) \{[\s\S]*count > 0[\s\S]*Vault configuration is missing/
);
// Gộp template 2026-08-11: item cũ lưu `tpl: 'login'` phải được alias sang
// `account` trong cleanItem — chạy cả lúc đọc và lúc ghi, nên item cũ hiện đúng
// loại và tự lưu key mới. Bỏ dòng này là item cũ rơi về kicker "Item · ···".
assert.match(
  hook,
  /tpl: item\.tpl === 'login' \? 'account' : \(item\.tpl \|\| 'account'\)/,
  'legacy tpl key must alias to the merged one inside cleanItem'
);
// Logo đi vào ciphertext nên payload phình là mỗi lần mở vault tải + giải mã lại.
// Cap PHẢI ở cleanItem (chỗ duy nhất mọi đường ghi đi qua), không chỉ ở UI.
assert.match(
  hook,
  /logo: typeof item\.logo === 'string' && item\.logo\.length <= LOGO_LIMIT/,
  'item logo must be size-capped where every write path passes through'
);

console.log('vault hook security contract: OK');

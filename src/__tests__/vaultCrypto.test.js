import assert from 'node:assert/strict';
import {
  createVaultConfig,
  decryptVaultItem,
  encryptVaultItem,
  unlockVaultKey,
  validateVaultPassphrase,
  VAULT_ENCRYPTION_VERSION,
  VAULT_KDF_ITERATIONS,
} from '../utils/vaultCrypto.js';

const userId = '00000000-0000-4000-8000-000000000001';
const otherUserId = '00000000-0000-4000-8000-000000000099';
const itemId = '00000000-0000-4000-8000-000000000002';
const passphrase = 'correct horse battery staple';

assert.throws(() => validateVaultPassphrase('too-short'), /at least 12/);

const { config, key } = await createVaultConfig(passphrase, userId);
assert.equal(config.kdf_iterations, VAULT_KDF_ITERATIONS);
assert.equal(config.encryption_version, VAULT_ENCRYPTION_VERSION);
assert.equal(JSON.stringify(config).includes(passphrase), false);

const unlockedKey = await unlockVaultKey(passphrase, userId, config);
await assert.rejects(
  unlockVaultKey('wrong passphrase long enough', userId, config),
  /Wrong passphrase/
);
await assert.rejects(
  unlockVaultKey(passphrase, otherUserId, config),
  /Wrong passphrase/
);

const payload = {
  schema: 1,
  title: 'Private bank',
  tpl: 'login',
  favorite: true,
  notes: 'Security answer: blue',
  tags: [{ id: 'tag-1', name: 'Finance', color: '#123456' }],
  fields: [{ id: 'field-1', label: 'Username', type: 'text', value: 'alice' }],
  auth: [{ id: 'auth-1', kind: 'totp', note: 'Phone', state: 'primary' }],
  codes: [{ id: 'code-1', code: 'abcd-1234', used: false }],
  log: [{ id: 'log-1', at: '2026-08-09T00:00:00.000Z', text: 'Created', detail: '' }],
};

const encrypted = await encryptVaultItem(key, userId, itemId, payload);
assert.equal(JSON.stringify(encrypted).includes('Private bank'), false);
assert.deepEqual(
  await decryptVaultItem(unlockedKey, userId, { id: itemId, ...encrypted }),
  payload
);

await assert.rejects(
  decryptVaultItem(unlockedKey, userId, { id: `${itemId}-wrong`, ...encrypted }),
  /Could not decrypt/
);
await assert.rejects(
  decryptVaultItem(unlockedKey, otherUserId, { id: itemId, ...encrypted }),
  /Could not decrypt/
);

const bytes = Uint8Array.from(atob(encrypted.encrypted_payload), (c) => c.charCodeAt(0));
bytes[0] ^= 1;
const tampered = btoa(String.fromCharCode(...bytes));
await assert.rejects(
  decryptVaultItem(unlockedKey, userId, {
    id: itemId,
    ...encrypted,
    encrypted_payload: tampered,
  }),
  /Could not decrypt/
);

const nonces = new Set();
for (let i = 0; i < 12; i++) {
  nonces.add((await encryptVaultItem(key, userId, itemId, { ...payload, i })).encryption_nonce);
}
assert.equal(nonces.size, 12);

console.log('vault crypto checks: OK');

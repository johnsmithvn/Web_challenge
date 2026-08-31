import assert from 'node:assert/strict';
import {
  createVaultConfig,
  decryptVaultItem,
  encryptVaultItem,
  unlockVaultKey,
  validateVaultPassphrase,
  rekeyVaultItems,
  VAULT_ENCRYPTION_VERSION,
  VAULT_KDF_ITERATIONS,
} from '../../utils/vaultCrypto.js';

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
  tpl: 'account',
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

// ── Cross-account re-keying test ──
const targetUserId = '00000000-0000-4000-8000-000000000003';
const targetPassphrase = 'target user unique secure passphrase';
const { key: targetKey, config: targetConfig } = await createVaultConfig(targetPassphrase, targetUserId);

const mockBackup = {
  format: 'lifehub-vault-v6.2',
  version: 1,
  userId,
  config,
  items: [{ id: itemId, ...encrypted }],
};

// 1. Wrong source passphrase -> rejects
await assert.rejects(
  rekeyVaultItems({
    backup: mockBackup,
    sourcePassphrase: 'wrong source passphrase',
    targetUserId,
    targetKey,
  }),
  /Wrong passphrase/
);

// 2. Correct source passphrase -> successfully re-keys into target user
const rekeyed = await rekeyVaultItems({
  backup: mockBackup,
  sourcePassphrase: passphrase,
  targetUserId,
  targetKey,
});
assert.equal(rekeyed.length, 1);
assert.equal(rekeyed[0].id, itemId);

// 3. Target user can decrypt the rekeyed item with target key and targetUserId!
const targetUnlockedKey = await unlockVaultKey(targetPassphrase, targetUserId, targetConfig);
const decryptedByTarget = await decryptVaultItem(targetUnlockedKey, targetUserId, rekeyed[0]);
assert.deepEqual(decryptedByTarget, payload);

// 4. Source user CANNOT decrypt the rekeyed item anymore
await assert.rejects(
  decryptVaultItem(unlockedKey, userId, rekeyed[0]),
  /Could not decrypt/
);

console.log('vault crypto checks: OK');

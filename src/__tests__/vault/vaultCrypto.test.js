import assert from 'node:assert/strict';
import {
  createVaultConfig,
  decryptVaultItem,
  encryptVaultItem,
  unlockVaultKey,
  validateVaultPassphrase,
  rekeyVaultItems,
  rotateVaultPassphrase,
  recoverVaultWithKey,
  generateRecoveryKey,
  VAULT_ENCRYPTION_VERSION,
  VAULT_KDF_ITERATIONS,
} from '../../utils/vaultCrypto.js';

const userId = '00000000-0000-4000-8000-000000000001';
const otherUserId = '00000000-0000-4000-8000-000000000099';
const itemId = '00000000-0000-4000-8000-000000000002';
const passphrase = 'correct horse battery staple';

assert.throws(() => validateVaultPassphrase('too-short'), /at least 12/);

const { config, key, recoveryKey } = await createVaultConfig(passphrase, userId);
assert.equal(config.kdf_iterations, VAULT_KDF_ITERATIONS);
assert.equal(config.encryption_version, VAULT_ENCRYPTION_VERSION);
assert.equal(JSON.stringify(config).includes(passphrase), false);
assert.ok(recoveryKey, 'createVaultConfig must return a recoveryKey');
assert.match(recoveryKey, /^LHV1(-[0-9A-F]{4}){8}$/);
assert.ok(config.recovery_wrapped_key, 'config must contain recovery_wrapped_key');
assert.ok(config.recovery_wrapped_key_nonce, 'config must contain recovery_wrapped_key_nonce');

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
assert.notEqual(rekeyed[0].id, itemId);
assert.match(rekeyed[0].id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

// 3. Target user can decrypt the rekeyed item with target key and targetUserId!
const targetUnlockedKey = await unlockVaultKey(targetPassphrase, targetUserId, targetConfig);
const decryptedByTarget = await decryptVaultItem(targetUnlockedKey, targetUserId, rekeyed[0]);
assert.deepEqual(decryptedByTarget, payload);

// 4. Source user CANNOT decrypt the rekeyed item anymore
await assert.rejects(
  decryptVaultItem(unlockedKey, userId, rekeyed[0]),
  /Could not decrypt/
);

// 5. Test internal item link remapping when multiple items are rekeyed
const item2Id = '00000000-0000-4000-8000-000000000009';
const payloadWithLink = {
  ...payload,
  title: 'Linked account',
  fields: [
    { id: 'f-link', label: 'Parent', type: 'link', value: 'Bank', links: [{ itemId, value: 'Primary' }] },
  ],
};
const encryptedItem2 = await encryptVaultItem(key, userId, item2Id, payloadWithLink);
const multiBackup = {
  format: 'lifehub-vault-v6.2',
  version: 1,
  userId,
  config,
  items: [
    { id: itemId, ...encrypted },
    { id: item2Id, ...encryptedItem2 },
  ],
};

const rekeyedMulti = await rekeyVaultItems({
  backup: multiBackup,
  sourcePassphrase: passphrase,
  targetUserId,
  targetKey,
});
assert.equal(rekeyedMulti.length, 2);

const decItem2 = await decryptVaultItem(targetUnlockedKey, targetUserId, rekeyedMulti[1]);
assert.equal(decItem2.fields[0].links[0].itemId, rekeyedMulti[0].id);
assert.notEqual(decItem2.fields[0].links[0].itemId, itemId);


// ── Passphrase rotation tests ──
const newPassphrase = 'brand new very secure passphrase 123';

// 1. Wrong current passphrase -> rejects
await assert.rejects(
  rotateVaultPassphrase('wrong current passphrase', newPassphrase, userId, config),
  /Current passphrase is incorrect/
);

// 2. New passphrase too short -> rejects
await assert.rejects(
  rotateVaultPassphrase(passphrase, 'short-pass', userId, config),
  /at least 12/
);

// 3. Rotate successfully
const rotated = await rotateVaultPassphrase(passphrase, newPassphrase, userId, config);
assert.equal(rotated.config.encryption_version, VAULT_ENCRYPTION_VERSION);
assert.notEqual(rotated.config.wrapped_key, config.wrapped_key);

// 4. Old passphrase can NO LONGER unlock the rotated config
await assert.rejects(
  unlockVaultKey(passphrase, userId, rotated.config),
  /Wrong passphrase/
);

// 5. New passphrase unlocks successfully!
const keyFromNewPass = await unlockVaultKey(newPassphrase, userId, rotated.config);

// 6. Old item encrypted before rotation is STILL DECRYPTABLE with keyFromNewPass!
const decryptedAfterRotation = await decryptVaultItem(keyFromNewPass, userId, { id: itemId, ...encrypted });
assert.deepEqual(decryptedAfterRotation, payload);

// ── Recovery Key tests ──
// 1. Wrong recovery key -> rejects
await assert.rejects(
  recoverVaultWithKey('LHV1-0000-0000-0000-0000-0000-0000-0000-0000', 'new recovery pass 123', userId, config),
  /không chính xác hoặc không khớp/
);

// 2. Short new passphrase -> rejects
await assert.rejects(
  recoverVaultWithKey(recoveryKey, 'short-pass', userId, config),
  /at least 12/
);

// 3. Successful recovery with Recovery Key
const recovered = await recoverVaultWithKey(recoveryKey, 'my brand new recovered passphrase 123', userId, config);
assert.ok(recovered.newRecoveryKey);
assert.notEqual(recovered.newRecoveryKey, recoveryKey);
assert.ok(recovered.config.wrapped_key);

// 4. Can unlock with new passphrase
const keyFromRecoveredPass = await unlockVaultKey('my brand new recovered passphrase 123', userId, recovered.config);

// 5. Old item is STILL DECRYPTABLE with keyFromRecoveredPass!
const decRecovered = await decryptVaultItem(keyFromRecoveredPass, userId, { id: itemId, ...encrypted });
assert.deepEqual(decRecovered, payload);

// 6. Old recovery key CANNOT be reused on the recovered config (old key invalidated)
await assert.rejects(
  recoverVaultWithKey(recoveryKey, 'attempt with old recovery key 123', userId, recovered.config),
  /không chính xác hoặc không khớp/
);

// 7. Old passphrase CANNOT unlock the recovered config
await assert.rejects(
  unlockVaultKey(passphrase, userId, recovered.config),
  /Wrong passphrase/
);

// 8. Missing recovery key in config -> rejects cleanly
await assert.rejects(
  recoverVaultWithKey(recoveryKey, 'attempt with missing config 123', userId, { ...config, recovery_wrapped_key: null }),
  /Chưa có mã khôi phục/
);

// 9. Case-insensitivity and formatting tolerance (dashes, spaces, lowercase)
const tolerantKey = recoveryKey.toLowerCase().replace(/-/g, ' ');
const recoveredTolerant = await recoverVaultWithKey(tolerantKey, 'yet another brand new passphrase 123', userId, config);
assert.ok(recoveredTolerant.config.wrapped_key);

console.log('vault crypto checks: OK');



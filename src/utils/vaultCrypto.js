const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const VAULT_ENCRYPTION_VERSION = 1;
export const VAULT_KDF_ALGORITHM = 'PBKDF2-SHA256';
export const VAULT_KDF_ITERATIONS = 600_000;
export const VAULT_MIN_PASSPHRASE_LENGTH = 12;

const MAX_KDF_ITERATIONS = 5_000_000;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const KEY_BYTES = 32;

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(`Invalid ${label}`);
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } catch {
    throw new Error(`Invalid ${label}`);
  }
}

function requireId(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(`${label} is required`);
}

function keyAad(userId, version) {
  return encoder.encode(`vault-key|v${version}|${userId}`);
}

function itemAad(userId, itemId, version) {
  return encoder.encode(`vault-item|v${version}|${userId}|${itemId}`);
}

function validateConfig(config) {
  if (!config || config.kdf_algorithm !== VAULT_KDF_ALGORITHM) {
    throw new Error('Unsupported vault KDF');
  }
  if (config.encryption_version !== VAULT_ENCRYPTION_VERSION) {
    throw new Error('Unsupported vault encryption version');
  }
  if (!Number.isInteger(config.kdf_iterations)
    || config.kdf_iterations < VAULT_KDF_ITERATIONS
    || config.kdf_iterations > MAX_KDF_ITERATIONS) {
    throw new Error('Invalid vault KDF iterations');
  }
}

export function validateVaultPassphrase(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < VAULT_MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Vault passphrase must be at least ${VAULT_MIN_PASSPHRASE_LENGTH} characters`);
  }
}

async function deriveKek(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey(
    'raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function importDek(raw) {
  if (raw.byteLength !== KEY_BYTES) throw new Error('Invalid vault key');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Create the per-user DEK and wrap it with a passphrase-derived KEK. */
export async function createVaultConfig(passphrase, userId) {
  validateVaultPassphrase(passphrase);
  requireId(userId, 'userId');

  const version = VAULT_ENCRYPTION_VERSION;
  const salt = randomBytes(SALT_BYTES);
  const wrapNonce = randomBytes(NONCE_BYTES);
  const rawDek = randomBytes(KEY_BYTES);
  const kek = await deriveKek(passphrase, salt, VAULT_KDF_ITERATIONS);
  const wrapped = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: wrapNonce, additionalData: keyAad(userId, version) },
    kek,
    rawDek
  );

  return {
    key: await importDek(rawDek),
    config: {
      user_id: userId,
      kdf_algorithm: VAULT_KDF_ALGORITHM,
      kdf_salt: toBase64(salt),
      kdf_iterations: VAULT_KDF_ITERATIONS,
      wrapped_key: toBase64(new Uint8Array(wrapped)),
      wrapped_key_nonce: toBase64(wrapNonce),
      encryption_version: version,
    },
  };
}

/** Derive the KEK again and unwrap the in-memory DEK. */
export async function unlockVaultKey(passphrase, userId, config) {
  validateVaultPassphrase(passphrase);
  requireId(userId, 'userId');
  validateConfig(config);

  const salt = fromBase64(config.kdf_salt, 'KDF salt');
  const nonce = fromBase64(config.wrapped_key_nonce, 'wrapped key nonce');
  const wrapped = fromBase64(config.wrapped_key, 'wrapped key');
  if (salt.byteLength !== SALT_BYTES || nonce.byteLength !== NONCE_BYTES) {
    throw new Error('Invalid vault configuration');
  }

  try {
    const kek = await deriveKek(passphrase, salt, config.kdf_iterations);
    const rawDek = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: keyAad(userId, config.encryption_version),
      },
      kek,
      wrapped
    );
    return importDek(new Uint8Array(rawDek));
  } catch {
    throw new Error('Wrong passphrase or damaged vault configuration');
  }
}

/** Encrypt one complete Vault item. Every user-authored property stays inside payload. */
export async function encryptVaultItem(key, userId, itemId, payload) {
  requireId(userId, 'userId');
  requireId(itemId, 'itemId');
  if (!key) throw new Error('Vault is locked');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid vault item payload');
  }

  const version = VAULT_ENCRYPTION_VERSION;
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: itemAad(userId, itemId, version) },
    key,
    encoder.encode(JSON.stringify(payload))
  );
  return {
    encrypted_payload: toBase64(new Uint8Array(ciphertext)),
    encryption_nonce: toBase64(nonce),
    encryption_version: version,
  };
}

/** Decrypt one row and authenticate its user/id/version binding through AES-GCM AAD. */
export async function decryptVaultItem(key, userId, row) {
  requireId(userId, 'userId');
  requireId(row?.id, 'itemId');
  if (!key) throw new Error('Vault is locked');
  if (row.encryption_version !== VAULT_ENCRYPTION_VERSION) {
    throw new Error('Unsupported vault item version');
  }

  const nonce = fromBase64(row.encryption_nonce, 'item nonce');
  if (nonce.byteLength !== NONCE_BYTES) throw new Error('Invalid item nonce');

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: itemAad(userId, row.id, row.encryption_version),
      },
      key,
      fromBase64(row.encrypted_payload, 'encrypted payload')
    );
    const payload = JSON.parse(decoder.decode(plaintext));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Invalid vault item payload');
    }
    return payload;
  } catch (error) {
    if (error.message === 'Invalid vault item payload') throw error;
    throw new Error(`Could not decrypt vault item ${row.id}`);
  }
}

/**
 * Re-key a foreign Vault backup for a new user.
 * Decrypts all items using the source passphrase and source userId,
 * then re-encrypts every item using the target user's key and target userId.
 */
export async function rekeyVaultItems({ backup, sourcePassphrase, targetUserId, targetKey }) {
  if (!backup?.config || !Array.isArray(backup?.items)) {
    throw new Error('Invalid backup structure');
  }
  requireId(backup.userId, 'sourceUserId');
  requireId(targetUserId, 'targetUserId');
  if (!targetKey) throw new Error('Target vault key is required');

  const sourceDek = await unlockVaultKey(sourcePassphrase, backup.userId, backup.config);

  // Map old item IDs to new random UUIDs so they never collide with the source user's rows in accounts table
  const idMap = new Map();
  for (const item of backup.items) {
    idMap.set(item.id, crypto.randomUUID());
  }

  // Decrypt all items first
  const decryptedItems = [];
  for (const item of backup.items) {
    const plaintext = await decryptVaultItem(sourceDek, backup.userId, item);
    decryptedItems.push({ oldId: item.id, newId: idMap.get(item.id), payload: plaintext });
  }

  // Update any internal links between items to point to the new IDs
  for (const { payload } of decryptedItems) {
    if (Array.isArray(payload?.fields)) {
      for (const field of payload.fields) {
        if (Array.isArray(field?.links)) {
          for (const link of field.links) {
            if (link?.itemId && idMap.has(link.itemId)) {
              link.itemId = idMap.get(link.itemId);
            }
          }
        }
      }
    }
  }

  // Re-encrypt each item with targetKey, targetUserId, and the new item ID
  const rekeyedItems = [];
  for (const { newId, payload } of decryptedItems) {
    const reencrypted = await encryptVaultItem(targetKey, targetUserId, newId, payload);
    rekeyedItems.push({
      id: newId,
      ...reencrypted,
    });
  }

  return rekeyedItems;
}

/**
 * Rotate the Vault passphrase.
 * Re-wraps the existing DEK with a new passphrase without modifying any encrypted items.
 */
export async function rotateVaultPassphrase(currentPassphrase, newPassphrase, userId, config) {
  validateVaultPassphrase(newPassphrase);
  requireId(userId, 'userId');
  validateConfig(config);

  const salt = fromBase64(config.kdf_salt, 'KDF salt');
  const nonce = fromBase64(config.wrapped_key_nonce, 'wrapped key nonce');
  const wrapped = fromBase64(config.wrapped_key, 'wrapped key');
  if (salt.byteLength !== SALT_BYTES || nonce.byteLength !== NONCE_BYTES) {
    throw new Error('Invalid vault configuration');
  }

  // 1. Unwrap raw DEK using current passphrase
  let rawDekBuffer;
  try {
    const oldKek = await deriveKek(currentPassphrase, salt, config.kdf_iterations);
    rawDekBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: keyAad(userId, config.encryption_version),
      },
      oldKek,
      wrapped
    );
  } catch {
    throw new Error('Current passphrase is incorrect');
  }

  // 2. Derive new KEK from new passphrase and re-wrap the SAME raw DEK
  const newSalt = randomBytes(SALT_BYTES);
  const newWrapNonce = randomBytes(NONCE_BYTES);
  const newKek = await deriveKek(newPassphrase, newSalt, VAULT_KDF_ITERATIONS);
  const newWrapped = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: newWrapNonce,
      additionalData: keyAad(userId, VAULT_ENCRYPTION_VERSION),
    },
    newKek,
    rawDekBuffer
  );

  return {
    key: await importDek(new Uint8Array(rawDekBuffer)),
    config: {
      ...config,
      user_id: userId,
      kdf_algorithm: VAULT_KDF_ALGORITHM,
      kdf_salt: toBase64(newSalt),
      kdf_iterations: VAULT_KDF_ITERATIONS,
      wrapped_key: toBase64(new Uint8Array(newWrapped)),
      wrapped_key_nonce: toBase64(newWrapNonce),
      encryption_version: VAULT_ENCRYPTION_VERSION,
    },
  };
}


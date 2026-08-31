import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { codeSheet, diffLog, newId } from '../utils/vaultLogic';
import {
  createVaultConfig,
  decryptVaultItem,
  encryptVaultItem,
  unlockVaultKey,
  rekeyVaultItems,
  rotateVaultPassphrase,
} from '../utils/vaultCrypto';
import ACCOUNT_TEMPLATES from '../data/account-templates.json';

const { templates: TEMPLATES, authKinds: AUTH_KINDS } = ACCOUNT_TEMPLATES;
const TPL_BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));
const AUTH_LABELS = Object.fromEntries(
  Object.entries(AUTH_KINDS).map(([key, value]) => [key, value.label])
);
const LOG_LIMIT = 500;
const ITEM_SCHEMA = 1;
// Logo item = data URI PNG 48×48 do canvas xuất ra (xem fileToLogo trong
// AccountDetail). Cap ở ĐÂY, không chỉ ở UI: cleanItem là chỗ duy nhất mọi đường
// ghi đều đi qua, và payload phình lên là mỗi lần mở vault phải tải + giải mã lại.
const LOGO_LIMIT = 16 * 1024;
const VAULT_CONFLICT = 'This Vault item changed in another session. Reload and unlock again before retrying.';
// Định dạng file backup. Bump VERSION khi shape đổi — restore từ chối version lạ
// thay vì đoán, vì đoán sai ở đây là ghi ciphertext không mở được.
const BACKUP_FORMAT = 'lifehub-vault-backup';
const BACKUP_VERSION = 1;

function cleanItem(item) {
  return {
    schema: ITEM_SCHEMA,
    title: item.title?.trim() || 'Untitled item',
    // Shim GIỮ LẠI VĨNH VIỄN: key `login` đã gộp vào `account` (v6.3.0) và pass
    // ghi lại hàng loạt đã chạy xong trên production, nhưng một dòng này là thứ
    // duy nhất chặn được trường hợp còn sót một item lưu key cũ — mất nó thì item
    // đó rơi về kicker "Item · ···" và biến khỏi chip filter. Giá bằng 0, đừng dọn.
    tpl: item.tpl === 'login' ? 'account' : (item.tpl || 'account'),
    favorite: !!item.favorite,
    logo: typeof item.logo === 'string' && item.logo.length <= LOGO_LIMIT ? item.logo : '',
    notes: item.notes || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    fields: Array.isArray(item.fields) ? item.fields : [],
    auth: Array.isArray(item.auth) ? item.auth : [],
    codes: Array.isArray(item.codes) ? item.codes : [],
    log: Array.isArray(item.log) ? item.log.slice(0, LOG_LIMIT) : [],
  };
}

function hydrateItem(row, payload) {
  if (payload.schema !== ITEM_SCHEMA) throw new Error('Unsupported Vault item schema');
  const clean = cleanItem(payload);
  return {
    id: row.id,
    ...clean,
    created: row.created_at,
    updated: row.updated_at,
  };
}

function addLogs(item, entries) {
  if (!entries.length) return item;
  const at = new Date().toISOString();
  return {
    ...item,
    log: [
      ...entries.map((entry) => ({
        id: newId(),
        at,
        text: entry.text,
        detail: entry.detail || '',
      })),
      ...(item.log || []),
    ].slice(0, LOG_LIMIT),
  };
}

/**
 * The only Vault data layer. All user-authored item content is one encrypted JSON
 * payload; the database row exposes only ownership, timestamps, nonce and version.
 * The unwrapped DEK lives in a ref and disappears on lock, sign-out or reload.
 */
export function useAccounts() {
  const { user } = useAuth();
  const enabled = isSupabaseEnabled && !!user;
  const userId = user?.id;

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [vaultStatus, setVaultStatus] = useState(enabled ? 'loading' : 'signed-out');
  const [vaultError, setVaultError] = useState('');
  const keyRef = useRef(null);
  const configRef = useRef(null);
  const sessionRef = useRef(0);
  const fetchRef = useRef(0);

  const fetchAll = useCallback(async (key = keyRef.current) => {
    if (!enabled || !key) return false;
    const session = sessionRef.current;
    const request = ++fetchRef.current;
    const isCurrent = () => (
      sessionRef.current === session
      && fetchRef.current === request
      && keyRef.current === key
    );
    setIsLoading(true);
    setVaultError('');
    try {
      const { data, error } = await supabase.from('accounts')
        .select('id, user_id, encrypted_payload, encryption_nonce, encryption_version, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      if (!isCurrent()) return false;

      const results = await Promise.allSettled((data || []).map(async (row) => (
        hydrateItem(row, await decryptVaultItem(key, userId, row))
      )));
      if (!isCurrent()) return false;
      const good = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
      const bad = results.length - good.length;
      setItems(good);
      if (bad) {
        setVaultError(`${bad} encrypted item${bad === 1 ? '' : 's'} could not be opened and were not modified.`);
      }
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      logger.error('[useAccounts] encrypted fetch error:', error.message);
      setVaultError('Could not load the encrypted Vault. Nothing was modified.');
      return false;
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [enabled, userId]);

  const loadVaultConfig = useCallback(async () => {
    if (!enabled) return;
    const session = ++sessionRef.current;
    fetchRef.current += 1;
    setVaultStatus('loading');
    setVaultError('');
    setItems([]);
    setIsLoading(false);
    keyRef.current = null;
    configRef.current = null;
    try {
      const { data, error } = await supabase.from('vault_config')
        .select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      if (sessionRef.current !== session) return;
      if (!data) {
        const { count, error: countError } = await supabase.from('accounts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);
        if (countError) throw countError;
        if (sessionRef.current !== session) return;
        if (count > 0) {
          setVaultError(
            'Vault configuration is missing while encrypted items still exist. '
            + 'Do not create a new passphrase or delete anything; restore the original vault_config.'
          );
          setVaultStatus('error');
          return;
        }
      }
      configRef.current = data;
      setVaultStatus(data ? 'locked' : 'setup');
    } catch (error) {
      if (sessionRef.current !== session) return;
      logger.error('[useAccounts] config error:', error.message);
      setVaultError('Vault encryption schema is not available yet. Run the v6.2 migration first.');
      setVaultStatus('error');
    }
  }, [enabled, userId]);

  useEffect(() => {
    if (enabled) loadVaultConfig();
    else {
      sessionRef.current += 1;
      fetchRef.current += 1;
      keyRef.current = null;
      configRef.current = null;
      setItems([]);
      setIsLoading(false);
      setVaultStatus('signed-out');
      setVaultError('');
    }
    return () => {
      sessionRef.current += 1;
      fetchRef.current += 1;
      keyRef.current = null;
      configRef.current = null;
    };
  }, [enabled, userId, loadVaultConfig]);

  const setupVault = useCallback(async (passphrase) => {
    if (!enabled || vaultStatus !== 'setup') return { ok: false, error: 'Vault cannot be set up now' };
    const session = sessionRef.current;
    try {
      const { data: existing } = await supabase.from('vault_config')
        .select('*').eq('user_id', userId).maybeSingle();
      if (existing) {
        configRef.current = existing;
        setVaultStatus('locked');
        return { ok: false, error: 'Vault is already configured for this account. Please unlock with your passphrase.' };
      }

      const { config, key } = await createVaultConfig(passphrase, userId);
      if (sessionRef.current !== session) {
        return { ok: false, error: 'Vault state changed; try again' };
      }
      const { error } = await supabase.from('vault_config').insert(config);
      if (error) throw error;
      if (sessionRef.current !== session) {
        return { ok: false, error: 'Vault state changed; try again' };
      }
      configRef.current = config;
      const unlockedSession = ++sessionRef.current;
      keyRef.current = key;
      setVaultStatus('loading');
      setVaultError('');
      const loaded = await fetchAll(key);
      if (sessionRef.current !== unlockedSession || keyRef.current !== key) {
        return { ok: false, error: 'Vault state changed; try again' };
      }
      if (!loaded) {
        keyRef.current = null;
        setItems([]);
        setVaultStatus('locked');
        return { ok: false, error: 'Could not load the encrypted Vault' };
      }
      setVaultStatus('unlocked');
      return { ok: true };
    } catch (error) {
      if (sessionRef.current !== session) {
        return { ok: false, error: 'Vault state changed; try again' };
      }
      logger.error('[useAccounts] setup error:', error.message);
      return { ok: false, error: error.message };
    }
  }, [enabled, userId, vaultStatus, fetchAll]);

  const unlockVault = useCallback(async (passphrase) => {
    if (!enabled || vaultStatus !== 'locked' || !configRef.current) {
      return { ok: false, error: 'Vault cannot be unlocked now' };
    }
    const session = sessionRef.current;
    const config = configRef.current;
    try {
      const key = await unlockVaultKey(passphrase, userId, config);
      if (sessionRef.current !== session || configRef.current !== config) {
        return { ok: false, error: 'Vault state changed; try again' };
      }
      const unlockedSession = ++sessionRef.current;
      keyRef.current = key;
      setVaultStatus('loading');
      setVaultError('');
      const loaded = await fetchAll(key);
      if (sessionRef.current !== unlockedSession || keyRef.current !== key) {
        return { ok: false, error: 'Vault state changed; try again' };
      }
      if (!loaded) {
        keyRef.current = null;
        setItems([]);
        setVaultStatus('locked');
        return { ok: false, error: 'Could not load the encrypted Vault' };
      }
      setVaultStatus('unlocked');
      return { ok: true };
    } catch (error) {
      if (sessionRef.current !== session) {
        return { ok: false, error: 'Vault state changed; try again' };
      }
      return { ok: false, error: error.message };
    }
  }, [enabled, userId, vaultStatus, fetchAll]);

  const changePassphrase = useCallback(async (currentPassphrase, newPassphrase) => {
    if (!enabled || !configRef.current) {
      return { ok: false, error: 'Vault is not ready' };
    }
    try {
      const { key: newKey, config: newConfig } = await rotateVaultPassphrase(
        currentPassphrase,
        newPassphrase,
        userId,
        configRef.current
      );
      const { error } = await supabase.from('vault_config')
        .update({
          kdf_algorithm: newConfig.kdf_algorithm,
          kdf_salt: newConfig.kdf_salt,
          kdf_iterations: newConfig.kdf_iterations,
          wrapped_key: newConfig.wrapped_key,
          wrapped_key_nonce: newConfig.wrapped_key_nonce,
          encryption_version: newConfig.encryption_version,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      if (error) throw error;
      configRef.current = newConfig;
      keyRef.current = newKey;
      return { ok: true };
    } catch (err) {
      logger.error('[useAccounts] changePassphrase error:', err.message);
      return { ok: false, error: err.message || 'Could not change passphrase' };
    }
  }, [enabled, userId]);

  /* ── Backup / restore ─────────────────────────────────────────────
     Export KHÔNG cần key: nó chỉ copy ciphertext + vault_config, nên sao lưu
     được cả khi Vault đang khoá. Chính vì thế file backup KHÔNG phải plaintext —
     ai lấy được nó vẫn cần passphrase gốc.

     ⚠️ AAD gắn CẢ wrapped key (`vault-key|v1|userId`) LẪN từng item
     (`vault-item|v1|userId|itemId`) vào user id — xem vaultCrypto.js. Nên backup
     PHẢI ghi `userId`, và restore phải chặn khi lệch: khôi phục sang account khác
     thì file mở ra bình thường mà không giải mã được gì. Phát hiện sau khi đã ghi
     là đúng loại "recovery giả" mà RULES cấm. */
  const exportVault = useCallback(async () => {
    if (!enabled) return { ok: false, error: 'Sign in before exporting.' };
    try {
      const config = await supabase.from('vault_config')
        .select('*').eq('user_id', userId).maybeSingle();
      if (config.error) throw config.error;
      if (!config.data) return { ok: false, error: 'There is no Vault to export yet.' };

      const rows = await supabase.from('accounts')
        .select('id, encrypted_payload, encryption_nonce, encryption_version')
        .eq('user_id', userId)
        .order('created_at');
      if (rows.error) throw rows.error;

      return {
        ok: true,
        backup: {
          format: BACKUP_FORMAT,
          version: BACKUP_VERSION,
          exportedAt: new Date().toISOString(),
          userId,
          config: config.data,
          items: rows.data || [],
        },
      };
    } catch (error) {
      logger.error('[useAccounts] export error:', error.message);
      return { ok: false, error: 'Could not read the Vault for export.' };
    }
  }, [enabled, userId]);

  const lockVault = useCallback(() => {
    sessionRef.current += 1;
    fetchRef.current += 1;
    keyRef.current = null;
    setItems([]);
    setIsLoading(false);
    setVaultError('');
    setVaultStatus(configRef.current ? 'locked' : 'setup');
  }, []);

  /* Restore CHỈ chạy vào Vault TRỐNG. Không xoá gì cả → không có đường mất data,
     nên không cần dialog "bạn có chắc". Cùng pattern migration v6.2 đã dùng
     (rollback nếu bảng không trống). Ghi đè một vault đang có item là nhu cầu
     khác và hiếm hơn nhiều; khi nào cần thì làm riêng, có confirm riêng. */
  /* Restore CHỈ chạy vào Vault TRỐNG. Không xoá gì cả → không có đường mất data,
     nên không cần dialog "bạn có chắc". Cùng pattern migration v6.2 đã dùng
     (rollback nếu bảng không trống). Ghi đè một vault đang có item là nhu cầu
     khác và hiếm hơn nhiều; khi nào cần thì làm riêng, có confirm riêng.
     Nếu backup thuộc user khác, yêu cầu sourcePassphrase để giải mã và re-encrypt
     sang user id mới trong RAM mà không lộ plaintext. */
  const restoreVault = useCallback(async (backup, options = {}) => {
    if (!enabled) return { ok: false, error: 'Sign in before restoring.' };
    if (backup?.format !== BACKUP_FORMAT) {
      return { ok: false, error: 'That file is not a Vault backup.' };
    }
    if (backup.version !== BACKUP_VERSION) {
      return {
        ok: false,
        error: `Backup format v${backup.version} is not supported by this build (expects v${BACKUP_VERSION}).`,
      };
    }
    const isDifferentUser = backup.userId !== userId;
    if (backup.userId !== userId) {
      if (!options?.sourcePassphrase) {
        return {
          ok: false,
          needSourcePassphrase: true,
          sourceUserId: backup.userId,
          itemCount: backup.items?.length || 0,
          error: 'This backup belongs to a different account. Its encryption is bound to the original '
            + 'user id, so nothing in it could be decrypted here.',
        };
      }
    }
    if (!backup.config?.wrapped_key && !backup.config?.wrapped_dek) {
      return { ok: false, error: 'Backup is missing its vault_config — it cannot be unlocked.' };
    }

    try {
      const { count, error: countError } = await supabase.from('accounts')
        .select('id', { count: 'exact', head: true }).eq('user_id', userId);
      if (countError) throw countError;
      if (count > 0) {
        return {
          ok: false,
          error: `Vault already holds ${count} item${count === 1 ? '' : 's'}. Restore only runs into an `
            + 'empty Vault so it can never overwrite anything — delete those items first.',
        };
      }

      // ── Cross-account re-keying ──
      if (isDifferentUser) {
        let targetKey = keyRef.current;
        let targetConfig = configRef.current;

        // Kiểm tra xem database đã có sẵn vault_config chưa nếu memory chưa tải
        if (!targetConfig) {
          const { data: existingConfig } = await supabase.from('vault_config')
            .select('*').eq('user_id', userId).maybeSingle();
          if (existingConfig) {
            targetConfig = existingConfig;
            configRef.current = existingConfig;
          }
        }

        // Nếu user hiện tại chưa có vault_config (chế độ setup):
        // Sinh cấu hình vault mới cho user hiện tại bằng targetPassphrase (hoặc dùng sourcePassphrase)
        if (!targetConfig) {
          const passphraseToUse = options.targetPassphrase || options.sourcePassphrase;
          const created = await createVaultConfig(passphraseToUse, userId);
          targetKey = created.key;
          targetConfig = created.config;
          const { error: cfgErr } = await supabase.from('vault_config')
            .insert(targetConfig);
          if (cfgErr) throw cfgErr;
          configRef.current = targetConfig;
        }

        if (!targetKey) {
          // Vault đã có config nhưng đang khóa: mở khóa bằng targetPassphrase (hoặc sourcePassphrase)
          const passphraseToUse = options.targetPassphrase || options.sourcePassphrase;
          try {
            targetKey = await unlockVaultKey(passphraseToUse, userId, targetConfig);
            keyRef.current = targetKey;
          } catch {
            return {
              ok: false,
              error: 'Current Vault passphrase is required to re-encrypt and import into this vault.',
            };
          }
        }

        // Tái mã hóa toàn bộ item từ user cũ sang user mới trong RAM
        const rekeyedItems = await rekeyVaultItems({
          backup,
          sourcePassphrase: options.sourcePassphrase,
          targetUserId: userId,
          targetKey,
        });

        if (rekeyedItems.length) {
          const { error: itemsError } = await supabase.from('accounts').insert(
            rekeyedItems.map((row) => ({
              id: row.id,
              user_id: userId,
              encrypted_payload: row.encrypted_payload,
              encryption_nonce: row.encryption_nonce,
              encryption_version: row.encryption_version,
            }))
          );
          if (itemsError) throw itemsError;
        }

        lockVault();
        return { ok: true, restored: rekeyedItems.length, rekeyed: true };
      }

      // ── Same-account standard restore ──
      if (!configRef.current) {
        const { error: configError } = await supabase.from('vault_config')
          .insert({ ...backup.config, user_id: userId });
        if (configError) throw configError;
      }

      if (backup.items.length) {
        // KHÔNG khôi phục created_at/updated_at: DB tự quản chúng và grant
        // least-privilege không cho ghi. Mốc thời gian thật nằm trong `log` bên
        // trong payload, không mất.
        const { error: itemsError } = await supabase.from('accounts').insert(
          backup.items.map((row) => ({
            id: row.id,
            user_id: userId,
            encrypted_payload: row.encrypted_payload,
            encryption_nonce: row.encryption_nonce,
            encryption_version: row.encryption_version,
          }))
        );
        if (itemsError) throw itemsError;
      }

      // Khoá lại: key đang giữ trong memory (nếu có) là của config CŨ. Bắt unlock
      // lại bằng passphrase của bản backup cũng là bước tự kiểm chứng backup dùng được.
      lockVault();
      return { ok: true, restored: backup.items.length };
    } catch (error) {
      logger.error('[useAccounts] restore error:', error.message);
      loadVaultConfig();
      return { ok: false, error: `Restore failed and nothing was replaced: ${error.message}` };
    }
  }, [enabled, userId, lockVault, loadVaultConfig]);


  const writeItem = useCallback(async (item) => {
    if (!enabled || !keyRef.current) throw new Error('Vault is locked');
    if (!item.updated) throw new Error('Vault item has no revision timestamp');
    const key = keyRef.current;
    const session = sessionRef.current;
    const isCurrent = () => sessionRef.current === session && keyRef.current === key;
    const payload = cleanItem(item);
    const encrypted = await encryptVaultItem(key, userId, item.id, payload);
    if (!isCurrent()) return null;

    const { data, error } = await supabase.from('accounts')
      .update(encrypted)
      .eq('id', item.id)
      .eq('user_id', userId)
      .eq('updated_at', item.updated)
      .select('updated_at')
      .maybeSingle();
    if (!isCurrent()) return null;
    if (error) throw error;
    if (!data) throw new Error(VAULT_CONFLICT);

    const saved = hydrateItem({
      id: item.id,
      created_at: item.created,
      updated_at: data.updated_at,
    }, payload);
    fetchRef.current += 1;
    setIsLoading(false);
    setItems((current) => [saved, ...current.filter((candidate) => candidate.id !== item.id)]);
    return saved;
  }, [enabled, userId]);

  const itemTitles = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item.title])),
    [items]
  );

  const saveItem = useCallback(async (draft) => {
    if (!enabled || !keyRef.current) return false;
    const original = items.find((item) => item.id === draft.id);
    if (!original) return false;
    try {
      const entries = diffLog(original, draft, { itemTitles, authLabels: AUTH_LABELS });
      return !!(await writeItem(addLogs({ ...draft, tags: draft.tags || [] }, entries)));
    } catch (error) {
      logger.error('[useAccounts] encrypted save error:', error.message);
      setVaultError(error.message === VAULT_CONFLICT
        ? VAULT_CONFLICT
        : 'Save failed. The previous encrypted item was not changed.');
      return false;
    }
  }, [enabled, items, itemTitles, writeItem]);

  const createItem = useCallback(async (tplKey) => {
    if (!enabled || !keyRef.current) return null;
    const tpl = TPL_BY_KEY.get(tplKey);
    if (!tpl) return null;
    const key = keyRef.current;
    const session = sessionRef.current;
    const isCurrent = () => sessionRef.current === session && keyRef.current === key;

    const id = newId();
    const item = addLogs({
      id,
      title: `New ${tpl.name.toLowerCase()}`,
      tpl: tplKey,
      favorite: false,
      notes: '',
      tags: [],
      fields: tpl.fields.map((field) => ({
        id: newId(), label: field.label, type: field.type, value: '', values: [], links: [],
      })),
      auth: (tpl.auth || []).map((kind, index) => ({
        id: newId(), kind, note: AUTH_KINDS[kind]?.note || '', state: index === 0 ? 'primary' : 'on',
      })),
      codes: tpl.codes ? codeSheet(tpl.codes) : [],
      log: [],
    }, [{ text: 'Item created', detail: `From template: ${tpl.name}` }]);

    try {
      const payload = cleanItem(item);
      const encrypted = await encryptVaultItem(key, userId, id, payload);
      if (!isCurrent()) return null;
      const { data, error } = await supabase.from('accounts')
        .insert({ id, user_id: userId, ...encrypted })
        .select('created_at, updated_at')
        .single();
      if (!isCurrent()) return null;
      if (error) throw error;
      const saved = hydrateItem({ id, ...data }, payload);
      fetchRef.current += 1;
      setIsLoading(false);
      setItems((current) => [saved, ...current.filter((candidate) => candidate.id !== id)]);
      return id;
    } catch (error) {
      if (!isCurrent()) return null;
      logger.error('[useAccounts] encrypted create error:', error.message);
      setVaultError('Could not create the encrypted item.');
      return null;
    }
  }, [enabled, userId]);

  const deleteItem = useCallback(async (id) => {
    if (!enabled || !keyRef.current) return false;
    const item = items.find((candidate) => candidate.id === id);
    if (!item?.updated) return false;
    const key = keyRef.current;
    const session = sessionRef.current;
    const isCurrent = () => sessionRef.current === session && keyRef.current === key;
    try {
      const { data, error } = await supabase.from('accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .eq('updated_at', item.updated)
        .select('id')
        .maybeSingle();
      if (!isCurrent()) return false;
      if (error) throw error;
      if (!data) throw new Error(VAULT_CONFLICT);
      fetchRef.current += 1;
      setIsLoading(false);
      setItems((current) => current.filter((item) => item.id !== id));
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      logger.error('[useAccounts] delete error:', error.message);
      setVaultError(error.message === VAULT_CONFLICT
        ? VAULT_CONFLICT
        : 'Delete failed. The encrypted item is still present.');
      return false;
    }
  }, [enabled, userId, items]);

  const toggleFavorite = useCallback(async (id) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return false;
    try {
      return !!(await writeItem({ ...item, favorite: !item.favorite }));
    } catch (error) {
      logger.error('[useAccounts] favorite error:', error.message);
      setVaultError(error.message === VAULT_CONFLICT
        ? VAULT_CONFLICT
        : 'Could not update the encrypted item.');
      return false;
    }
  }, [items, writeItem]);

  const setAuthState = useCallback(async (accountId, authId, state) => {
    const item = items.find((candidate) => candidate.id === accountId);
    const auth = item?.auth.find((candidate) => candidate.id === authId);
    if (!item || !auth || auth.state === state) return false;

    const next = structuredClone(item);
    if (state === 'primary') {
      next.auth.forEach((candidate) => {
        if (candidate.state === 'primary') candidate.state = 'on';
      });
    }
    next.auth.find((candidate) => candidate.id === authId).state = state;
    const label = AUTH_LABELS[auth.kind] || auth.kind;
    const verb = state === 'off' ? 'disabled' : state === 'primary' ? 'made primary' : 'enabled';
    try {
      return !!(await writeItem(addLogs(next, [{ text: `${label} ${verb}`, detail: auth.note }])));
    } catch (error) {
      logger.error('[useAccounts] auth state error:', error.message);
      setVaultError(error.message === VAULT_CONFLICT
        ? VAULT_CONFLICT
        : 'Could not update the encrypted sign-in method.');
      return false;
    }
  }, [items, writeItem]);

  const setCodeUsed = useCallback(async (accountId, codeId, used) => {
    const item = items.find((candidate) => candidate.id === accountId);
    const index = item?.codes.findIndex((code) => code.id === codeId) ?? -1;
    if (!item || index < 0) return false;

    const next = structuredClone(item);
    next.codes[index].used = used;
    const remaining = next.codes.filter((code) => !code.used).length;
    const number = String(index + 1).padStart(2, '0');
    try {
      return !!(await writeItem(addLogs(next, [{
        text: `Single-use code ${number} marked ${used ? 'used' : 'unused'}`,
        detail: `Sheet: ${remaining} of ${next.codes.length} remaining`,
      }])));
    } catch (error) {
      logger.error('[useAccounts] code error:', error.message);
      setVaultError(error.message === VAULT_CONFLICT
        ? VAULT_CONFLICT
        : 'Could not update the encrypted recovery code.');
      return false;
    }
  }, [items, writeItem]);

  return {
    items,
    isLoading,
    enabled,
    vaultStatus,
    vaultError,
    setupVault,
    unlockVault,
    lockVault,
    changePassphrase,
    exportVault,
    restoreVault,
    fetchAll,
    saveItem,
    createItem,
    deleteItem,
    toggleFavorite,
    setAuthState,
    setCodeUsed,
  };
}

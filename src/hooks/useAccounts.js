import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { diffLog, codeSheet } from '../utils/vaultLogic';
import ACCOUNT_TEMPLATES from '../data/account-templates.json';

/**
 * useAccounts — tầng dữ liệu của Account Vault v2 (thiết kế Keyplate).
 *
 * Đọc/ghi 6 bảng: accounts · account_fields · account_auth · account_codes ·
 * account_logs · account_tags. Xem data/migration_v5.2.0_vault.sql.
 *
 * ⚠️ CHƯA MÃ HOÁ. `account_fields.value` là PLAINTEXT trong Supabase; type
 *    password/secret chỉ mask trên UI.
 *
 * Hook này là NƠI DUY NHẤT biết shape của DB. Ra ngoài, mọi component và mọi
 * hàm trong vaultLogic.js chỉ thấy shape của đặc tả:
 *   service_name → title · multi_values → values · logged_at → at
 * Một hàm map ở đây rẻ hơn là để shape lệch nhau ở 8 component.
 *
 * Khác các hook khác: **KHÔNG có guest mode in-memory.** Vault mà mất khi
 * refresh thì vô nghĩa, và đây là dữ liệu riêng tư nhất trong app — chưa đăng
 * nhập thì trang hiện lời nhắc đăng nhập.
 *
 * ponytail: fetch TOÀN BỘ 6 bảng trong 5 query rồi ghép ở client. Đúng ở quy mô
 * vài trăm item của 1 người. Log bị chặn ở 500 dòng mới nhất (xem LOG_LIMIT);
 * phình hơn thì mới fetch log riêng theo item đang mở.
 */

const { templates: TEMPLATES, authKinds: AUTH_KINDS } = ACCOUNT_TEMPLATES;
const TPL_BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));
const AUTH_LABELS = Object.fromEntries(
  Object.entries(AUTH_KINDS).map(([k, v]) => [k, v.label])
);

// Log là bảng duy nhất phình vô hạn (append-only). Chi tiết chỉ hiện 4 dòng +
// "Show all n", nên lấy 500 dòng mới nhất của cả vault là quá đủ.
const LOG_LIMIT = 500;

/** Dòng DB → Field của đặc tả. jsonb có thể về dạng lạ nếu ai sửa tay → chặn. */
const toField = (f) => ({
  id: f.id,
  label: f.label,
  type: f.type,
  value: f.value || '',
  values: Array.isArray(f.multi_values) ? f.multi_values : [],
  links: Array.isArray(f.links) ? f.links : [],
});

/** Field của đặc tả → dòng DB. Chỉ ghi cột thuộc về loại đang dùng, tránh giữ
 *  rác của loại cũ khi user đổi type qua lại (multi → text → multi). */
const fromField = (f, i, userId, accountId) => ({
  user_id: userId,
  account_id: accountId,
  label: f.label?.trim() || 'Untitled field',
  type: f.type,
  value: f.type === 'multi' || f.type === 'link' ? null : (f.value || null),
  multi_values: f.type === 'multi' ? (f.values || []).filter((v) => v !== null) : [],
  links: f.type === 'link' ? (f.links || []) : [],
  sort_order: i,
});

export function useAccounts() {
  const { user } = useAuth();
  const enabled = isSupabaseEnabled && !!user;
  const userId = user?.id;

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  // ── Fetch + ghép 6 bảng thành items[] ───────────────────────
  const fetchAll = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const [accRes, fieldRes, authRes, codeRes, logRes] = await Promise.all([
        // Sắp theo `updated_at` GIẢM DẦN, không theo tên: item vừa tạo / vừa sửa
        // phải nằm đầu danh sách để kiểm soát được việc mình vừa làm. Đây cũng
        // là lý do mỗi dòng có cột thời gian ở bên phải. Muốn tìm theo tên thì
        // dùng ô search / chip filter, không dựa vào thứ tự.
        supabase.from('accounts')
          .select('*, account_tags(tag_id, tags(id, name, color))')
          .eq('user_id', userId).order('updated_at', { ascending: false }),
        supabase.from('account_fields').select('*')
          .eq('user_id', userId).order('sort_order', { ascending: true }),
        supabase.from('account_auth').select('*')
          .eq('user_id', userId).order('sort_order', { ascending: true }),
        supabase.from('account_codes').select('*')
          .eq('user_id', userId).order('sort_order', { ascending: true }),
        supabase.from('account_logs').select('*')
          .eq('user_id', userId).order('logged_at', { ascending: false }).limit(LOG_LIMIT),
      ]);

      for (const r of [accRes, fieldRes, authRes, codeRes, logRes]) {
        if (r.error) throw r.error;
      }

      // Gom con theo account_id một lượt (O(n)) thay vì filter lại cho từng item
      const group = (rows) => {
        const m = new Map();
        for (const r of rows || []) {
          if (!m.has(r.account_id)) m.set(r.account_id, []);
          m.get(r.account_id).push(r);
        }
        return m;
      };
      const byFields = group(fieldRes.data);
      const byAuth = group(authRes.data);
      const byCodes = group(codeRes.data);
      const byLogs = group(logRes.data);

      setItems((accRes.data || []).map((row) => ({
        id: row.id,
        tpl: row.tpl,
        title: row.service_name,
        favorite: row.favorite,
        notes: row.notes || '',
        updated: row.updated_at,
        created: row.created_at,
        tags: (row.account_tags || []).map((r) => r.tags).filter(Boolean),
        fields: (byFields.get(row.id) || []).map(toField),
        auth: (byAuth.get(row.id) || []).map((a) => ({
          id: a.id, kind: a.kind, note: a.note || '', state: a.state,
        })),
        codes: (byCodes.get(row.id) || []).map((c) => ({
          id: c.id, code: c.code, used: c.used,
        })),
        log: (byLogs.get(row.id) || []).map((l) => ({
          id: l.id, at: l.logged_at, text: l.text, detail: l.detail || '',
        })),
      })));
    } catch (err) {
      logger.warn('[useAccounts] fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, userId]);

  useEffect(() => {
    if (enabled && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchAll();
    }
    if (!enabled) {
      fetchedRef.current = false;
      setItems([]);
    }
  }, [enabled, fetchAll]);

  // { [itemId]: title } — diffLog cần để tả link ("Google — personal · a@x.com")
  const itemTitles = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i.title])),
    [items]
  );

  /**
   * Ghi thêm dòng log. Bảng account_logs chỉ có policy INSERT + SELECT nên đây
   * là đường ghi duy nhất và không có đường sửa/xoá.
   *
   * `touch` cũng chạm `accounts` để `updated_at` nhảy — bật/tắt một phương thức
   * đăng nhập cũng là "vừa sửa item này", và danh sách sắp theo `updated_at` nên
   * item đó phải lên đầu. Truyền `touch: false` khi row vừa được INSERT
   * (updated_at đã bằng created_at rồi, chạm nữa là một round-trip lãng phí).
   */
  const appendLogs = useCallback(async (accountId, entries, { touch = true } = {}) => {
    if (!entries.length) return;
    const { error } = await supabase.from('account_logs').insert(
      entries.map((e) => ({
        user_id: userId, account_id: accountId,
        text: e.text, detail: e.detail || null,
      }))
    );
    if (error) throw error;
    if (touch) {
      await supabase.from('accounts')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', accountId).eq('user_id', userId);
    }
  }, [userId]);

  /**
   * Lưu draft của một item đã tồn tại.
   *
   * ⚠️ diffLog được gọi Ở ĐÂY, không phải ở component: không tồn tại đường lưu
   *    mà không ghi log. Đó là "nothing may silently mutate an item without
   *    logging" của đặc tả, ép bằng cấu trúc chứ không bằng nhắc nhở.
   *
   * fields / auth / codes / tags dùng chiến lược **thay cả cụm** (xoá hết của
   * item đó rồi insert lại) thay vì diff từng dòng: mỗi item chỉ có vài chục
   * dòng, diff đắt hơn phần nó tiết kiệm. Hệ quả đã cân nhắc: id của các dòng
   * con đổi sau mỗi lần lưu — diffLog ghép field theo id nhưng chỉ trong PHẠM VI
   * một lần sửa (before và after cùng đến từ một lần fetch) nên không ảnh hưởng.
   *
   * @param {object} draft item đã sửa (shape đặc tả)
   * @param {string[]} tagIds
   * @return {Promise<boolean>}
   */
  const saveItem = useCallback(async (draft, tagIds = []) => {
    if (!enabled) return false;
    const original = items.find((i) => i.id === draft.id);
    if (!original) return false;

    try {
      const entries = diffLog(original, draft, { itemTitles, authLabels: AUTH_LABELS });

      const { error: accErr } = await supabase.from('accounts').update({
        service_name: draft.title?.trim() || 'Untitled item',
        tpl: draft.tpl,
        favorite: !!draft.favorite,
        notes: draft.notes?.trim() || null,
      }).eq('id', draft.id).eq('user_id', userId);
      if (accErr) throw accErr;

      await replaceChildren(draft.id, userId, draft);

      // Tag: thay cả cụm (bảng junction không có user_id, RLS kiểm qua 2 phía)
      const { error: tagDelErr } = await supabase.from('account_tags')
        .delete().eq('account_id', draft.id);
      if (tagDelErr) throw tagDelErr;
      if (tagIds.length) {
        const { error } = await supabase.from('account_tags')
          .insert(tagIds.map((tag_id) => ({ account_id: draft.id, tag_id })));
        if (error) throw error;
      }

      await appendLogs(draft.id, entries);
      await fetchAll();
      return true;
    } catch (err) {
      logger.error('[useAccounts] save error:', err.message);
      fetchAll();
      return false;
    }
  }, [enabled, userId, items, itemTitles, appendLogs, fetchAll]);

  /**
   * Tạo item mới từ một template. Field / phương thức đăng nhập / sheet mã đều
   * được điền sẵn theo template, phần tử auth đầu tiên thành `primary`.
   * @return {Promise<string|null>} id item mới
   */
  const createItem = useCallback(async (tplKey) => {
    if (!enabled) return null;
    const tpl = TPL_BY_KEY.get(tplKey);
    if (!tpl) return null;

    try {
      const { data, error } = await supabase.from('accounts')
        .insert({ user_id: userId, service_name: `New ${tpl.name.toLowerCase()}`, tpl: tplKey })
        .select('id').single();
      if (error) throw error;
      const id = data.id;

      // `fresh: true` — row vừa insert nên chưa có dòng con nào, bỏ 3 lệnh DELETE
      // của replaceChildren. Tạo item là chỗ user chờ lâu nhất, mỗi round-trip
      // cắt được đều thấy.
      await replaceChildren(id, userId, {
        fields: tpl.fields.map((f) => ({ label: f.label, type: f.type, value: '', values: [], links: [] })),
        auth: (tpl.auth || []).map((kind, i) => ({
          kind, note: AUTH_KINDS[kind]?.note || '', state: i === 0 ? 'primary' : 'on',
        })),
        codes: tpl.codes ? codeSheet(tpl.codes) : [],
      }, { fresh: true });

      await appendLogs(id, [{ text: 'Item created', detail: `From template: ${tpl.name}` }],
        { touch: false });
      await fetchAll();
      return id;
    } catch (err) {
      logger.error('[useAccounts] create error:', err.message);
      return null;
    }
  }, [enabled, userId, appendLogs, fetchAll]);

  // ── Xoá item (FK CASCADE dọn cả 5 bảng con) ──
  // Link TỚI nó thành orphan và hiện "Missing item" — đã cân nhắc, xem
  // migration_v5.2.0_vault.sql §2.
  const deleteItem = useCallback(async (id) => {
    if (!enabled) return false;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      const { error } = await supabase.from('accounts')
        .delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      // Refetch vì item khác đang trỏ tới nó vừa thành link chết
      await fetchAll();
      return true;
    } catch (err) {
      logger.error('[useAccounts] delete error:', err.message);
      fetchAll();
      return false;
    }
  }, [enabled, userId, fetchAll]);

  /** Bật/tắt favourite. Cố ý KHÔNG ghi log — đặc tả không coi đây là thay đổi
   *  nội dung item, và log sẽ đầy rác nếu mỗi lần bấm sao lại thành một dòng. */
  const toggleFavorite = useCallback(async (id) => {
    if (!enabled) return;
    const next = !items.find((i) => i.id === id)?.favorite;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, favorite: next } : i)));
    const { error } = await supabase.from('accounts')
      .update({ favorite: next }).eq('id', id).eq('user_id', userId);
    if (error) {
      logger.error('[useAccounts] favorite error:', error.message);
      fetchAll();
    }
  }, [enabled, userId, items, fetchAll]);

  /**
   * Đổi trạng thái một phương thức đăng nhập NGOÀI chế độ sửa (ghi log ngay).
   *
   * ⚠️ Nhánh 'primary' phải là MỘT câu UPDATE. Unique index
   *    `unique_account_auth_primary` chỉ được kiểm ở cuối câu lệnh, nên hạ
   *    primary cũ và nâng primary mới trong cùng một CASE là an toàn; tách
   *    thành hai câu UPDATE sẽ vi phạm ràng buộc ở giữa.
   */
  const setAuthState = useCallback(async (accountId, authId, state) => {
    if (!enabled) return false;
    const item = items.find((i) => i.id === accountId);
    const a = item?.auth.find((x) => x.id === authId);
    if (!a || a.state === state) return false;

    try {
      if (state === 'primary') {
        // supabase-js không gửi được UPDATE ... CASE, nên tách 2 lệnh theo
        // THỨ TỰ AN TOÀN: hạ primary cũ TRƯỚC rồi mới nâng cái mới. Ở giữa 2
        // lệnh item có 0 primary — unique index cho phép (nó ép "không quá 1",
        // không ép "đúng 1"). Đảo thứ tự lại thì lệnh nâng vi phạm ngay.
        // Nếu lệnh 2 lỗi thì item tạm thời không có primary, user bấm lại là xong.
        const { error: downErr } = await supabase.from('account_auth')
          .update({ state: 'on' })
          .eq('account_id', accountId).eq('user_id', userId).eq('state', 'primary');
        if (downErr) throw downErr;
      }
      const { error } = await supabase.from('account_auth')
        .update({ state }).eq('id', authId).eq('user_id', userId);
      if (error) throw error;

      const label = AUTH_LABELS[a.kind] || a.kind;
      const verb = state === 'off' ? 'disabled' : state === 'primary' ? 'made primary' : 'enabled';
      await appendLogs(accountId, [{ text: `${label} ${verb}`, detail: a.note }]);
      await fetchAll();
      return true;
    } catch (err) {
      logger.error('[useAccounts] auth state error:', err.message);
      fetchAll();
      return false;
    }
  }, [enabled, userId, items, appendLogs, fetchAll]);

  /**
   * Đánh dấu một mã dự phòng đã dùng / hoàn lại, NGOÀI chế độ sửa (ghi log ngay).
   * Dòng log thứ hai đếm số mã còn lại — đó là con số user thật sự cần.
   */
  const setCodeUsed = useCallback(async (accountId, codeId, used) => {
    if (!enabled) return false;
    const item = items.find((i) => i.id === accountId);
    const codes = item?.codes || [];
    const idx = codes.findIndex((c) => c.id === codeId);
    if (idx === -1) return false;

    try {
      const { error } = await supabase.from('account_codes')
        .update({ used }).eq('id', codeId).eq('user_id', userId);
      if (error) throw error;

      const remaining = codes.filter((c, i) => (i === idx ? !used : !c.used)).length;
      const num = String(idx + 1).padStart(2, '0');
      await appendLogs(accountId, [{
        text: `Single-use code ${num} marked ${used ? 'used' : 'unused'}`,
        detail: `Sheet: ${remaining} of ${codes.length} remaining`,
      }]);
      await fetchAll();
      return true;
    } catch (err) {
      logger.error('[useAccounts] code error:', err.message);
      fetchAll();
      return false;
    }
  }, [enabled, userId, items, appendLogs, fetchAll]);

  return {
    items,          // [Item] — shape đặc tả, đã ghép đủ fields/auth/codes/log/tags
    isLoading,
    enabled,
    fetchAll,       // () => Promise<void>
    saveItem,       // (draft, tagIds) => Promise<boolean>  — tự ghi diff log
    createItem,     // (tplKey) => Promise<id|null>
    deleteItem,     // (id) => Promise<boolean>
    toggleFavorite, // (id) => Promise<void>
    setAuthState,   // (accountId, authId, 'primary'|'on'|'off') => Promise<boolean>
    setCodeUsed,    // (accountId, codeId, used) => Promise<boolean>
  };
}

/**
 * Thay cả cụm con của một item: fields, auth, codes.
 * Tách khỏi hook vì cả saveItem và createItem đều cần đúng logic này, và nó
 * không đọc state nào — chỉ nhận vào rồi ghi.
 */
async function replaceChildren(accountId, userId, src, { fresh = false } = {}) {
  // `fresh` = row vừa được INSERT → chắc chắn chưa có dòng con nào, bỏ hẳn 3
  // lệnh DELETE thay vì gửi chúng đi để xoá 0 dòng.
  if (!fresh) {
    for (const table of ['account_fields', 'account_auth', 'account_codes']) {
      const { error } = await supabase.from(table)
        .delete().eq('account_id', accountId).eq('user_id', userId);
      if (error) throw error;
    }
  }

  const fields = (src.fields || [])
    // Field không nhãn VÀ không giá trị là dòng user thêm rồi bỏ dở → bỏ đi.
    // Có nhãn mà rỗng giá trị thì GIỮ: đó là field đang chờ điền, hợp lệ.
    .filter((f) => f.label?.trim() || f.value?.trim() || f.values?.length || f.links?.length)
    .map((f, i) => fromField(f, i, userId, accountId));
  if (fields.length) {
    const { error } = await supabase.from('account_fields').insert(fields);
    if (error) throw error;
  }

  const auth = (src.auth || []).map((a, i) => ({
    user_id: userId, account_id: accountId,
    kind: a.kind, note: a.note?.trim() || null, state: a.state, sort_order: i,
  }));
  if (auth.length) {
    const { error } = await supabase.from('account_auth').insert(auth);
    if (error) throw error;
  }

  const codes = (src.codes || []).map((c, i) => ({
    user_id: userId, account_id: accountId,
    code: c.code, used: !!c.used, sort_order: i,
  }));
  if (codes.length) {
    const { error } = await supabase.from('account_codes').insert(codes);
    if (error) throw error;
  }
}

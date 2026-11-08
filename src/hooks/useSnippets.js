import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { cleanSnippet } from '../utils/snippetUtils';

/**
 * useSnippets — CRUD cho Sổ lệnh của Knowledge (bảng `snippets`).
 * Danh sách nhỏ, tải một lần; nhóm / tìm / Hay dùng tính ở snippetUtils.
 */
const loadSnippets = userId => supabase
  .from('snippets')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: true });

export function useSnippets() {
  const { user } = useAuth();
  const enabled = isSupabaseEnabled && !!user;
  const userId = user?.id;

  // Danh sách nhớ của user nào: phản hồi trễ của user trước không lọt vào (như useCollectionTopics).
  const [state, setState] = useState({ userId: null, list: [] });
  const snippets = useMemo(
    () => (enabled && state.userId === userId ? state.list : []),
    [enabled, userId, state],
  );
  const isLoading = enabled && state.userId !== userId;
  const setList = useCallback(fn => setState(prev => ({ ...prev, list: fn(prev.list) })), []);

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    loadSnippets(userId).then(({ data, error }) => {
      if (!live) return;
      if (error) logger.error('[useSnippets] fetch error:', error.message);
      setState({ userId, list: error ? [] : data || [] });
    });
    return () => { live = false; };
  }, [enabled, userId]);

  /** @returns {Promise<{ snippet?: Object, error?: string }>} */
  const addSnippet = useCallback(async (draft) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { value, error: invalid } = cleanSnippet(draft);
    if (invalid) return { error: invalid };
    const { data, error } = await supabase.from('snippets').insert({ ...value, user_id: userId }).select().single();
    if (error) {
      logger.error('[useSnippets] add error:', error.message);
      return { error: 'Không lưu được lệnh. Thử lại.' };
    }
    setList(prev => [...prev, data]);
    return { snippet: data };
  }, [enabled, userId, setList]);

  /** Sửa. Optimistic, lỗi thì trả lại bản cũ. @returns {Promise<{ error?: string }>} */
  const updateSnippet = useCallback(async (id, draft) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { value, error: invalid } = cleanSnippet(draft);
    if (invalid) return { error: invalid };
    const backup = snippets;
    setList(prev => prev.map(s => (s.id === id ? { ...s, ...value } : s)));
    const { error } = await supabase.from('snippets').update(value).eq('id', id).eq('user_id', userId);
    if (error) {
      logger.error('[useSnippets] update error:', error.message);
      setList(() => backup);
      return { error: 'Không lưu được lệnh. Thử lại.' };
    }
    return {};
  }, [enabled, userId, snippets, setList]);

  /** Xoá hẳn (người gọi đã hỏi xác nhận). Optimistic, lỗi thì trả lại. */
  const deleteSnippet = useCallback(async (id) => {
    if (!enabled) return false;
    const backup = snippets;
    setList(prev => prev.filter(s => s.id !== id));
    const { error } = await supabase.from('snippets').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      logger.error('[useSnippets] delete error:', error.message);
      setList(() => backup);
      return false;
    }
    return true;
  }, [enabled, userId, snippets, setList]);

  /** Đếm một lần copy cho mục "Hay dùng". Lỗi thì chỉ trả lại số cũ, không báo user. */
  const countCopy = useCallback(async (id) => {
    const current = snippets.find(s => s.id === id);
    if (!enabled || !current) return;
    const next = current.copy_count + 1;
    setList(prev => prev.map(s => (s.id === id ? { ...s, copy_count: next } : s)));
    const { error } = await supabase.from('snippets').update({ copy_count: next }).eq('id', id).eq('user_id', userId);
    if (error) {
      logger.error('[useSnippets] copy count error:', error.message);
      setList(prev => prev.map(s => (s.id === id ? { ...s, copy_count: current.copy_count } : s)));
    }
  }, [enabled, userId, snippets, setList]);

  return {
    snippets,      // theo thứ tự tạo
    isLoading,
    addSnippet,    // (draft) => Promise<{snippet?, error?}>
    updateSnippet, // (id, draft) => Promise<{error?}>
    deleteSnippet, // (id) => Promise<boolean>
    countCopy,     // (id) => Promise<void>
  };
}

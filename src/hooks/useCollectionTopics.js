import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * useCollectionTopics — CRUD for Knowledge topics (`collection_topics`).
 *
 * A bài has at most one topic (`collections.topic_id`); a user has at most MAX_TOPICS.
 * The limit lives in the DB too (trigger), so the client check is only for a friendly message.
 * Deleting a topic sends its bài back to "Chưa xếp" (FK ON DELETE SET NULL).
 * The starter set is defined once, in SQL (`seed_starter_collection_topics`).
 */
export const MAX_TOPICS = 8;

const byOrder = (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name);

const loadTopics = userId => supabase
  .from('collection_topics')
  .select('*')
  .eq('user_id', userId)
  .order('sort_order', { ascending: true });

export function useCollectionTopics() {
  const { user } = useAuth();
  const enabled = isSupabaseEnabled && !!user;
  const userId = user?.id;

  // The list remembers whose it is: a late response for a previous user never shows up,
  // and "loading" is simply "no list for this user yet".
  const [state, setState] = useState({ userId: null, list: [] });
  const topics = useMemo(
    () => (enabled && state.userId === userId ? state.list : []),
    [enabled, userId, state],
  );
  const isLoading = enabled && state.userId !== userId;
  const setTopics = useCallback(fn => setState(prev => ({ ...prev, list: fn(prev.list) })), []);

  // On error keep what this user already had; a first load that fails ends as an empty list.
  const applyFetch = useCallback((forUser, { data, error }) => {
    if (error) logger.error('[useCollectionTopics] fetch error:', error.message);
    setState(prev => (error && prev.userId === forUser ? prev : { userId: forUser, list: error ? [] : data || [] }));
  }, []);

  const fetchTopics = useCallback(async () => {
    if (enabled) applyFetch(userId, await loadTopics(userId));
  }, [enabled, userId, applyFetch]);

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    loadTopics(userId).then(res => { if (live) applyFetch(userId, res); });
    return () => { live = false; };
  }, [enabled, userId, applyFetch]);

  /** Create the 7 starter topics — only takes effect when the user has none. */
  const seedStarterTopics = useCallback(async () => {
    if (!enabled) return false;
    const { error } = await supabase.rpc('seed_starter_collection_topics', { p_user: userId });
    if (error) {
      logger.error('[useCollectionTopics] seed error:', error.message);
      return false;
    }
    await fetchTopics();
    return true;
  }, [enabled, userId, fetchTopics]);

  /** @returns {{ topic?: Object, error?: string }} */
  const addTopic = useCallback(async ({ name, description = '', color = '#8b5cf6' }) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const clean = name.trim();
    if (!clean) return { error: 'Tên chủ đề không được trống.' };
    if (topics.length >= MAX_TOPICS) return { error: `Tối đa ${MAX_TOPICS} chủ đề. Gộp bớt trước khi tạo thêm.` };

    const sortOrder = Math.max(0, ...topics.map(t => t.sort_order)) + 1;
    const { data, error } = await supabase
      .from('collection_topics')
      .insert({ user_id: userId, name: clean, description: description.trim(), color, sort_order: sortOrder })
      .select()
      .single();
    if (error) {
      logger.error('[useCollectionTopics] add error:', error.message);
      return { error: error.code === '23505' ? 'Đã có chủ đề trùng tên.' : error.message };
    }
    setTopics(prev => [...prev, data].sort(byOrder));
    return { topic: data };
  }, [enabled, userId, topics, setTopics]);

  /** Rename / redescribe / recolor / reorder. Optimistic, rolls back on error. */
  const updateTopic = useCallback(async (id, updates) => {
    if (!enabled) return false;
    const backup = topics;
    const clean = { ...updates };
    if (clean.name !== undefined) clean.name = clean.name.trim();
    if (clean.description !== undefined) clean.description = clean.description.trim();

    setTopics(prev => prev.map(t => (t.id === id ? { ...t, ...clean } : t)).sort(byOrder));
    const { error } = await supabase.from('collection_topics').update(clean).eq('id', id).eq('user_id', userId);
    if (error) {
      logger.error('[useCollectionTopics] update error:', error.message);
      setTopics(() => backup);
      return false;
    }
    return true;
  }, [enabled, userId, topics, setTopics]);

  /** New order (every topic id, top first) → sort_order 1..n; only changed rows are written. Optimistic; refetches on error. */
  const reorderTopics = useCallback(async (ids) => {
    if (!enabled) return false;
    const rank = new Map(ids.map((id, i) => [id, i + 1]));
    const changed = topics.filter(t => rank.has(t.id) && t.sort_order !== rank.get(t.id));
    if (!changed.length) return true;

    setTopics(prev => prev.map(t => (rank.has(t.id) ? { ...t, sort_order: rank.get(t.id) } : t)).sort(byOrder));
    const results = await Promise.all(changed.map(t => supabase
      .from('collection_topics').update({ sort_order: rank.get(t.id) }).eq('id', t.id).eq('user_id', userId)));
    const failed = results.find(r => r.error);
    if (failed) {
      logger.error('[useCollectionTopics] reorder error:', failed.error.message);
      await fetchTopics();
      return false;
    }
    return true;
  }, [enabled, userId, topics, setTopics, fetchTopics]);

  /** Delete a topic; its bài become "Chưa xếp" in the DB. Caller refetches collections. */
  const deleteTopic = useCallback(async (id) => {
    if (!enabled) return false;
    const { error } = await supabase.from('collection_topics').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      logger.error('[useCollectionTopics] delete error:', error.message);
      return false;
    }
    setTopics(prev => prev.filter(t => t.id !== id));
    return true;
  }, [enabled, userId, setTopics]);

  /** Move every bài of `fromId` into `toId`, then delete `fromId` — one transaction. Caller refetches collections. */
  const mergeTopics = useCallback(async (fromId, toId) => {
    if (!enabled) return false;
    const { error } = await supabase.rpc('merge_collection_topics', { p_from: fromId, p_to: toId });
    if (error) {
      logger.error('[useCollectionTopics] merge error:', error.message);
      return false;
    }
    setTopics(prev => prev.filter(t => t.id !== fromId));
    return true;
  }, [enabled, setTopics]);

  return {
    topics,            // sorted by sort_order
    isLoading,
    fetchTopics,
    seedStarterTopics, // () => Promise<boolean>
    addTopic,          // ({name, description?, color?}) => Promise<{topic?, error?}>
    updateTopic,       // (id, updates) => Promise<boolean>
    reorderTopics,     // (ids in new order) => Promise<boolean>
    deleteTopic,       // (id) => Promise<boolean>
    mergeTopics,       // (fromId, toId) => Promise<boolean>
  };
}

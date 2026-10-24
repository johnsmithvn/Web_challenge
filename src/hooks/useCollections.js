import { useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * useCollections — CRUD for the `collections` table (Knowledge bài).
 *
 * type: note | quote | podcast (older rows may still hold learn / idea / ai / entertainment).
 * topic_id: chủ đề, see useCollectionTopics. NULL = Chưa xếp.
 * status: unread (chưa đọc xong) | read | archived.
 *
 * Fetched items carry: _tags, _linkedTaskIds, _linkedTaskCount, _notes ({content}[]), _noteCount.
 *
 * Used by: CollectPage, TaskListSection (for linking).
 */
export function useCollections() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;

  const [items, setItems]       = useState([]);
  // Bắt đầu ở true khi có user: CollectPage gọi fetchItems trong effect, frame đầu không được hiện kho rỗng.
  const [isLoading, setIsLoading] = useState(enabled);

  // ── Fetch items (recent 500) with tags, linked tasks and notes ──
  // filters: { type?, status?, includeArchived? } — archived rows are skipped unless asked for.
  const fetchItems = useCallback(async (filters = {}) => {
    if (!enabled) return;
    setIsLoading(true);

    let query = supabase
      .from('collections')
      .select('*, collection_tags(tags(id, name, color)), task_collections(task_id), collection_notes(content)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.status) query = query.eq('status', filters.status);
    else if (!filters.includeArchived) query = query.neq('status', 'archived');

    const { data, error } = await query;
    if (error) {
      logger.warn('[useCollections] fetch error:', error.message);
    } else {
      setItems((data || []).map(({ collection_tags, task_collections, collection_notes, ...item }) => {
        const _linkedTaskIds = (task_collections || []).map(tc => tc.task_id);
        const _notes = collection_notes || [];
        return {
          ...item,
          _tags: (collection_tags || []).map(ct => ct.tags).filter(Boolean),
          _linkedTaskIds,
          _linkedTaskCount: _linkedTaskIds.length,
          _notes,
          _noteCount: _notes.length,
        };
      }));
    }
    setIsLoading(false);
  }, [enabled, user]);

  // ── Add item ────────────────────────────────────────────────
  const addItem = useCallback(async (item) => {
    if (!enabled) return null;

    const newItem = {
      user_id:        user.id,
      type:           item.type    || 'note',
      topic_id:       item.topic_id || null,
      title:          item.title,
      url:            item.url     || null,
      body:           item.body    || '',
      body_text:      item.body_text || '',
      word_count:     item.word_count || 0,
      content_format: item.content_format || 'markdown',
      source:         item.source  || null,
      status:         item.status  || 'unread',
    };

    try {
      const { data, error } = await supabase
        .from('collections')
        .insert(newItem)
        .select()
        .single();

      if (error) {
        logger.error('[useCollections] addItem DB error:', error.message, error.details, error.hint);
        throw error;
      }

      // Same shape as fetched items
      const shaped = { ...data, _tags: [], _linkedTaskIds: [], _linkedTaskCount: 0, _notes: [], _noteCount: 0 };
      setItems(prev => [shaped, ...prev]);
      return data;
    } catch (err) {
      logger.error('[useCollections] addItem failed:', err.message);
      return null;
    }
  }, [enabled, user]);

  // ── Update item (type, status, tags, body, etc.) ────────────
  const updateItem = useCallback(async (id, updates) => {
    if (!enabled) return false;

    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));

    try {
      const { error } = await supabase
        .from('collections')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (err) {
      logger.warn('[useCollections] update error:', err.message);
      // Rollback: refetch
      fetchItems();
      return false;
    }
  }, [enabled, user, fetchItems]);

  // ── Delete item ─────────────────────────────────────────────
  const deleteItem = useCallback(async (id) => {
    if (!enabled) return false;

    // Optimistic
    setItems(prev => prev.filter(item => item.id !== id));

    try {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (err) {
      logger.warn('[useCollections] delete error:', err.message);
      fetchItems();
      return false;
    }
  }, [enabled, user, fetchItems]);

  // ── Stats nhẹ cho ô Knowledge ở Trang chủ ─────────────────────
  // Đếm mục chưa lưu trữ + ngày tạo các mục từ `sinceDate` — chỉ 1 cột, không kéo nội
  // dung/tag như fetchItems (Trang chủ không cần cả bài viết chỉ để vẽ vài cột).
  const fetchStats = useCallback(async (sinceDate) => {
    if (!enabled) return null;
    try {
      const [all, recent] = await Promise.all([
        supabase.from('collections').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).neq('status', 'archived'),
        supabase.from('collections').select('created_at')
          .eq('user_id', user.id).neq('status', 'archived')
          .gte('created_at', `${sinceDate}T00:00:00`).limit(1000),
      ]);
      if (all.error || recent.error) throw all.error || recent.error;
      return { total: all.count || 0, createdAt: (recent.data || []).map(row => row.created_at) };
    } catch (err) {
      logger.warn('[useCollections] stats error:', err.message);
      return null;
    }
  }, [enabled, user]);

  return {
    items,         // current fetched items
    isLoading,
    fetchItems,    // (filters?) => Promise<void>
    fetchStats,    // (sinceDate) => Promise<{ total, createdAt[] } | null>
    addItem,       // (item) => Promise<row|null>
    updateItem,    // (id, updates) => Promise<boolean>
    deleteItem,    // (id) => Promise<boolean>
    enabled,       // boolean
  };
}

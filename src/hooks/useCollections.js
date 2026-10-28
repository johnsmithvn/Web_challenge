import { useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * useCollections — CRUD for the `collections` table (Knowledge bài).
 *
 * type: note | quote | podcast (older rows may still hold learn / idea / ai / entertainment).
 * topic_id: chủ đề, see useCollectionTopics. NULL = Chưa xếp.
 * status: unread | read | archived (DB values; the Knowledge UI saves read). archived = Thùng rác:
 * `items` never holds them, they live in `trash` until restored or deleted for good.
 *
 * Fetched items carry: _tags, _linkedTaskIds, _linkedTaskCount, _notes ({content}[]), _noteCount.
 *
 * Used by: CollectPage, HomeDashboard (fetchStats).
 */
export function useCollections() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;

  const [items, setItems]       = useState([]);
  const [trash, setTrash]       = useState([]); // status archived, bỏ gần nhất trước
  // Bắt đầu ở true khi có user: CollectPage gọi fetchItems trong effect, frame đầu không được hiện kho rỗng.
  const [isLoading, setIsLoading] = useState(enabled);

  // ── Fetch items + trash (recent 500, one query) with tags, linked tasks and notes ──
  // Trash rows come fully shaped so restoring one needs no refetch.
  // ponytail: trash counts toward the 500 limit; give it its own query if it ever crowds the kho out.
  const fetchItems = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from('collections')
      .select('*, collection_tags(tags(id, name, color)), task_collections(task_id), collection_notes(content)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      logger.warn('[useCollections] fetch error:', error.message);
    } else {
      const all = (data || []).map(({ collection_tags, task_collections, collection_notes, ...item }) => {
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
      });
      setItems(all.filter(i => i.status !== 'archived'));
      // updated_at (trigger) đổi khi bỏ vào thùng rác → dùng làm "ngày bỏ"
      setTrash(all.filter(i => i.status === 'archived')
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
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

  // ── Update many items with the same change (one request) ────
  const updateItems = useCallback(async (ids, updates) => {
    if (!enabled || ids.length === 0) return false;
    const idSet = new Set(ids);

    setItems(prev => prev.map(item => (idSet.has(item.id) ? { ...item, ...updates } : item)));

    const { error } = await supabase
      .from('collections')
      .update(updates)
      .in('id', ids)
      .eq('user_id', user.id);
    if (error) {
      logger.warn('[useCollections] bulk update error:', error.message);
      fetchItems();
      return false;
    }
    return true;
  }, [enabled, user, fetchItems]);

  // ── Thùng rác ───────────────────────────────────────────────
  // Bỏ vào / khôi phục = chỉ đổi status (bài giữ id, thẻ, ghi chú, liên kết task, ngày tạo).
  // `list` là bài đầy đủ (từ items / trash) để chuyển ngay giữa hai danh sách.
  const setTrashed = useCallback(async (list, trashed) => {
    if (!enabled || list.length === 0) return false;
    const ids = list.map(i => i.id);
    const idSet = new Set(ids);
    const status = trashed ? 'archived' : 'read';
    const moved = list.map(i => ({ ...i, status, updated_at: new Date().toISOString() }));
    const [setFrom, setTo] = trashed ? [setItems, setTrash] : [setTrash, setItems];
    setFrom(prev => prev.filter(i => !idSet.has(i.id)));
    // Bỏ bài đã có ở đích: bấm Hoàn tác sau khi đã ⌘Z không được nhân đôi bài
    setTo(prev => [...moved.filter(m => !prev.some(i => i.id === m.id)), ...prev]);

    const { error } = await supabase
      .from('collections')
      .update({ status })
      .in('id', ids)
      .eq('user_id', user.id);
    if (error) {
      logger.warn('[useCollections] trash move error:', error.message);
      fetchItems();
      return false;
    }
    return true;
  }, [enabled, user, fetchItems]);

  const moveToTrash = useCallback(list => setTrashed(list, true), [setTrashed]);
  const restoreFromTrash = useCallback(list => setTrashed(list, false), [setTrashed]);

  // Xoá vĩnh viễn (chỉ từ thùng rác) — ghi chú, thẻ, liên kết task đi theo FK cascade
  const deleteForever = useCallback(async (ids) => {
    if (!enabled || ids.length === 0) return false;
    const idSet = new Set(ids);
    setTrash(prev => prev.filter(i => !idSet.has(i.id)));

    const { error } = await supabase
      .from('collections')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id);
    if (error) {
      logger.warn('[useCollections] delete error:', error.message);
      fetchItems();
      return false;
    }
    return true;
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
    items,         // current fetched items (not in trash)
    trash,         // Thùng rác, bỏ gần nhất trước
    isLoading,
    fetchItems,    // () => Promise<void>
    fetchStats,    // (sinceDate) => Promise<{ total, createdAt[] } | null>
    addItem,       // (item) => Promise<row|null>
    updateItem,    // (id, updates) => Promise<boolean>
    updateItems,   // (ids, updates) => Promise<boolean>
    moveToTrash,      // (items[]) => Promise<boolean>
    restoreFromTrash, // (items[]) => Promise<boolean>
    deleteForever,    // (ids[]) => Promise<boolean>
    enabled,       // boolean
  };
}

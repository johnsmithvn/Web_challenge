import { useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * useCollections — CRUD for the `collections` table.
 *
 * Types: the seven keys in `src/data/knowledge.json`.
 * Status: unread | read | archived.
 *
 * Used by: CollectPage (Knowledge types), TaskListSection (for linking).
 */
export function useCollections() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;

  const [items, setItems]       = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch all items (recent 500) — joins collection_tags + task_collections ──
  const fetchItems = useCallback(async (filters = {}) => {
    if (!enabled) return;
    setIsLoading(true);

    const applyFilters = (q, f) => {
      if (f.type)   q = q.eq('type', f.type);
      if (f.status) q = q.eq('status', f.status);
      else          q = q.neq('status', 'archived');
      return q;
    };

    try {
      let joinLevel = 'full'; // full | tags-only | none

      // Step 1: Try with both collection_tags + task_collections (v4.5.0)
      let query = supabase
        .from('collections')
        .select('*, collection_tags(tag_id, tags(id, name, color)), task_collections(task_id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      query = applyFilters(query, filters);

      let { data, error } = await query;

      // Step 2: Fallback without task_collections (keeps collection_tags)
      if (error) {
        logger.warn('[useCollections] full join failed, trying tags-only:', error.message);
        joinLevel = 'tags-only';
        let q2 = supabase
          .from('collections')
          .select('*, collection_tags(tag_id, tags(id, name, color))')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(500);
        q2 = applyFilters(q2, filters);
        const r2 = await q2;

        if (r2.error) {
          // Step 3: Plain select (no joins at all)
          logger.warn('[useCollections] tags join failed, plain select:', r2.error.message);
          joinLevel = 'none';
          let q3 = supabase
            .from('collections')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(500);
          q3 = applyFilters(q3, filters);
          const r3 = await q3;
          if (r3.error) throw r3.error;
          data = r3.data;
        } else {
          data = r2.data;
        }
      }

      // Map results based on join level
      const mapped = (data || []).map(item => {
        const _tags = joinLevel !== 'none'
          ? (item.collection_tags || []).map(ct => ct.tags).filter(Boolean)
          : (item.tags || []).map(t => ({ name: t, color: '#8b5cf6' }));

        const _linkedTaskIds = joinLevel === 'full'
          ? (item.task_collections || []).map(tc => tc.task_id).filter(Boolean)
          : [];

        return {
          ...item,
          _tags,
          _linkedTaskIds,
          _linkedTaskCount: _linkedTaskIds.length,
        };
      });

      // Clean raw junction data
      mapped.forEach(item => {
        delete item.collection_tags;
        delete item.task_collections;
      });

      setItems(mapped);
    } catch (err) {
      logger.warn('[useCollections] fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, user]);

  // ── Add item ────────────────────────────────────────────────
  const addItem = useCallback(async (item) => {
    if (!enabled) return null;

    const newItem = {
      user_id:        user.id,
      type:           item.type    || 'note',
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

      // Attach empty _tags for consistency with fetched items
      const withTags = { ...data, _tags: [] };

      // Optimistic: prepend to local list
      setItems(prev => [withTags, ...prev]);
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

  return {
    items,         // current fetched items
    isLoading,
    fetchItems,    // (filters?) => Promise<void>
    addItem,       // (item) => Promise<row|null>
    updateItem,    // (id, updates) => Promise<boolean>
    deleteItem,    // (id) => Promise<boolean>
    enabled,       // boolean
  };
}

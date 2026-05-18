import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * useCollections — CRUD for the `collections` table.
 *
 * Types: 'inbox' | 'note' | 'link' | 'quote' | 'learn' | 'idea'
 * Status: 'inbox' | 'unread' | 'read' | 'starred' | 'archived'
 *
 * Used by: InboxPage (type='inbox'), CollectPage (all other types)
 */
export function useCollections() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;

  const [items, setItems]       = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch all items (recent 500) — joins collection_tags + task_collections ──
  // v4.5.0: Adds task_collections(task_id) join for _linkedTaskIds/_linkedTaskCount.
  // 2-step fallback: try full join → try without task_collections → plain select.
  const fetchItems = useCallback(async (filters = {}) => {
    if (!enabled) return;
    setIsLoading(true);

    const applyFilters = (q, f) => {
      if (f.type)   q = q.eq('type', f.type);
      if (f.status) q = q.eq('status', f.status);
      if (f.type && f.type !== 'inbox') {
        if (!f.status) q = q.neq('status', 'archived');
      }
      if (f.type === 'inbox') {
        const today = new Date().toISOString().split('T')[0];
        q = q.or(`snoozed_until.is.null,snoozed_until.lte.${today}`);
      }
      return q;
    };

    try {
      let joinLevel = 'full'; // full | tags-only | none

      // Step 1: Try with both collection_tags + task_collections (v4.5.0)
      let query = supabase
        .from('collections')
        .select('*, collection_tags(tag_id, tags(id, name, color)), task_collections(task_id), collection_groups(group_id, knowledge_groups(id, title, emoji))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      query = applyFilters(query, filters);

      let { data, error } = await query;

      // Step 2: Fallback without task_collections (keeps collection_tags)
      if (error) {
        console.warn('[useCollections] full join failed, trying tags-only:', error.message);
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
          console.warn('[useCollections] tags join failed, plain select:', r2.error.message);
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

        const _groups = joinLevel === 'full'
          ? (item.collection_groups || []).map(cg => cg.knowledge_groups).filter(Boolean)
          : [];

        return {
          ...item,
          _tags,
          _linkedTaskIds,
          _linkedTaskCount: _linkedTaskIds.length,
          _groups,
        };
      });

      // Clean raw junction data
      mapped.forEach(item => {
        delete item.collection_tags;
        delete item.task_collections;
        delete item.collection_groups;
      });

      setItems(mapped);
    } catch (err) {
      console.warn('[useCollections] fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, user]);

  // ── Add item ────────────────────────────────────────────────
  // v4.1.0: No longer writes to collections.tags TEXT[] column.
  // Tags are linked via collection_tags junction (caller uses useTags.linkTag).
  const addItem = useCallback(async (item) => {
    if (!enabled) return null;

    const newItem = {
      user_id:        user.id,
      type:           item.type    || 'inbox',
      title:          item.title,
      url:            item.url     || null,
      body:           item.body    || '',
      body_text:      item.body_text || '',
      word_count:     item.word_count || 0,
      content_format: item.content_format || 'markdown',
      source:         item.source  || null,
      priority:       item.priority || null,
      status:         item.status  || 'inbox',
    };

    try {
      const { data, error } = await supabase
        .from('collections')
        .insert(newItem)
        .select()
        .single();

      if (error) {
        console.error('[useCollections] addItem DB error:', error.message, error.details, error.hint);
        throw error;
      }

      // Attach empty _tags for consistency with fetched items
      const withTags = { ...data, _tags: [] };

      // Optimistic: prepend to local list
      setItems(prev => [withTags, ...prev]);
      return data;
    } catch (err) {
      console.error('[useCollections] addItem failed:', err.message);
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
      console.warn('[useCollections] update error:', err.message);
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
      console.warn('[useCollections] delete error:', err.message);
      fetchItems();
      return false;
    }
  }, [enabled, user, fetchItems]);

  // ── Move inbox item → typed collection ──────────────────────
  const classifyItem = useCallback(async (id, newType) => {
    return updateItem(id, {
      type: newType,
      status: newType === 'inbox' ? 'inbox' : 'unread',
    });
  }, [updateItem]);

  // ── Toggle star ─────────────────────────────────────────────
  const toggleStar = useCallback(async (id, currentStatus) => {
    const newStatus = currentStatus === 'starred' ? 'read' : 'starred';
    return updateItem(id, { status: newStatus });
  }, [updateItem]);

  // ── Archive ─────────────────────────────────────────────────
  const archiveItem = useCallback(async (id) => {
    return updateItem(id, { status: 'archived' });
  }, [updateItem]);

  // ── Get inbox count (for badge on nav) ──────────────────────
  const getInboxCount = useCallback(async () => {
    if (!enabled) return 0;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('collections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'inbox')
        .or(`snoozed_until.is.null,snoozed_until.lte.${today}`);

      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.warn('[useCollections] inboxCount error:', err.message);
      return 0;
    }
  }, [enabled, user]);

  // ── Snooze inbox item ──────────────────────────────
  const snoozeItem = useCallback(async (id, untilDate) => {
    if (!enabled) return false;

    // Optimistic: remove from view
    setItems(prev => prev.filter(item => item.id !== id));

    try {
      const { error } = await supabase
        .from('collections')
        .update({ snoozed_until: untilDate })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[useCollections] snooze error:', err.message);
      fetchItems({ type: 'inbox' });
      return false;
    }
  }, [enabled, user, fetchItems]);

  // ── Get snoozed count ──────────────────────────────
  const getSnoozedCount = useCallback(async () => {
    if (!enabled) return 0;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('collections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'inbox')
        .gt('snoozed_until', today);

      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.warn('[useCollections] snoozedCount error:', err.message);
      return 0;
    }
  }, [enabled, user]);

  // ── Fetch snoozed items (for review panel) ──────────────────
  const fetchSnoozedItems = useCallback(async () => {
    if (!enabled) return [];
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'inbox')
        .gt('snoozed_until', today)
        .order('snoozed_until', { ascending: true });

      if (error) throw error;
      return (data || []).map(item => ({ ...item, _tags: [] }));
    } catch (err) {
      console.warn('[useCollections] fetchSnoozed error:', err.message);
      return [];
    }
  }, [enabled, user]);

  return {
    items,         // current fetched items
    isLoading,
    fetchItems,    // (filters?) => Promise<void>
    addItem,       // (item) => Promise<row|null>
    updateItem,    // (id, updates) => Promise<boolean>
    deleteItem,    // (id) => Promise<boolean>
    classifyItem,  // (id, newType) => Promise<boolean>
    toggleStar,    // (id, currentStatus) => Promise<boolean>
    archiveItem,   // (id) => Promise<boolean>
    snoozeItem,    // (id, untilDate) => Promise<boolean>
    getInboxCount, // () => Promise<number>
    getSnoozedCount, // () => Promise<number>
    fetchSnoozedItems, // () => Promise<item[]>
    enabled,       // boolean
  };
}

import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * useCollections — CRUD for the `collections` table.
 *
 * Types: 'inbox' | 'link' | 'quote' | 'want' | 'learn' | 'idea'
 * Status: 'inbox' | 'unread' | 'read' | 'starred' | 'archived'
 *
 * Used by: InboxPage (type='inbox'), CollectPage (all other types)
 */
export function useCollections() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;

  const [items, setItems]       = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch all items (recent 500) — joins collection_tags for tag data ──
  // Graceful fallback: if collection_tags table doesn't exist yet (migration not run),
  // falls back to plain select (no _tags data).
  const fetchItems = useCallback(async (filters = {}) => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      // Try with junction join first (v4.1.0)
      let useJoin = true;
      let query = supabase
        .from('collections')
        .select('*, collection_tags(tag_id, tags(id, name, color))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);

      // Apply filters
      if (filters.type)   query = query.eq('type', filters.type);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.type && filters.type !== 'inbox') {
        if (!filters.status) query = query.neq('status', 'archived');
      }
      if (filters.type === 'inbox') {
        const today = new Date().toISOString().split('T')[0];
        query = query.or(`snoozed_until.is.null,snoozed_until.lte.${today}`);
      }

      let { data, error } = await query;

      // Fallback: if join fails (table not yet created), retry without join
      if (error) {
        console.warn('[useCollections] join failed, falling back to plain select:', error.message);
        useJoin = false;
        let fallback = supabase
          .from('collections')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(500);

        if (filters.type)   fallback = fallback.eq('type', filters.type);
        if (filters.status) fallback = fallback.eq('status', filters.status);
        if (filters.type && filters.type !== 'inbox') {
          if (!filters.status) fallback = fallback.neq('status', 'archived');
        }
        if (filters.type === 'inbox') {
          const today = new Date().toISOString().split('T')[0];
          fallback = fallback.or(`snoozed_until.is.null,snoozed_until.lte.${today}`);
        }

        const result = await fallback;
        if (result.error) throw result.error;
        data = result.data;
      }

      // Flatten junction join → item._tags = [{id, name, color}, ...]
      const mapped = (data || []).map(item => ({
        ...item,
        _tags: useJoin
          ? (item.collection_tags || []).map(ct => ct.tags).filter(Boolean)
          : (item.tags || []).map(t => ({ name: t, color: '#8b5cf6' })),
      }));
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
    console.log('[useCollections] addItem called, enabled:', enabled, 'user:', !!user, 'item:', item);
    if (!enabled) return null;

    const newItem = {
      user_id:        user.id,
      type:           item.type    || 'inbox',
      title:          item.title,
      url:            item.url     || null,
      body:           item.body    || '',
      tags:           [],  // DEPRECATED column (v4.1.0) — still required for NOT NULL constraint
      source:         item.source  || null,
      priority:       item.priority || null,
      status:         item.status  || 'inbox',
      // AI-ready fields (require migration v3.2.0)
      content_format: item.content_format || 'markdown',
      body_text:      item.body_text      || null,
      word_count:     item.word_count     || 0,
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
    enabled,       // boolean
  };
}

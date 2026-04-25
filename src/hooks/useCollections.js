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

  // ── Fetch all items (recent 500) ────────────────────────────
  const fetchItems = useCallback(async (filters = {}) => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('collections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);

      // Optional filters
      if (filters.type)   query = query.eq('type', filters.type);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.type && filters.type !== 'inbox') {
        // For Collect page: exclude archived by default
        if (!filters.status) query = query.neq('status', 'archived');
      }

      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.warn('[useCollections] fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, user]);

  // ── Add item ────────────────────────────────────────────────
  const addItem = useCallback(async (item) => {
    if (!enabled) return null;

    const newItem = {
      user_id: user.id,
      type:    item.type || 'inbox',
      title:   item.title,
      url:     item.url || null,
      body:    item.body || '',
      tags:    item.tags || [],
      source:  item.source || null,
      priority: item.priority || null,
      status:  item.status || 'inbox',
    };

    try {
      const { data, error } = await supabase
        .from('collections')
        .insert(newItem)
        .select()
        .single();

      if (error) throw error;

      // Optimistic: prepend to local list
      setItems(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.warn('[useCollections] add error:', err.message);
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
      const { count, error } = await supabase
        .from('collections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'inbox');

      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.warn('[useCollections] inboxCount error:', err.message);
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
    getInboxCount, // () => Promise<number>
    enabled,       // boolean
  };
}

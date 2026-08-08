import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * useTags — Central tag CRUD, Supabase-first.
 *
 * v3.7.0: expenses, subscriptions
 * v4.1.0: + collections, updateTag, getTagUsageCount, getTagsForEntity
 *
 * Shared across modules (expenses, subscriptions, collections).
 * All tags belong to the authenticated user.
 */

/* ── Entity type → junction table mapping ─────────────────── */
// v6.0.0: expense/subscription bị gỡ (module Finance viết lại) → 'finance' trỏ
// vào finance_transaction_tags. Xem docs/DESIGN_FINANCE.md §11.
const ENTITY_CONFIG = {
  finance:      { table: 'finance_transaction_tags', fk: 'transaction_id' },
  collection:   { table: 'collection_tags',   fk: 'collection_id' },
  task:         { table: 'task_tags',         fk: 'task_id' },
  account:      { table: 'account_tags',      fk: 'account_id' },
};

export function useTags() {
  const { user } = useAuth();
  const isAuth = isSupabaseEnabled && !!user;
  const userId = user?.id;

  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  // ── Fetch all tags ────────────────────────────────────────
  const fetchTags = useCallback(async () => {
    if (!isAuth || !userId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) {
        logger.error('[useTags] fetch error:', error.message);
      } else {
        setTags(data || []);
      }
    } catch (err) {
      logger.error('[useTags] fetch exception:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuth, userId]);

  useEffect(() => {
    if (isAuth && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchTags();
    }
    if (!isAuth) {
      fetchedRef.current = false;
      setTags([]);
    }
  }, [isAuth, fetchTags]);

  // ── Add tag (or return existing) ──────────────────────────
  const addTag = useCallback(async (name, color = '#8b5cf6') => {
    if (!isAuth || !userId || !name.trim()) return null;

    const trimmed = name.trim().toLowerCase();

    // Check if already exists (client-side)
    const existing = tags.find(t => t.name.toLowerCase() === trimmed);
    if (existing) return existing;

    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({ user_id: userId, name: trimmed, color })
        .select()
        .single();

      if (error) {
        // UNIQUE violation → fetch existing
        if (error.code === '23505') {
          const { data: found } = await supabase
            .from('tags')
            .select('*')
            .eq('user_id', userId)
            .ilike('name', trimmed)
            .single();
          if (found) {
            setTags(prev => prev.some(t => t.id === found.id) ? prev : [...prev, found]);
            return found;
          }
        }
        logger.error('[useTags] add error:', error.message);
        return null;
      }

      setTags(prev => [...prev, data]);
      return data;
    } catch (err) {
      logger.error('[useTags] add exception:', err);
      return null;
    }
  }, [isAuth, userId, tags]);

  // ── Update tag (rename / recolor) ─────────────────────────
  const updateTag = useCallback(async (tagId, updates) => {
    if (!isAuth || !userId) return false;

    const backup = tags.find(t => t.id === tagId);
    if (!backup) return false;

    // Normalize name if provided
    const clean = {};
    if (updates.name !== undefined) clean.name = updates.name.trim().toLowerCase();
    if (updates.color !== undefined) clean.color = updates.color;

    if (Object.keys(clean).length === 0) return false;

    // Optimistic update
    setTags(prev => prev.map(t => t.id === tagId ? { ...t, ...clean } : t));

    try {
      const { error } = await supabase
        .from('tags')
        .update(clean)
        .eq('id', tagId)
        .eq('user_id', userId);

      if (error) {
        logger.error('[useTags] update error:', error.message);
        // Rollback
        setTags(prev => prev.map(t => t.id === tagId ? backup : t));
        return false;
      }
      return true;
    } catch (err) {
      logger.error('[useTags] update exception:', err);
      setTags(prev => prev.map(t => t.id === tagId ? backup : t));
      return false;
    }
  }, [isAuth, userId, tags]);

  // ── Delete tag ────────────────────────────────────────────
  const deleteTag = useCallback(async (tagId) => {
    if (!isAuth) return;
    const backup = tags.find(t => t.id === tagId);

    setTags(prev => prev.filter(t => t.id !== tagId));

    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId)
        .eq('user_id', userId);

      if (error) {
        logger.error('[useTags] delete error:', error.message);
        if (backup) setTags(prev => [...prev, backup]);
      }
    } catch (err) {
      logger.error('[useTags] delete exception:', err);
      if (backup) setTags(prev => [...prev, backup]);
    }
  }, [isAuth, userId, tags]);

  // ── Link tag to entity (expense, subscription, or collection) ──
  const linkTag = useCallback(async (entityId, tagId, entityType = 'expense') => {
    if (!isAuth) return false;

    const config = ENTITY_CONFIG[entityType];
    if (!config) {
      logger.error(`[useTags] linkTag: unknown entityType "${entityType}"`);
      return false;
    }

    try {
      const { error } = await supabase.from(config.table).upsert(
        { [config.fk]: entityId, tag_id: tagId },
        { onConflict: `${config.fk},tag_id` }
      );

      if (error) {
        logger.error(`[useTags] linkTag error:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      logger.error(`[useTags] linkTag exception:`, err);
      return false;
    }
  }, [isAuth]);

  // ── Unlink tag from entity ────────────────────────────────
  const unlinkTag = useCallback(async (entityId, tagId, entityType = 'expense') => {
    if (!isAuth) return false;

    const config = ENTITY_CONFIG[entityType];
    if (!config) {
      logger.error(`[useTags] unlinkTag: unknown entityType "${entityType}"`);
      return false;
    }

    try {
      const { error } = await supabase.from(config.table).delete()
        .eq(config.fk, entityId)
        .eq('tag_id', tagId);

      if (error) {
        logger.error(`[useTags] unlinkTag error:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      logger.error(`[useTags] unlinkTag exception:`, err);
      return false;
    }
  }, [isAuth]);

  // ── Get tags for a specific entity ────────────────────────
  const getTagsForEntity = useCallback(async (entityId, entityType = 'expense') => {
    if (!isAuth) return [];

    const config = ENTITY_CONFIG[entityType];
    if (!config) return [];

    try {
      const { data, error } = await supabase
        .from(config.table)
        .select('tag_id, tags(id, name, color)')
        .eq(config.fk, entityId);

      if (error) {
        logger.error('[useTags] getTagsForEntity error:', error.message);
        return [];
      }
      return (data || []).map(row => row.tags).filter(Boolean);
    } catch (err) {
      logger.error('[useTags] getTagsForEntity exception:', err);
      return [];
    }
  }, [isAuth]);

  // ── Get usage breakdown for a tag, per entity type ──────────
  const getTagUsageBreakdown = useCallback(async (tagId) => {
    if (!isAuth) return { finance: 0, collection: 0, task: 0, account: 0 };

    try {
      const [finance, collections, tasks, accounts] = await Promise.all([
        supabase.from('finance_transaction_tags').select('tag_id', { count: 'exact', head: true }).eq('tag_id', tagId),
        supabase.from('collection_tags').select('tag_id', { count: 'exact', head: true }).eq('tag_id', tagId),
        supabase.from('task_tags').select('tag_id', { count: 'exact', head: true }).eq('tag_id', tagId),
        supabase.from('account_tags').select('tag_id', { count: 'exact', head: true }).eq('tag_id', tagId),
      ]);

      return {
        finance: finance.count || 0,
        collection: collections.count || 0,
        task: tasks.count || 0,
        account: accounts.count || 0,
      };
    } catch (err) {
      logger.error('[useTags] getTagUsageBreakdown exception:', err);
      return { finance: 0, collection: 0, task: 0, account: 0 };
    }
  }, [isAuth]);

  // ── Get usage count for a tag across all junction tables ───
  const getTagUsageCount = useCallback(async (tagId) => {
    const b = await getTagUsageBreakdown(tagId);
    return b.finance + b.collection + b.task + b.account;
  }, [getTagUsageBreakdown]);

  // ── Batch get usage counts for all tags ───────────────────
  const getAllTagUsageCounts = useCallback(async () => {
    if (!isAuth || !userId) return {};

    try {
      // Fetch all links from all 4 junction tables
      const [finance, collections, tasks, accounts] = await Promise.all([
        supabase.from('finance_transaction_tags').select('tag_id'),
        supabase.from('collection_tags').select('tag_id'),
        supabase.from('task_tags').select('tag_id'),
        supabase.from('account_tags').select('tag_id'),
      ]);

      const counts = {};
      const all = [
        ...(finance.data || []),
        ...(collections.data || []),
        ...(tasks.data || []),
        ...(accounts.data || []),
      ];
      for (const row of all) {
        counts[row.tag_id] = (counts[row.tag_id] || 0) + 1;
      }
      return counts;
    } catch (err) {
      logger.error('[useTags] getAllTagUsageCounts exception:', err);
      return {};
    }
  }, [isAuth, userId]);

  return {
    tags,
    isLoading,
    fetchTags,
    addTag,
    updateTag,
    deleteTag,
    linkTag,
    unlinkTag,
    getTagsForEntity,
    getTagUsageCount,
    getTagUsageBreakdown,
    getAllTagUsageCounts,
  };
}

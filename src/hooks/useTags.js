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
const ENTITY_CONFIG = {
  expense:      { table: 'expense_tags',      fk: 'expense_id' },
  subscription: { table: 'subscription_tags', fk: 'subscription_id' },
  collection:   { table: 'collection_tags',   fk: 'collection_id' },
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
  // extra: { emoji, description } — dùng khi tag đóng vai trò "nhóm/folder"
  // hiển thị (v4.30.0, gộp từ knowledge_groups).
  const addTag = useCallback(async (name, color = '#8b5cf6', extra = {}) => {
    if (!isAuth || !userId || !name.trim()) return null;

    const trimmed = name.trim().toLowerCase();

    // Check if already exists (client-side)
    const existing = tags.find(t => t.name.toLowerCase() === trimmed);
    if (existing) {
      // v4.30.0: đang tạo "nhóm" (extra.emoji) mà trùng tên 1 tag thường đã
      // có (chưa có emoji) — nâng cấp nó thành nhóm thay vì âm thầm bỏ qua
      // emoji, tránh user tưởng vừa tạo nhóm mới nhưng thực ra không đổi gì.
      if (extra.emoji && !existing.emoji) {
        const patch = { emoji: extra.emoji, description: extra.description || existing.description || null };
        setTags(prev => prev.map(t => t.id === existing.id ? { ...t, ...patch } : t));
        try {
          const { error } = await supabase.from('tags').update(patch).eq('id', existing.id).eq('user_id', userId);
          if (error) throw error;
        } catch (err) {
          logger.warn('[useTags] addTag emoji-sync error:', err.message);
        }
        return { ...existing, ...patch };
      }
      return existing;
    }

    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({ user_id: userId, name: trimmed, color, emoji: extra.emoji || null, description: extra.description || null })
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
    if (updates.emoji !== undefined) clean.emoji = updates.emoji;
    if (updates.description !== undefined) clean.description = updates.description;

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
        .select('tag_id, tags(id, name, color, emoji)')
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

  // ── Get collections for a specific tag (chiều ngược getTagsForEntity) ──
  // v4.30.0: thay useKnowledgeGroups.fetchGroupArticles — tag đóng vai trò
  // "nhóm" khi có emoji. Không giữ thứ tự thủ công (collection_tags không có
  // sort_order, và cũ đã xác nhận không dùng tính năng đó).
  const getCollectionsForTag = useCallback(async (tagId) => {
    if (!isAuth) return [];
    try {
      const { data, error } = await supabase
        .from('collection_tags')
        .select('collections(*, collection_tags(tag_id, tags(id, name, color, emoji)))')
        .eq('tag_id', tagId);

      if (error) throw error;

      return (data || [])
        .map(row => row.collections)
        .filter(Boolean)
        .map(item => {
          const _tags = (item.collection_tags || []).map(ct => ct.tags).filter(Boolean);
          const cleaned = { ...item, _tags };
          delete cleaned.collection_tags;
          return cleaned;
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (err) {
      logger.error('[useTags] getCollectionsForTag exception:', err);
      return [];
    }
  }, [isAuth]);

  // ── Get usage count for a tag across all junction tables ───
  const getTagUsageCount = useCallback(async (tagId) => {
    if (!isAuth) return 0;

    try {
      // Query all 3 junction tables in parallel
      const [expenses, subs, collections] = await Promise.all([
        supabase.from('expense_tags').select('tag_id', { count: 'exact', head: true }).eq('tag_id', tagId),
        supabase.from('subscription_tags').select('tag_id', { count: 'exact', head: true }).eq('tag_id', tagId),
        supabase.from('collection_tags').select('tag_id', { count: 'exact', head: true }).eq('tag_id', tagId),
      ]);

      return (expenses.count || 0) + (subs.count || 0) + (collections.count || 0);
    } catch (err) {
      logger.error('[useTags] getTagUsageCount exception:', err);
      return 0;
    }
  }, [isAuth]);

  // ── Batch get usage counts for all tags ───────────────────
  const getAllTagUsageCounts = useCallback(async () => {
    if (!isAuth || !userId) return {};

    try {
      // Fetch all links from all 3 junction tables
      const [expenses, subs, collections] = await Promise.all([
        supabase.from('expense_tags').select('tag_id'),
        supabase.from('subscription_tags').select('tag_id'),
        supabase.from('collection_tags').select('tag_id'),
      ]);

      const counts = {};
      const all = [
        ...(expenses.data || []),
        ...(subs.data || []),
        ...(collections.data || []),
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
    getCollectionsForTag,
    getTagUsageCount,
    getAllTagUsageCounts,
  };
}

import { useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * useKnowledgeGroups — CRUD for knowledge_groups + collection_groups junction.
 *
 * Pattern mirrors task_collections (v4.5.0).
 * Groups are user-created folders for organizing KB articles (M:N).
 */
export function useKnowledgeGroups() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;

  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch all groups with article count ─────────────────
  const fetchGroups = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_groups')
        .select('*, collection_groups(collection_id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(g => ({
        ...g,
        _articleCount: (g.collection_groups || []).length,
      }));
      // Clean junction data
      mapped.forEach(g => delete g.collection_groups);

      setGroups(mapped);
    } catch (err) {
      logger.warn('[useKnowledgeGroups] fetchGroups error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, user]);

  // ── Add group ───────────────────────────────────────────
  const addGroup = useCallback(async (title, emoji = '📁', description = '') => {
    if (!enabled || !title?.trim()) return null;
    try {
      const { data, error } = await supabase
        .from('knowledge_groups')
        .insert({ user_id: user.id, title: title.trim(), emoji, description })
        .select()
        .single();

      if (error) throw error;

      const newGroup = { ...data, _articleCount: 0 };
      setGroups(prev => [newGroup, ...prev]);
      return newGroup;
    } catch (err) {
      logger.warn('[useKnowledgeGroups] addGroup error:', err.message);
      return null;
    }
  }, [enabled, user]);

  // ── Update group ────────────────────────────────────────
  const updateGroup = useCallback(async (id, updates) => {
    if (!enabled) return false;

    // Optimistic
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));

    try {
      const { error } = await supabase
        .from('knowledge_groups')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (err) {
      logger.warn('[useKnowledgeGroups] updateGroup error:', err.message);
      fetchGroups();
      return false;
    }
  }, [enabled, user, fetchGroups]);

  // ── Delete group (articles NOT deleted — only junction rows CASCADE) ──
  const deleteGroup = useCallback(async (id) => {
    if (!enabled) return false;

    // Optimistic
    setGroups(prev => prev.filter(g => g.id !== id));

    try {
      const { error } = await supabase
        .from('knowledge_groups')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (err) {
      logger.warn('[useKnowledgeGroups] deleteGroup error:', err.message);
      fetchGroups();
      return false;
    }
  }, [enabled, user, fetchGroups]);

  // ── Delete group AND all articles inside ─────────────────
  const deleteGroupWithArticles = useCallback(async (id) => {
    if (!enabled) return false;
    try {
      // Step 1: Get all article IDs in the group
      const { data: links } = await supabase
        .from('collection_groups')
        .select('collection_id')
        .eq('group_id', id);

      const articleIds = (links || []).map(l => l.collection_id);

      // Step 2: Delete the group (junction rows auto CASCADE)
      const { error: gErr } = await supabase
        .from('knowledge_groups')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (gErr) throw gErr;

      // Step 3: Delete the articles
      if (articleIds.length > 0) {
        const { error: aErr } = await supabase
          .from('collections')
          .delete()
          .in('id', articleIds)
          .eq('user_id', user.id);
        if (aErr) logger.warn('[useKnowledgeGroups] deleteArticles error:', aErr.message);
      }

      setGroups(prev => prev.filter(g => g.id !== id));
      return true;
    } catch (err) {
      logger.warn('[useKnowledgeGroups] deleteGroupWithArticles error:', err.message);
      fetchGroups();
      return false;
    }
  }, [enabled, user, fetchGroups]);

  // ── Link article to group ───────────────────────────────
  const linkArticle = useCallback(async (collectionId, groupId) => {
    if (!enabled) return false;
    try {
      const { error } = await supabase
        .from('collection_groups')
        .insert({ collection_id: collectionId, group_id: groupId })
        .select();

      if (error) {
        // Duplicate key = already linked, treat as success
        if (error.code === '23505') return true;
        throw error;
      }

      // Update count optimistically
      setGroups(prev => prev.map(g =>
        g.id === groupId ? { ...g, _articleCount: (g._articleCount || 0) + 1 } : g
      ));
      return true;
    } catch (err) {
      logger.warn('[useKnowledgeGroups] linkArticle error:', err.message);
      return false;
    }
  }, [enabled]);

  // ── Unlink article from group ───────────────────────────
  const unlinkArticle = useCallback(async (collectionId, groupId) => {
    if (!enabled) return false;
    try {
      const { error } = await supabase
        .from('collection_groups')
        .delete()
        .eq('collection_id', collectionId)
        .eq('group_id', groupId);

      if (error) throw error;

      setGroups(prev => prev.map(g =>
        g.id === groupId ? { ...g, _articleCount: Math.max(0, (g._articleCount || 1) - 1) } : g
      ));
      return true;
    } catch (err) {
      logger.warn('[useKnowledgeGroups] unlinkArticle error:', err.message);
      return false;
    }
  }, [enabled]);

  // ── Fetch articles inside a group ───────────────────────
  const fetchGroupArticles = useCallback(async (groupId) => {
    if (!enabled) return [];
    try {
      const { data, error } = await supabase
        .from('collection_groups')
        .select('sort_order, collections(*, collection_tags(tag_id, tags(id, name, color)))')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => {
        const item = row.collections;
        if (!item) return null;
        const _tags = (item.collection_tags || []).map(ct => ct.tags).filter(Boolean);
        const cleaned = { ...item, _tags };
        delete cleaned.collection_tags;
        return cleaned;
      }).filter(Boolean);
    } catch (err) {
      logger.warn('[useKnowledgeGroups] fetchGroupArticles error:', err.message);
      return [];
    }
  }, [enabled]);

  // ── Get groups for a specific article ───────────────────
  const getGroupsForArticle = useCallback(async (collectionId) => {
    if (!enabled) return [];
    try {
      const { data, error } = await supabase
        .from('collection_groups')
        .select('group_id, knowledge_groups(id, title, emoji)')
        .eq('collection_id', collectionId);

      if (error) throw error;
      return (data || []).map(row => row.knowledge_groups).filter(Boolean);
    } catch (err) {
      logger.warn('[useKnowledgeGroups] getGroupsForArticle error:', err.message);
      return [];
    }
  }, [enabled]);

  return {
    groups,
    isLoading,
    fetchGroups,
    addGroup,
    updateGroup,
    deleteGroup,
    deleteGroupWithArticles,
    linkArticle,
    unlinkArticle,
    fetchGroupArticles,
    getGroupsForArticle,
  };
}

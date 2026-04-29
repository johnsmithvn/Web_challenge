import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

let _supabase = null;
async function getSb() {
  if (!_supabase) {
    const mod = await import('../lib/supabase');
    _supabase = mod.supabase;
  }
  return _supabase;
}

/**
 * useTags — Central tag CRUD, Supabase-first.
 *
 * Shared across modules (expenses, subscriptions, collections).
 * All tags belong to the authenticated user.
 */
export function useTags() {
  const { user } = useAuth();
  const isAuth = !!user;
  const userId = user?.id;

  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  // ── Fetch all tags ────────────────────────────────────────
  const fetchTags = useCallback(async () => {
    if (!isAuth || !userId) return;
    setIsLoading(true);
    try {
      const sb = await getSb();
      if (!sb) return;

      const { data, error } = await sb
        .from('tags')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) {
        console.error('[useTags] fetch error:', error.message);
      } else {
        setTags(data || []);
      }
    } catch (err) {
      console.error('[useTags] fetch exception:', err);
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
      const sb = await getSb();
      if (!sb) return null;

      const { data, error } = await sb
        .from('tags')
        .insert({ user_id: userId, name: trimmed, color })
        .select()
        .single();

      if (error) {
        // UNIQUE violation → fetch existing
        if (error.code === '23505') {
          const { data: found } = await sb
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
        console.error('[useTags] add error:', error.message);
        return null;
      }

      setTags(prev => [...prev, data]);
      return data;
    } catch (err) {
      console.error('[useTags] add exception:', err);
      return null;
    }
  }, [isAuth, userId, tags]);

  // ── Delete tag ────────────────────────────────────────────
  const deleteTag = useCallback(async (tagId) => {
    if (!isAuth) return;
    const backup = tags.find(t => t.id === tagId);

    setTags(prev => prev.filter(t => t.id !== tagId));

    try {
      const sb = await getSb();
      if (!sb) return;

      const { error } = await sb
        .from('tags')
        .delete()
        .eq('id', tagId)
        .eq('user_id', userId);

      if (error) {
        console.error('[useTags] delete error:', error.message);
        if (backup) setTags(prev => [...prev, backup]);
      }
    } catch (err) {
      console.error('[useTags] delete exception:', err);
      if (backup) setTags(prev => [...prev, backup]);
    }
  }, [isAuth, userId, tags]);

  // ── Link tag to entity (expense or subscription) ──────────
  const linkTag = useCallback(async (entityId, tagId, entityType = 'expense') => {
    if (!isAuth) return false;
    try {
      const sb = await getSb();
      if (!sb) return false;

      const table = entityType === 'expense' ? 'expense_tags' : 'subscription_tags';
      const fk = entityType === 'expense' ? 'expense_id' : 'subscription_id';

      const { error } = await sb.from(table).upsert(
        { [fk]: entityId, tag_id: tagId },
        { onConflict: `${fk},tag_id` }
      );

      if (error) {
        console.error(`[useTags] linkTag error:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[useTags] linkTag exception:`, err);
      return false;
    }
  }, [isAuth]);

  // ── Unlink tag from entity ────────────────────────────────
  const unlinkTag = useCallback(async (entityId, tagId, entityType = 'expense') => {
    if (!isAuth) return false;
    try {
      const sb = await getSb();
      if (!sb) return false;

      const table = entityType === 'expense' ? 'expense_tags' : 'subscription_tags';
      const fk = entityType === 'expense' ? 'expense_id' : 'subscription_id';

      const { error } = await sb.from(table).delete()
        .eq(fk, entityId)
        .eq('tag_id', tagId);

      if (error) {
        console.error(`[useTags] unlinkTag error:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[useTags] unlinkTag exception:`, err);
      return false;
    }
  }, [isAuth]);

  return {
    tags,
    isLoading,
    fetchTags,
    addTag,
    deleteTag,
    linkTag,
    unlinkTag,
  };
}

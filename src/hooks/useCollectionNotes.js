import { useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * useCollectionNotes — CRUD for collection_notes (threaded sub-notes).
 *
 * Lightweight notes attached to a KB article.
 * Use case: book reading notes, personal annotations, follow-up thoughts.
 */
export function useCollectionNotes() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;

  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch notes for a specific article ──────────────────
  const fetchNotes = useCallback(async (collectionId) => {
    if (!enabled || !collectionId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('collection_notes')
        .select('*')
        .eq('collection_id', collectionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      logger.warn('[useCollectionNotes] fetchNotes error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, user]);

  // ── Add note ────────────────────────────────────────────
  const addNote = useCallback(async (collectionId, content) => {
    if (!enabled || !content?.trim()) return null;
    try {
      const { data, error } = await supabase
        .from('collection_notes')
        .insert({
          collection_id: collectionId,
          user_id: user.id,
          content: content.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Optimistic: append to local list
      setNotes(prev => [...prev, data]);
      return data;
    } catch (err) {
      logger.warn('[useCollectionNotes] addNote error:', err.message);
      return null;
    }
  }, [enabled, user]);

  // ── Update note ─────────────────────────────────────────
  const updateNote = useCallback(async (noteId, content) => {
    if (!enabled || !content?.trim()) return false;

    // Optimistic — capture the prior value (from the freshest state) for rollback.
    let backup;
    setNotes(prev => {
      backup = prev.find(n => n.id === noteId);
      return prev.map(n => n.id === noteId ? { ...n, content: content.trim() } : n);
    });

    try {
      const { error } = await supabase
        .from('collection_notes')
        .update({ content: content.trim() })
        .eq('id', noteId)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (err) {
      logger.warn('[useCollectionNotes] updateNote error:', err.message);
      // Restore the original note so the UI doesn't show unsaved content.
      if (backup) setNotes(prev => prev.map(n => n.id === noteId ? backup : n));
      return false;
    }
  }, [enabled, user]);

  // ── Delete note ─────────────────────────────────────────
  const deleteNote = useCallback(async (noteId) => {
    if (!enabled) return false;

    // Optimistic
    setNotes(prev => prev.filter(n => n.id !== noteId));

    try {
      const { error } = await supabase
        .from('collection_notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (err) {
      logger.warn('[useCollectionNotes] deleteNote error:', err.message);
      return false;
    }
  }, [enabled, user]);

  // ── Get note count for an article (lightweight) ─────────
  const getNoteCount = useCallback(async (collectionId) => {
    if (!enabled) return 0;
    try {
      const { count, error } = await supabase
        .from('collection_notes')
        .select('id', { count: 'exact', head: true })
        .eq('collection_id', collectionId)
        .eq('user_id', user.id);

      if (error) throw error;
      return count || 0;
    } catch (err) {
      logger.warn('[useCollectionNotes] getNoteCount error:', err.message);
      return 0;
    }
  }, [enabled, user]);

  return {
    notes,
    isLoading,
    fetchNotes,
    addNote,
    updateNote,
    deleteNote,
    getNoteCount,
  };
}

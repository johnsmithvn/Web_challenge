/**
 * useQuotes — CRUD for user inspirational_quotes (Supabase)
 * Merges user DB quotes with system quotes from quotes.json.
 *
 * Usage:
 *   const { quotes, addQuote, updateQuote, deleteQuote, isLoading } = useQuotes();
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import QUOTES_DATA from '../data/quotes.json';
import { logger } from '../utils/logger';

const SYSTEM_QUOTES = QUOTES_DATA.dailyQuotes.map((q, i) => ({
  id: `sys_${i}`,
  text: q.text,
  author: q.author || null,
  audio_url: null,
  source: 'system',
  is_active: true,
  _isSystem: true,
}));

export function useQuotes() {
  const { user } = useAuth();
  const [userQuotes, setUserQuotes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Combined: user quotes first, then system
  const quotes = [...userQuotes, ...SYSTEM_QUOTES];

  // Fetch user quotes from DB
  const fetchQuotes = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inspirational_quotes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        // Table may not exist yet — graceful fallback
        logger.warn('useQuotes: fetch error (table may not exist):', error.message);
        setUserQuotes([]);
      } else {
        setUserQuotes(data || []);
      }
    } catch (err) {
      logger.warn('useQuotes: unexpected error:', err);
      setUserQuotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const addQuote = useCallback(async ({ text, author, audio_url, source }) => {
    if (!user || !text?.trim()) return null;
    const { data, error } = await supabase
      .from('inspirational_quotes')
      .insert({ user_id: user.id, text: text.trim(), author: author?.trim() || null, audio_url, source })
      .select()
      .single();
    if (error) {
      logger.error('useQuotes: add error:', error.message);
      return null;
    }
    setUserQuotes(prev => [data, ...prev]);
    return data;
  }, [user]);

  const updateQuote = useCallback(async (id, updates) => {
    const { error } = await supabase
      .from('inspirational_quotes')
      .update(updates)
      .eq('id', id);
    if (error) {
      logger.error('useQuotes: update error:', error.message);
      return false;
    }
    setUserQuotes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    return true;
  }, []);

  const deleteQuote = useCallback(async (id) => {
    const { error } = await supabase
      .from('inspirational_quotes')
      .delete()
      .eq('id', id);
    if (error) {
      logger.error('useQuotes: delete error:', error.message);
      return false;
    }
    setUserQuotes(prev => prev.filter(q => q.id !== id));
    return true;
  }, []);

  return { quotes, userQuotes, systemQuotes: SYSTEM_QUOTES, addQuote, updateQuote, deleteQuote, isLoading, fetchQuotes };
}

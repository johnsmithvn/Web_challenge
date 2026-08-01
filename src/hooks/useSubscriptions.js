import { useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { advanceByCycle, monthlyCostForCycle } from '../utils/currencyUtils';
import { toDateStr } from '../utils/dateUtils';

/**
 * useSubscriptions — CRUD for the `subscriptions` table.
 * Quản lý đăng ký gói tháng/năm (Netflix, Google AI, etc.)
 */
export function useSubscriptions() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;

  const [subs, setSubs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch all active subs + auto-advance expired ─────────────
  const fetchSubs = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('next_due', { ascending: true });

      if (error) throw error;
      const rows = data || [];

      // Auto-advance expired subscriptions
      const today = toDateStr();
      const advancePromises = [];

      for (const sub of rows) {
        if (!sub.active || sub.next_due > today) continue;

        // Calculate next due date based on cycle
        let d = new Date(sub.next_due + 'T00:00:00');
        const MAX_ADVANCES = 24; // safety: max 24 cycles forward (2 years monthly)
        let advances = 0;
        while (toDateStr(d) <= today && advances < MAX_ADVANCES) {
          d = advanceByCycle(d, sub.cycle);
          advances++;
        }

        const newDue = toDateStr(d);
        if (newDue !== sub.next_due) {
          sub.next_due = newDue; // update local copy
          advancePromises.push(
            supabase.from('subscriptions').update({ next_due: newDue }).eq('id', sub.id).eq('user_id', user.id)
          );
        }
      }

      if (advancePromises.length > 0) {
        await Promise.allSettled(advancePromises);
        logger.info(`[useSubscriptions] auto-advanced ${advancePromises.length} subs`);
      }

      setSubs(rows);
    } catch (err) {
      logger.warn('[useSubscriptions] fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, user]);

  // ── Add subscription ───────────────────────────────────────
  const addSub = useCallback(async (sub) => {
    if (!enabled) return null;

    const newSub = {
      user_id:  user.id,
      name:     sub.name,
      amount:   sub.amount,
      cycle:    sub.cycle || 'monthly',
      next_due: sub.next_due,
      icon:     sub.icon || '📦',
      color:    sub.color || '#8b5cf6',
      active:   true,
    };

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .insert(newSub)
        .select()
        .single();

      if (error) throw error;
      setSubs(prev => [...prev, data].sort((a, b) => a.next_due.localeCompare(b.next_due)));
      return data;
    } catch (err) {
      logger.warn('[useSubscriptions] add error:', err.message);
      return null;
    }
  }, [enabled, user]);

  // ── Update subscription ────────────────────────────────────
  const updateSub = useCallback(async (id, updates) => {
    if (!enabled) return false;

    setSubs(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (err) {
      logger.warn('[useSubscriptions] update error:', err.message);
      fetchSubs(); // rollback
      return false;
    }
  }, [enabled, user, fetchSubs]);

  // ── Delete subscription ────────────────────────────────────
  const deleteSub = useCallback(async (id) => {
    if (!enabled) return false;

    setSubs(prev => prev.filter(s => s.id !== id));

    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (err) {
      logger.warn('[useSubscriptions] delete error:', err.message);
      fetchSubs();
      return false;
    }
  }, [enabled, user, fetchSubs]);

  // ── Toggle active ──────────────────────────────────────────
  const toggleActive = useCallback(async (id) => {
    const sub = subs.find(s => s.id === id);
    if (!sub) return false;
    return updateSub(id, { active: !sub.active });
  }, [subs, updateSub]);

  // ── Get upcoming (within N days) ──────────────────────────
  const getUpcoming = useCallback((days = 7) => {
    const now = new Date();
    const limit = new Date(now);
    limit.setDate(limit.getDate() + days);
    const limitStr = toDateStr(limit);
    const todayStr = toDateStr(now);

    return subs.filter(s =>
      s.active && s.next_due >= todayStr && s.next_due <= limitStr
    );
  }, [subs]);

  // ── Monthly cost ───────────────────────────────────────────
  const getMonthlyCost = useCallback(() => {
    return subs
      .filter(s => s.active)
      .reduce((sum, s) => sum + monthlyCostForCycle(s.amount, s.cycle), 0);
  }, [subs]);

  return {
    subs,           // all subscriptions
    isLoading,
    fetchSubs,      // () => Promise<void>
    addSub,         // (sub) => Promise<row|null>
    updateSub,      // (id, updates) => Promise<boolean>
    deleteSub,      // (id) => Promise<boolean>
    toggleActive,   // (id) => Promise<boolean>
    getUpcoming,    // (days?) => sub[]
    getMonthlyCost, // () => number
    enabled,
  };
}

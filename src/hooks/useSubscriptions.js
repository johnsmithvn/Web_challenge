import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
      const today = new Date().toISOString().split('T')[0];
      const advancePromises = [];

      for (const sub of rows) {
        if (!sub.active || sub.next_due > today) continue;

        // Calculate next due date based on cycle
        const d = new Date(sub.next_due + 'T00:00:00');
        const MAX_ADVANCES = 24; // safety: max 24 cycles forward (2 years monthly)
        let advances = 0;
        while (d.toISOString().split('T')[0] <= today && advances < MAX_ADVANCES) {
          if (sub.cycle === 'monthly') d.setMonth(d.getMonth() + 1);
          else if (sub.cycle === '3month') d.setMonth(d.getMonth() + 3);
          else if (sub.cycle === '6month') d.setMonth(d.getMonth() + 6);
          else if (sub.cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
          else d.setMonth(d.getMonth() + 1); // fallback
          advances++;
        }

        const newDue = d.toISOString().split('T')[0];
        if (newDue !== sub.next_due) {
          sub.next_due = newDue; // update local copy
          advancePromises.push(
            supabase.from('subscriptions').update({ next_due: newDue }).eq('id', sub.id).eq('user_id', user.id)
          );
        }
      }

      if (advancePromises.length > 0) {
        await Promise.allSettled(advancePromises);
        console.log(`[useSubscriptions] auto-advanced ${advancePromises.length} subs`);
      }

      setSubs(rows);
    } catch (err) {
      console.warn('[useSubscriptions] fetch error:', err.message);
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
      console.warn('[useSubscriptions] add error:', err.message);
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
      console.warn('[useSubscriptions] update error:', err.message);
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
      console.warn('[useSubscriptions] delete error:', err.message);
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
    const limitStr = limit.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    return subs.filter(s =>
      s.active && s.next_due >= todayStr && s.next_due <= limitStr
    );
  }, [subs]);

  // ── Monthly cost ───────────────────────────────────────────
  const getMonthlyCost = useCallback(() => {
    return subs
      .filter(s => s.active)
      .reduce((sum, s) => {
        if (s.cycle === 'yearly') return sum + Math.round(s.amount / 12);
        if (s.cycle === '6month') return sum + Math.round(s.amount / 6);
        if (s.cycle === '3month') return sum + Math.round(s.amount / 3);
        return sum + s.amount;
      }, 0);
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

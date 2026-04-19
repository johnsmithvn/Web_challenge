import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useActiveJourney } from '../contexts/JourneyContext';

/**
 * useJourney — manages user journey lifecycle mutations.
 *
 * v1.8.0 change: activeJourney is now READ from JourneyContext
 * (single source of truth). All mutations call setActiveJourney
 * from context so JourneyContext, useHabitLogs, useFocusTimer
 * all stay in sync immediately after start/complete/renew/extend.
 *
 * Responsibilities:
 *  - Start a journey from a program template (inserts habits too)
 *  - Complete / renew / extend / archive a journey
 *  - Create default journey if none exists (backward compat)
 *  - Load journey history
 */

const LS_JOURNEY_KEY = 'vl_active_journey';

function saveLocalJourney(journey) {
  if (journey) localStorage.setItem(LS_JOURNEY_KEY, JSON.stringify(journey));
  else localStorage.removeItem(LS_JOURNEY_KEY);
}

export function useJourney() {
  const { user, isAuthenticated } = useAuth();
  // ── Read from JourneyContext — single source of truth ──────
  const {
    activeJourney,
    setActiveJourney,    // updates context immediately
    isLoadingJourney: isLoading,
    refetchJourney,      // re-fetch from Supabase if needed
  } = useActiveJourney();

  const useDB = isSupabaseEnabled && isAuthenticated;
  const [journeyHistory, setJourneyHistory] = useState([]);

  // ── Fetch journey history ─────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!useDB) return;
    try {
      const { data, error } = await supabase
        .from('user_journeys')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJourneyHistory(data || []);
    } catch (err) {
      console.warn('[useJourney] fetchHistory error:', err.message);
    }
  }, [useDB, user]);

  // ── Auto-wrap: create default journey if none exists ──────
  const ensureDefaultJourney = useCallback(async (activeHabits = []) => {
    if (!useDB) return null;

    const { data: existing } = await supabase
      .from('user_journeys')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) return existing;

    const today = new Date().toISOString().split('T')[0];
    const { data: newJourney, error: jErr } = await supabase
      .from('user_journeys')
      .insert({
        user_id:     user.id,
        title:       'Lộ Trình Của Tôi',
        started_at:  today,
        target_days: 21,
        status:      'active',
        cycle:       1,
      })
      .select()
      .single();

    if (jErr) { console.warn('[useJourney] ensureDefault error:', jErr.message); return null; }

    if (activeHabits.length) {
      const snaps = activeHabits.map((h, i) => ({
        journey_id: newJourney.id,
        habit_id:   h.id,
        name:       h.name,
        action:     h.action || null,
        icon:       h.icon || '✅',
        color:      h.color || '#8b5cf6',
        sort_order: i,
      }));
      await supabase.from('journey_habits').insert(snaps);

      await supabase
        .from('habits')
        .update({ journey_id: newJourney.id })
        .eq('user_id', user.id)
        .is('journey_id', null);
    }

    // ← Update context so all hooks see it immediately
    setActiveJourney(newJourney);
    saveLocalJourney(newJourney);
    return newJourney;
  }, [useDB, user, setActiveJourney]);

  // ── Start a journey from a program template ───────────────
  // habitMode: 'replace' (deactivate old habits) | 'append' (keep old + add new)
  const startJourney = useCallback(async ({ title, description, programId, targetDays, habits = [], habitMode = 'replace' }) => {
    const today = new Date().toISOString().split('T')[0];
    const payload = {
      user_id:     useDB ? user.id : 'guest',
      program_id:  programId || null,
      title,
      description: description || null,
      started_at:  today,
      target_days: targetDays || 21,
      status:      'active',
      cycle:       1,
    };

    if (!useDB) {
      const localJourney = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() };
      setActiveJourney(localJourney);
      saveLocalJourney(localJourney);
      return localJourney;
    }

    // 1. Archive any existing active journey first (preserves history)
    if (activeJourney) {
      await supabase
        .from('user_journeys')
        .update({ status: 'archived', ended_at: today })
        .eq('id', activeJourney.id);
    }

    // 2. Handle old habits based on habitMode
    if (habitMode === 'replace') {
      // Deactivate ALL old habits for this user (they belong to the old journey)
      await supabase
        .from('habits')
        .update({ active: false, status: 'conquered' })
        .eq('user_id', user.id)
        .eq('active', true);
    }
    // 'append' mode: leave old habits active, they'll carry over

    // 3. Create new journey
    const { data: newJourney, error } = await supabase
      .from('user_journeys')
      .insert(payload)
      .select()
      .single();

    if (error) { console.warn('[useJourney] startJourney error:', error.message); return null; }

    // 4. Insert template habits into user's habits table
    if (habits.length) {
      const habitRows = habits.map((h, i) => ({
        id:          crypto.randomUUID(),
        user_id:     user.id,
        name:        h.name,
        action:      h.action || h.name,
        icon:        h.icon || '✅',
        color:       h.color || '#8b5cf6',
        category:    h.category || 'other',
        status:      'active',
        cycle_count: 1,
        active:      true,
        journey_id:  newJourney.id,
        created_at:  new Date().toISOString(),
        sort_order:  i,
      }));

      const { data: insertedHabits, error: hErr } = await supabase
        .from('habits')
        .insert(habitRows)
        .select('id, name, icon, color');

      if (hErr) {
        console.warn('[useJourney] habit insert error:', hErr.message);
      } else {
        console.log(`[useJourney] Created ${insertedHabits?.length ?? 0} habits from template`);
      }

      // 5. Build journey_habits snapshot
      //    For 'append' mode, also snapshot the kept old habits
      const snapsFromNew = (insertedHabits || habits).map((h, i) => ({
        journey_id: newJourney.id,
        habit_id:   h.id || null,
        name:       h.name,
        action:     h.action || null,
        icon:       h.icon || '✅',
        color:      h.color || '#8b5cf6',
        sort_order: i,
      }));

      if (habitMode === 'append') {
        // Also snapshot old still-active habits
        const { data: oldActive } = await supabase
          .from('habits')
          .select('id, name, action, icon, color')
          .eq('user_id', user.id)
          .eq('active', true)
          .neq('journey_id', newJourney.id);

        const snapsFromOld = (oldActive || []).map((h, i) => ({
          journey_id: newJourney.id,
          habit_id:   h.id,
          name:       h.name,
          action:     h.action || null,
          icon:       h.icon || '✅',
          color:      h.color || '#8b5cf6',
          sort_order: snapsFromNew.length + i,
        }));

        // Update old habits to point to new journey
        if (oldActive?.length) {
          const oldIds = oldActive.map(h => h.id);
          await supabase
            .from('habits')
            .update({ journey_id: newJourney.id })
            .in('id', oldIds);
        }

        await supabase.from('journey_habits').insert([...snapsFromNew, ...snapsFromOld]);
      } else {
        await supabase.from('journey_habits').insert(snapsFromNew);
      }
    }

    // 6. Sync context immediately
    setActiveJourney(newJourney);
    saveLocalJourney(newJourney);
    return newJourney;
  }, [useDB, user, activeJourney, setActiveJourney]);

  // ── Complete journey ──────────────────────────────────────
  const completeJourney = useCallback(async () => {
    if (!activeJourney) return;
    const today = new Date().toISOString().split('T')[0];
    const updates = { status: 'completed', ended_at: today };

    if (useDB) {
      const { error } = await supabase
        .from('user_journeys')
        .update(updates)
        .eq('id', activeJourney.id);
      if (error) { console.warn('[useJourney] complete error:', error.message); return; }
    }

    const completed = { ...activeJourney, ...updates };
    setActiveJourney(null);          // ← clear context
    saveLocalJourney(null);
    setJourneyHistory(prev => [completed, ...prev]);
  }, [activeJourney, useDB, setActiveJourney]);

  // ── Renew journey (same habits, +1 cycle) ─────────────────
  const renewJourney = useCallback(async () => {
    if (!activeJourney) return;
    await completeJourney();

    const today = new Date().toISOString().split('T')[0];
    const payload = {
      user_id:     useDB ? user.id : 'guest',
      program_id:  activeJourney.program_id || null,
      title:       activeJourney.title,
      description: activeJourney.description || null,
      started_at:  today,
      target_days: activeJourney.target_days,
      status:      'active',
      cycle:       (activeJourney.cycle || 1) + 1,
    };

    if (!useDB) {
      const renewed = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() };
      setActiveJourney(renewed);
      saveLocalJourney(renewed);
      return renewed;
    }

    const { data, error } = await supabase.from('user_journeys').insert(payload).select().single();
    if (error) { console.warn('[useJourney] renew error:', error.message); return null; }

    setActiveJourney(data);          // ← sync context
    saveLocalJourney(data);
    return data;
  }, [activeJourney, useDB, user, completeJourney, setActiveJourney]);

  // ── Extend journey duration ───────────────────────────────
  const extendJourney = useCallback(async (extraDays) => {
    if (!activeJourney) return;
    const newTarget = (activeJourney.target_days || 21) + extraDays;

    if (useDB) {
      const { error } = await supabase
        .from('user_journeys')
        .update({ target_days: newTarget, status: 'extended' })
        .eq('id', activeJourney.id);
      if (error) { console.warn('[useJourney] extend error:', error.message); return; }
    }

    const updated = { ...activeJourney, target_days: newTarget, status: 'extended' };
    setActiveJourney(updated);       // ← sync context
    saveLocalJourney(updated);
  }, [activeJourney, useDB, setActiveJourney]);

  // ── Load history on mount ─────────────────────────────────
  useEffect(() => {
    if (useDB) fetchHistory();
  }, [useDB]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    activeJourney,       // from JourneyContext — always in sync
    journeyHistory,
    isLoading,
    startJourney,
    completeJourney,
    renewJourney,
    extendJourney,
    ensureDefaultJourney,
    refetchJourney,      // renamed from fetchActiveJourney — same function
    fetchHistory,
    // backward compat
    fetchActiveJourney: refetchJourney,
  };
}

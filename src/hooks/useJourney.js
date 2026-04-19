import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * useJourney — manages user journeys (program execution instances)
 *
 * Responsibilities:
 *  - Load active journey for current user
 *  - Auto-create default journey if none exists (backward compat)
 *  - Start a journey from a program template
 *  - Complete / extend / archive a journey
 *  - Load journey history
 */

const LS_JOURNEY_KEY = 'vl_active_journey'; // fallback for guests

// ── Local fallback helpers ────────────────────────────────
function loadLocalJourney() {
  try { return JSON.parse(localStorage.getItem(LS_JOURNEY_KEY) || 'null'); }
  catch { return null; }
}

function saveLocalJourney(journey) {
  if (journey) localStorage.setItem(LS_JOURNEY_KEY, JSON.stringify(journey));
  else localStorage.removeItem(LS_JOURNEY_KEY);
}

// ── Hook ──────────────────────────────────────────────────
export function useJourney() {
  const { user, isAuthenticated } = useAuth();
  const useDB = isSupabaseEnabled && isAuthenticated;

  const [activeJourney, setActiveJourney] = useState(loadLocalJourney);
  const [journeyHistory, setJourneyHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch active journey from Supabase ───────────────────
  const fetchActiveJourney = useCallback(async () => {
    if (!useDB) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_journeys')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setActiveJourney(data || null);
      saveLocalJourney(data || null);
    } catch (err) {
      console.warn('[useJourney] fetchActive error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [useDB, user]);

  // ── Fetch journey history ────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!useDB) return;
    try {
      const { data, error } = await supabase
        .from('user_journeys')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'active')
        .order('started_at', { ascending: false });

      if (error) throw error;
      setJourneyHistory(data || []);
    } catch (err) {
      console.warn('[useJourney] fetchHistory error:', err.message);
    }
  }, [useDB, user]);

  // ── Auto-wrap: create default journey if none exists ─────
  // Called once on authenticated load — backward compat for
  // users who had habits before Journey system was introduced.
  const ensureDefaultJourney = useCallback(async (activeHabits = []) => {
    if (!useDB) return null;

    // Already has active journey → nothing to do
    const { data: existing } = await supabase
      .from('user_journeys')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) return existing;

    // Create default journey
    const today = new Date().toISOString().split('T')[0];
    const { data: newJourney, error: jErr } = await supabase
      .from('user_journeys')
      .insert({
        user_id:    user.id,
        title:      'Lộ Trình Của Tôi',
        started_at: today,
        target_days: 21,
        status:     'active',
        cycle:      1,
      })
      .select()
      .single();

    if (jErr) { console.warn('[useJourney] ensureDefault error:', jErr.message); return null; }

    // Snapshot current active habits into journey_habits
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

      // Backfill journey_id on habits table
      await supabase
        .from('habits')
        .update({ journey_id: newJourney.id })
        .eq('user_id', user.id)
        .is('journey_id', null);
    }

    setActiveJourney(newJourney);
    saveLocalJourney(newJourney);
    return newJourney;
  }, [useDB, user]);

  // ── Start a journey from a program template ──────────────
  const startJourney = useCallback(async ({ title, description, programId, targetDays, habits }) => {
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
      // Guest fallback — only local
      const localJourney = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() };
      setActiveJourney(localJourney);
      saveLocalJourney(localJourney);
      return localJourney;
    }

    // Archive any existing active journey first
    if (activeJourney) {
      await supabase
        .from('user_journeys')
        .update({ status: 'archived', ended_at: today })
        .eq('id', activeJourney.id);
    }

    const { data: newJourney, error } = await supabase
      .from('user_journeys')
      .insert(payload)
      .select()
      .single();

    if (error) { console.warn('[useJourney] startJourney error:', error.message); return null; }

    // Snapshot habits
    if (habits?.length) {
      const snaps = habits.map((h, i) => ({
        journey_id: newJourney.id,
        habit_id:   h.id || null,
        name:       h.name,
        action:     h.action || null,
        icon:       h.icon || '✅',
        color:      h.color || '#8b5cf6',
        sort_order: i,
      }));
      await supabase.from('journey_habits').insert(snaps);
    }

    setActiveJourney(newJourney);
    saveLocalJourney(newJourney);
    return newJourney;
  }, [useDB, user, activeJourney]);

  // ── Complete journey ─────────────────────────────────────
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

    const updated = { ...activeJourney, ...updates };
    setActiveJourney(null);
    saveLocalJourney(null);
    setJourneyHistory(prev => [updated, ...prev]);
  }, [activeJourney, useDB]);

  // ── Renew journey (same habits, +1 cycle) ────────────────
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
    setActiveJourney(data);
    saveLocalJourney(data);
    return data;
  }, [activeJourney, useDB, user, completeJourney]);

  // ── Extend journey duration ──────────────────────────────
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
    setActiveJourney(updated);
    saveLocalJourney(updated);
  }, [activeJourney, useDB]);

  // ── Init ─────────────────────────────────────────────────
  useEffect(() => {
    if (useDB) {
      fetchActiveJourney();
      fetchHistory();
    }
  }, [useDB]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    activeJourney,       // Current active journey object | null
    journeyHistory,      // Past journeys []
    isLoading,
    startJourney,        // ({ title, programId, targetDays, habits }) => journey
    completeJourney,     // () => void
    renewJourney,        // () => new journey (same habits, cycle+1)
    extendJourney,       // (extraDays: number) => void
    ensureDefaultJourney,// (activeHabits[]) => journey — auto-wrap on first load
    fetchActiveJourney,
    fetchHistory,
  };
}

import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useActiveJourney } from '../contexts/JourneyContext';

/**
 * useHabitLogs — per-habit daily completion tracking
 *
 * Provides `habitProg` shape: { "YYYY-MM-DD_habitId": true }
 * so all existing UI components work without changes.
 *
 * Data flow:
 *   Authenticated  → Supabase habit_logs (sole source of truth)
 *   Guest          → in-memory only (resets on refresh)
 *
 * One-time migration: on first auth login, transfers vl_habit_progress
 * localStorage data to Supabase, then wipes local copy.
 */

const LS_LEGACY   = 'vl_habit_progress';
const LS_MIGRATED = 'vl_habit_logs_migrated';

/** Validate UUID v4 — default habits use short IDs like h1, h2, h3 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

/** Supabase rows → { "date_habitId": true } */
function rowsToMap(rows) {
  return rows.reduce((acc, row) => {
    if (row.status === 'completed') {
      acc[`${row.log_date}_${row.habit_id}`] = true;
    }
    return acc;
  }, {});
}

/** Local map → array of Supabase insert objects (skips non-UUID IDs) */
function mapToInserts(prog, userId, journeyId) {
  return Object.entries(prog)
    .filter(([, v]) => v)
    .map(([key]) => {
      const idx     = key.indexOf('_');
      const date    = key.slice(0, idx);
      const habitId = key.slice(idx + 1);
      return { date, habitId };
    })
    .filter(({ habitId }) => isValidUUID(habitId))
    .map(({ date, habitId }) => ({
      user_id:    userId,
      habit_id:   habitId,
      journey_id: journeyId || null,
      log_date:   date,
      status:     'completed',
    }));
}

// ── Hook ──────────────────────────────────────────────────────
export function useHabitLogs(journeyId = null) {
  const { user, isAuthenticated } = useAuth();
  const { activeJourney } = useActiveJourney();  // ← from JourneyContext
  const useDB = isSupabaseEnabled && isAuthenticated;

  // Prefer explicit journeyId prop; fallback to context's active journey
  const effectiveJourneyId = journeyId ?? activeJourney?.id ?? null;

  // In-memory map: guest gets empty, authenticated loads from Supabase
  const [habitProg, setHabitProg] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch from Supabase ─────────────────────────────────────
  const fetchFromDB = useCallback(async () => {
    if (!useDB || !user) return;
    setIsLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const sinceStr = since.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('habit_logs')
        .select('habit_id, log_date, status')
        .eq('user_id', user.id)
        .gte('log_date', sinceStr)
        .order('log_date', { ascending: false });

      if (error) throw error;
      setHabitProg(rowsToMap(data || []));
    } catch (err) {
      console.warn('[useHabitLogs] fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [useDB, user]);

  // ── One-time migration: localStorage → Supabase → wipe ─────
  const migrateFromLocal = useCallback(async () => {
    if (!useDB || !user) return;
    if (localStorage.getItem(LS_MIGRATED)) return;

    try {
      const local = JSON.parse(localStorage.getItem(LS_LEGACY) || '{}');
      const inserts = mapToInserts(local, user.id, journeyId);
      if (inserts.length) {
        const { error } = await supabase
          .from('habit_logs')
          .upsert(inserts, { onConflict: 'user_id,habit_id,log_date', ignoreDuplicates: true });
        if (error) throw error;
        console.log(`[useHabitLogs] Migrated ${inserts.length} entries from localStorage`);
      }
      localStorage.removeItem(LS_LEGACY); // wipe after migration
      localStorage.setItem(LS_MIGRATED, '1');
    } catch (err) {
      console.warn('[useHabitLogs] migration error:', err.message);
    }
  }, [useDB, user, journeyId]);

  // ── Init on login ───────────────────────────────────────────
  useEffect(() => {
    if (!useDB) return;
    migrateFromLocal().then(fetchFromDB);
  }, [useDB]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clear on logout ─────────────────────────────────────────
  useEffect(() => {
    if (!useDB) setHabitProg({});
  }, [useDB]);

  // ── Listen for focus:habit-tick from useFocusTimer ──────────
  useEffect(() => {
    if (!useDB || !user) return;

    const handler = async (e) => {
      const { habitId, date, totalFocusMin } = e.detail;
      if (!isValidUUID(habitId)) return;

      // Find habit's durationMin target from Supabase
      const { data: habitRow } = await supabase
        .from('habits')
        .select('duration_min')
        .eq('id', habitId)
        .eq('user_id', user.id)
        .maybeSingle();

      const target  = habitRow?.duration_min ?? 25;
      const key     = `${date}_${habitId}`;
      const already = !!habitProg[key];

      if (!already && totalFocusMin >= target) {
        // Auto-tick: insert into habit_logs
        const { error } = await supabase.from('habit_logs').upsert({
          user_id:    user.id,
          habit_id:   habitId,
          journey_id: effectiveJourneyId,
          log_date:   date,
          status:     'completed',
        }, { onConflict: 'user_id,habit_id,log_date' });

        if (!error) {
          setHabitProg(prev => ({ ...prev, [key]: true }));
          console.log(`[useHabitLogs] Auto-ticked habit ${habitId} via focus session`);
        }
      }
    };

    window.addEventListener('focus:habit-tick', handler);
    return () => window.removeEventListener('focus:habit-tick', handler);
  }, [useDB, user, habitProg, effectiveJourneyId]);

  // ── Toggle ─────────────────────────────────────────────────
  const toggleLog = useCallback(async (habitId, dateStr = null) => {
    const today  = dateStr || new Date().toISOString().split('T')[0];
    const key    = `${today}_${habitId}`;
    const wasDone = !!habitProg[key];

    // Optimistic update
    setHabitProg(prev => ({ ...prev, [key]: !wasDone }));

    if (useDB && isValidUUID(habitId)) {
      try {
        if (!wasDone) {
          const { error } = await supabase.from('habit_logs').upsert({
            user_id:    user.id,
            habit_id:   habitId,
            journey_id: effectiveJourneyId,
            log_date:   today,
            status:     'completed',
          }, { onConflict: 'user_id,habit_id,log_date' });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('habit_logs')
            .delete()
            .eq('user_id', user.id)
            .eq('habit_id', habitId)
            .eq('log_date', today);
          if (error) throw error;
        }
      } catch (err) {
        console.warn('[useHabitLogs] toggle error, rolling back:', err.message);
        setHabitProg(prev => ({ ...prev, [key]: wasDone })); // rollback
      }
    }
  }, [habitProg, useDB, user, effectiveJourneyId]);

  // ── Date range query ────────────────────────────────────────
  const getLogsInRange = useCallback(async (startDate, endDate, filterJourneyId = null) => {
    if (!useDB) {
      return Object.entries(habitProg)
        .filter(([key, v]) => { const d = key.split('_')[0]; return v && d >= startDate && d <= endDate; })
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
    }

    const query = supabase
      .from('habit_logs')
      .select('habit_id, log_date, status')
      .eq('user_id', user.id)
      .gte('log_date', startDate)
      .lte('log_date', endDate)
      .eq('status', 'completed');

    if (filterJourneyId) query.eq('journey_id', filterJourneyId);

    const { data, error } = await query;
    if (error) { console.warn('[useHabitLogs] getLogsInRange error:', error.message); return {}; }
    return rowsToMap(data || []);
  }, [useDB, user, habitProg]);

  return {
    habitProg,        // { "YYYY-MM-DD_habitId": true }
    toggleLog,        // (habitId, dateStr?) => void
    getLogsInRange,   // (start, end, journeyId?) => Promise<map>
    migrateFromLocal,
    fetchFromDB,
    isLoading,
  };
}

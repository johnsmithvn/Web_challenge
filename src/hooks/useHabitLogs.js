import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * useHabitLogs — replaces vl_habit_progress (localStorage)
 *
 * Provides the same `habitProg` shape: { "YYYY-MM-DD_habitId": true }
 * so all existing UI components work without changes.
 *
 * Data flow:
 *   Authenticated  → Supabase habit_logs (source of truth)
 *   Guest          → localStorage vl_habit_progress (fallback)
 *
 * One-time migration: on first authenticated load, transfers any
 * existing localStorage data to Supabase and clears local copy.
 */

const LS_KEY     = 'vl_habit_progress';
const LS_MIGRATED = 'vl_habit_logs_migrated';

// ── Local helpers ──────────────────────────────────────────
function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}

function saveLocal(prog) {
  localStorage.setItem(LS_KEY, JSON.stringify(prog));
}

/** Validate UUID v4 format — default habits use short IDs like h1, h2, h3 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

/** Convert Supabase habit_logs rows → { "date_habitId": true } */
function rowsToMap(rows) {
  return rows.reduce((acc, row) => {
    if (row.status === 'completed') {
      acc[`${row.log_date}_${row.habit_id}`] = true;
    }
    return acc;
  }, {});
}

/** Convert local map → array of insert objects (skips non-UUID habit IDs) */
function mapToInserts(prog, userId, journeyId) {
  return Object.entries(prog)
    .filter(([, v]) => v)
    .map(([key]) => {
      const underscoreIdx = key.indexOf('_');
      const date    = key.slice(0, underscoreIdx);
      const habitId = key.slice(underscoreIdx + 1);
      return { date, habitId };
    })
    .filter(({ habitId }) => isValidUUID(habitId)) // skip h1, h2, h3 etc.
    .map(({ date, habitId }) => ({
      user_id:    userId,
      habit_id:   habitId,
      journey_id: journeyId || null,
      log_date:   date,
      status:     'completed',
    }));
}

// ── Hook ──────────────────────────────────────────────────
export function useHabitLogs(journeyId = null) {
  const { user, isAuthenticated } = useAuth();
  const useDB = isSupabaseEnabled && isAuthenticated;

  const [habitProg, setHabitProg] = useState(loadLocal);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch from Supabase (authenticated) ──────────────────
  const fetchFromDB = useCallback(async () => {
    if (!useDB) return;
    setIsLoading(true);
    try {
      // Fetch last 90 days to cover any visible history windows
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
      const map = rowsToMap(data || []);
      setHabitProg(map);
      // Keep local in sync (offline read)
      saveLocal(map);
    } catch (err) {
      console.warn('[useHabitLogs] fetch error, using local:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [useDB, user]);

  // ── One-time migration: localStorage → Supabase ──────────
  const migrateFromLocal = useCallback(async () => {
    if (!useDB) return;
    if (localStorage.getItem(LS_MIGRATED)) return; // already done

    const local = loadLocal();
    if (!Object.keys(local).length) {
      localStorage.setItem(LS_MIGRATED, '1');
      return;
    }

    try {
      const inserts = mapToInserts(local, user.id, journeyId);
      if (inserts.length) {
        // upsert: do nothing on conflict (unique constraint user+habit+date)
        const { error } = await supabase
          .from('habit_logs')
          .upsert(inserts, { onConflict: 'user_id,habit_id,log_date', ignoreDuplicates: true });
        if (error) throw error;
      }
      localStorage.setItem(LS_MIGRATED, '1');
      // Don't clear LS yet — keep as offline fallback
      await fetchFromDB(); // refresh from DB after migration
    } catch (err) {
      console.warn('[useHabitLogs] migration error:', err.message);
    }
  }, [useDB, user, journeyId, fetchFromDB]);

  // ── Init ─────────────────────────────────────────────────
  useEffect(() => {
    if (useDB) {
      migrateFromLocal().then(fetchFromDB);
    }
  }, [useDB]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle (tick / untick) a habit for today ─────────────
  const toggleLog = useCallback(async (habitId, dateStr = null) => {
    const today = dateStr || new Date().toISOString().split('T')[0];
    const key   = `${today}_${habitId}`;
    const wasDone = !!habitProg[key];

    // Optimistic update (always — works for both local and DB habits)
    const next = { ...habitProg, [key]: !wasDone };
    setHabitProg(next);
    saveLocal(next);

    // Skip DB sync for non-UUID habit IDs (default habits: h1, h2, h3...)
    // These habits need to be synced to Supabase habits table first via useCustomHabits
    if (useDB && isValidUUID(habitId)) {
      try {
        if (!wasDone) {
          const { error } = await supabase.from('habit_logs').upsert({
            user_id:    user.id,
            habit_id:   habitId,
            journey_id: journeyId || null,
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
        console.warn('[useHabitLogs] toggle error, kept local:', err.message);
        // Rollback optimistic update on DB error
        setHabitProg(habitProg);
        saveLocal(habitProg);
      }
    }
  }, [habitProg, useDB, user, journeyId]);

  // ── Get logs within a date range (for history views) ─────
  const getLogsInRange = useCallback(async (startDate, endDate, filterJourneyId = null) => {
    if (!useDB) {
      // Filter local map by date range
      return Object.entries(habitProg)
        .filter(([key, v]) => {
          const date = key.split('_')[0];
          return v && date >= startDate && date <= endDate;
        })
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
    habitProg,       // { "YYYY-MM-DD_habitId": true } — drop-in replacement
    toggleLog,       // (habitId, dateStr?) => void
    getLogsInRange,  // (start, end, journeyId?) => Promise<map>
    migrateFromLocal,
    fetchFromDB,
    isLoading,
  };
}

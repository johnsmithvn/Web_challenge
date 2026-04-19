import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ── UI state flags (NOT data) — these stay in localStorage forever ──
// vl_program_round, vl_completion_shown_*, vl_login_nudge_shown → OK
// vl_habit_data → REMOVED. Primary source is now Supabase `progress`.
// Guest fallback (not authenticated) → in-memory only (resets on refresh).

const LEGACY_LS_KEY  = 'vl_habit_data';   // kept only to read + clear on migration
const MIGRATED_KEY   = 'vl_migrated_v2';  // bump key so old migrated flag doesn't block

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getWeekDates() {
  const today  = new Date();
  const day    = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function calcStreak(data) {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (data[key]) streak++;
    else break;
  }
  return streak;
}

function getLongestStreak(data) {
  const keys = Object.keys(data).filter(k => data[k]).sort();
  if (!keys.length) return 0;
  let longest = 1, current = 1;
  for (let i = 1; i < keys.length; i++) {
    const diff = (new Date(keys[i]) - new Date(keys[i - 1])) / 86400000;
    if (diff === 1) { current++; longest = Math.max(longest, current); }
    else current = 1;
  }
  return longest;
}

export function getBadge(streak) {
  if (streak >= 21) return { emoji: '🏆', label: 'Hoàn Thành', color: 'gold' };
  if (streak >= 10) return { emoji: '🟡', label: 'Bứt Phá',    color: 'gold' };
  if (streak >= 3)  return { emoji: '🟢', label: 'Lấy Đà',     color: 'green' };
  return null;
}

// One-time migration: localStorage → Supabase, then wipe localStorage copy
async function migrateLocalToSupabase(userId) {
  if (localStorage.getItem(MIGRATED_KEY) === userId) return;

  try {
    const local   = JSON.parse(localStorage.getItem(LEGACY_LS_KEY) || '{}');
    const entries = Object.entries(local).filter(([, v]) => v);

    if (entries.length) {
      const rows = entries.map(([date]) => ({
        user_id:   userId,
        date,
        completed: true,
        week_num:  1, // approximate
      }));
      await supabase
        .from('progress')
        .upsert(rows, { onConflict: 'user_id,date' });
      console.log(`[HabitStore] Migrated ${rows.length} entries from localStorage`);
    }

    // Wipe local copy — Supabase is now the sole source
    localStorage.removeItem(LEGACY_LS_KEY);
    localStorage.setItem(MIGRATED_KEY, userId);
  } catch (e) {
    console.warn('[HabitStore] Migration failed (will retry next session):', e.message);
  }
}

export function useHabitStore() {
  const { user, isAuthenticated } = useAuth();
  const useDB = isSupabaseEnabled && isAuthenticated;

  // In-memory state:
  // - Authenticated users: loaded from Supabase on mount, kept in React state
  // - Guests: in-memory only (will reset on refresh — acceptable, no account = no persistence)
  const [data, setData]         = useState({});
  const [loadingDB, setLoading] = useState(false);

  // On login: migrate leftover localStorage → Supabase, then load fresh from DB
  useEffect(() => {
    if (!useDB || !user) return;

    setLoading(true);

    migrateLocalToSupabase(user.id).then(async () => {
      const { data: rows, error } = await supabase
        .from('progress')
        .select('date, completed')
        .eq('user_id', user.id);

      if (!error && rows) {
        const fresh = {};
        rows.forEach(r => { fresh[r.date] = r.completed; });
        setData(fresh);
      }
      setLoading(false);
    });
  }, [useDB, user?.id]);

  // On logout (useDB becomes false): clear in-memory data (no stale data shown)
  useEffect(() => {
    if (!useDB) setData({});
  }, [useDB]);

  const toggle = useCallback(async (dateKey) => {
    const next = !data[dateKey];

    const checkedDates = Object.keys(data).filter(k => data[k]).sort();
    const programStart = checkedDates[0] || dateKey;
    const diffDays     = Math.floor((new Date(dateKey) - new Date(programStart)) / 86400000);
    const weekNum      = Math.min(Math.floor(diffDays / 7) + 1, 3);

    // Optimistic update (in-memory only)
    setData(prev => ({ ...prev, [dateKey]: next }));

    if (useDB && user) {
      const { error } = await supabase
        .from('progress')
        .upsert(
          { user_id: user.id, date: dateKey, completed: next,
            week_num: weekNum, completed_at: next ? new Date().toISOString() : null },
          { onConflict: 'user_id,date' }
        );

      if (error) {
        // Rollback optimistic update on DB failure
        console.warn('[HabitStore] toggle failed, rolling back:', error.message);
        setData(prev => ({ ...prev, [dateKey]: !next }));
      }
    }
    // Guest: in-memory only, acceptable, no rollback needed
  }, [data, useDB, user]);

  const weekDates     = getWeekDates();
  const streak        = calcStreak(data);
  const longestStreak = getLongestStreak(data);
  const totalDone     = Object.values(data).filter(Boolean).length;
  const weekDone      = weekDates.filter(d => data[d]).length;
  const completionPct = Math.round((weekDone / 7) * 100);
  const badge         = getBadge(streak);
  const todayDone     = !!data[getTodayKey()];

  return {
    data, toggle, loadingDB,
    weekDates, streak, longestStreak,
    totalDone, weekDone, completionPct,
    badge, todayDone,
    isDBMode: useDB,
  };
}

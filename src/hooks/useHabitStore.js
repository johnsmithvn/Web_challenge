import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'vl_habit_data';
const MIGRATED_KEY = 'vl_migrated';

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
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

// Migrate localStorage → Supabase on first login
async function migrateLocalToSupabase(userId) {
  if (localStorage.getItem(MIGRATED_KEY) === userId) return;
  try {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const entries = Object.entries(local).filter(([, v]) => v);
    if (!entries.length) { localStorage.setItem(MIGRATED_KEY, userId); return; }

    const rows = entries.map(([date]) => ({
      user_id:   userId,
      date,
      completed: true,
      week_num:  1, // approximate
    }));

    // upsert (ignore conflicts)
    await supabase.from('progress').upsert(rows, { onConflict: 'user_id,date' });
    localStorage.setItem(MIGRATED_KEY, userId);
    console.log(`[HabitStore] Migrated ${rows.length} entries to Supabase`);
  } catch (e) {
    console.warn('[HabitStore] Migration failed:', e.message);
  }
}

export function useHabitStore() {
  const { user, isAuthenticated } = useAuth();
  const useDB = isSupabaseEnabled && isAuthenticated;

  // Local state (always kept in sync as cache)
  const [data, setData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  });
  const [loadingDB, setLoadingDB] = useState(false);

  // On login: migrate + fetch from DB
  useEffect(() => {
    if (!useDB || !user) return;
    setLoadingDB(true);

    migrateLocalToSupabase(user.id).then(async () => {
      const { data: rows } = await supabase
        .from('progress')
        .select('date, completed')
        .eq('user_id', user.id);

      if (rows) {
        const fresh = {};
        rows.forEach(r => { fresh[r.date] = r.completed; });
        setData(fresh);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      }
      setLoadingDB(false);
    });
  }, [useDB, user?.id]);

  const toggle = useCallback(async (dateKey) => {
    const next = !data[dateKey];

    // Compute week number from earliest checked date (program start)
    const checkedDates = Object.keys(data).filter(k => data[k]).sort();
    const programStart = checkedDates[0] || dateKey;
    const diffDays = Math.floor(
      (new Date(dateKey) - new Date(programStart)) / 86400000
    );
    const weekNum = Math.min(Math.floor(diffDays / 7) + 1, 3); // cap at 3

    // Optimistic update
    setData(prev => {
      const updated = { ...prev, [dateKey]: next };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    // Sync to DB if authenticated
    if (useDB && user) {
      await supabase.from('progress').upsert(
        { user_id: user.id, date: dateKey, completed: next, week_num: weekNum,
          completed_at: next ? new Date().toISOString() : null },
        { onConflict: 'user_id,date' }
      );
    }
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

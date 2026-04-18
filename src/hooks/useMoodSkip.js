import { useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const MOOD_KEY = 'vl_mood_log';
const SKIP_KEY = 'vl_skip_';

// ── Mood ──────────────────────────────────────────────────
export function useMoodLog() {
  const { user, isAuthenticated } = useAuth();
  const useDB = isSupabaseEnabled && isAuthenticated;

  const [moodLog, setMoodLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem(MOOD_KEY) || '{}'); }
    catch { return {}; }
  });

  const saveMood = useCallback(async (date, mood) => {
    const next = { ...moodLog, [date]: mood };
    localStorage.setItem(MOOD_KEY, JSON.stringify(next));
    setMoodLog(next);

    if (useDB && user) {
      await supabase.from('mood_logs').upsert({
        user_id:    user.id,
        date,
        mood_emoji: mood.emoji,
        mood_label: mood.label,
      }, { onConflict: 'user_id,date' });
    }
  }, [moodLog, useDB, user]);

  const getMood = useCallback((date) => moodLog[date] ?? null, [moodLog]);

  return { moodLog, saveMood, getMood };
}

// ── Skip Reason ───────────────────────────────────────────
export function useSkipReasons() {
  const { user, isAuthenticated } = useAuth();
  const useDB = isSupabaseEnabled && isAuthenticated;

  const [skipLog, setSkipLog] = useState(() => {
    const map = {};
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(SKIP_KEY))
        .forEach(k => {
          const date = k.replace(SKIP_KEY, '');
          map[date] = JSON.parse(localStorage.getItem(k));
        });
    } catch {}
    return map;
  });

  const saveSkip = useCallback(async (date, reason, note = '') => {
    const entry = { date, reason, note };
    localStorage.setItem(SKIP_KEY + date, JSON.stringify(entry));
    setSkipLog(prev => ({ ...prev, [date]: entry }));

    if (useDB && user) {
      await supabase.from('skip_reasons').upsert({
        user_id: user.id,
        date,
        reason,
        note: note || null,
      }, { onConflict: 'user_id,date' });
    }
  }, [useDB, user]);

  const getSkip    = useCallback((date) => skipLog[date] ?? null, [skipLog]);
  const getAllSkips = useCallback(() => Object.values(skipLog), [skipLog]);

  return { skipLog, saveSkip, getSkip, getAllSkips };
}

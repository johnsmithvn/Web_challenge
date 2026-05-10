import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';


// ── Skip Reason ───────────────────────────────────────────
// Primary: Supabase skip_reasons (when authenticated)
// Guest:   in-memory only
export function useSkipReasons() {
  const { user, isAuthenticated } = useAuth();
  const useDB = isSupabaseEnabled && isAuthenticated;

  const [skipLog, setSkipLog] = useState({});

  // Load from Supabase on login
  useEffect(() => {
    if (!useDB || !user) return;
    supabase
      .from('skip_reasons')
      .select('date, reason, note')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!error && data) {
          const map = {};
          data.forEach(r => { map[r.date] = { date: r.date, reason: r.reason, note: r.note }; });
          setSkipLog(map);
        }
      });
  }, [useDB, user?.id]);

  // Clear on logout
  useEffect(() => {
    if (!useDB) setSkipLog({});
  }, [useDB]);

  const saveSkip = useCallback(async (date, reason, note = '') => {
    const entry = { date, reason, note };
    setSkipLog(prev => ({ ...prev, [date]: entry }));

    if (useDB && user) {
      const { error } = await supabase.from('skip_reasons').upsert({
        user_id: user.id,
        date,
        reason,
        note: note || null,
      }, { onConflict: 'user_id,date' });

      if (error) {
        console.warn('[SkipReasons] save failed:', error.message);
        setSkipLog(prev => { const next = { ...prev }; delete next[date]; return next; });
      }
    }
  }, [useDB, user]);

  const getSkip    = useCallback((date) => skipLog[date] ?? null, [skipLog]);
  const getAllSkips = useCallback(() => Object.values(skipLog), [skipLog]);

  return { skipLog, saveSkip, getSkip, getAllSkips };
}

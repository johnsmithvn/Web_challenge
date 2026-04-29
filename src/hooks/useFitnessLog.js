import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

let _supabase = null;
async function getSb() {
  if (!_supabase) {
    const mod = await import('../lib/supabase');
    _supabase = mod.supabase;
  }
  return _supabase;
}

const ENERGY_LABELS = { good: '😊 Tốt', normal: '😐 Bình thường', bad: '😞 Tệ' };

/**
 * useFitnessLog — Phase 1: Simple fitness session logging.
 *
 * Scope: add, delete, query today + week summary.
 * No edit in Phase 1 (documented technical debt).
 */
export function useFitnessLog() {
  const { user } = useAuth();
  const isAuth = !!user;
  const userId = user?.id;

  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // ── Fetch logs (last 7 days by default) ───────────────────
  const fetchLogs = useCallback(async (days = 7) => {
    if (!isAuth || !userId) return;
    setIsLoading(true);
    try {
      const sb = await getSb();
      if (!sb) return;

      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split('T')[0];

      const { data, error } = await sb
        .from('fitness_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', sinceStr)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useFitnessLog] fetch error:', error.message);
      } else {
        setLogs(data || []);
      }
    } catch (err) {
      console.error('[useFitnessLog] fetch exception:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuth, userId]);

  useEffect(() => {
    if (isAuth && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchLogs();
    }
    if (!isAuth) {
      fetchedRef.current = false;
      setLogs([]);
    }
  }, [isAuth, fetchLogs]);

  // ── Add log ───────────────────────────────────────────────
  const addLog = useCallback(async ({ session_name, duration_min, energy, notes, date }) => {
    if (!isAuth || !userId || !session_name?.trim() || !duration_min || !energy) return null;
    try {
      const sb = await getSb();
      if (!sb) return null;

      const { data, error } = await sb
        .from('fitness_logs')
        .insert({
          user_id: userId,
          session_name: session_name.trim(),
          duration_min: parseInt(duration_min, 10),
          energy,
          notes: notes?.trim() || null,
          date: date || todayStr,
        })
        .select()
        .single();

      if (error) {
        console.error('[useFitnessLog] add error:', error.message);
        return null;
      }

      setLogs(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('[useFitnessLog] add exception:', err);
      return null;
    }
  }, [isAuth, userId, todayStr]);

  // ── Delete log ────────────────────────────────────────────
  const deleteLog = useCallback(async (id) => {
    if (!isAuth) return false;
    try {
      const sb = await getSb();
      if (!sb) return false;

      const { error } = await sb
        .from('fitness_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('[useFitnessLog] delete error:', error.message);
        return false;
      }

      setLogs(prev => prev.filter(l => l.id !== id));
      return true;
    } catch (err) {
      console.error('[useFitnessLog] delete exception:', err);
      return false;
    }
  }, [isAuth, userId]);

  // ── Derived: today's logs ─────────────────────────────────
  const todayLogs = useMemo(() =>
    logs.filter(l => l.date === todayStr),
    [logs, todayStr]
  );

  // ── Derived: week summary ─────────────────────────────────
  const weekSummary = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 6);
    const weekStr = weekAgo.toISOString().split('T')[0];

    const weekLogs = logs.filter(l => l.date >= weekStr);
    const totalMin = weekLogs.reduce((s, l) => s + l.duration_min, 0);
    const uniqueDays = new Set(weekLogs.map(l => l.date)).size;

    return { sessions: weekLogs.length, totalMin, uniqueDays };
  }, [logs]);

  return {
    logs,
    isLoading,
    todayLogs,
    weekSummary,
    addLog,
    deleteLog,
    fetchLogs,
    ENERGY_LABELS,
  };
}

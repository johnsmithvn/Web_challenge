import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

let _supabase = null;
async function getSb() {
  if (!_supabase) {
    const mod = await import('../lib/supabase');
    _supabase = mod.supabase;
  }
  return _supabase;
}

const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * useUserTasks — Personal task CRUD, Supabase-first.
 *
 * Tasks are independent from habits/journey/XP.
 * Guest = in-memory (reset on refresh).
 */
export function useUserTasks() {
  const { user } = useAuth();
  const isAuth = !!user;
  const userId = user?.id;

  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  // ── Fetch tasks: pending + completed today ─────────────
  const fetchTasks = useCallback(async () => {
    if (!isAuth || !userId) return;
    setIsLoading(true);
    try {
      const sb = await getSb();
      if (!sb) return;

      const today = todayStr();

      // Pending tasks (any date) + completed today
      const { data, error } = await sb
        .from('user_tasks')
        .select('*')
        .eq('user_id', userId)
        .or(`completed.eq.false,and(completed.eq.true,completed_at.gte.${today}T00:00:00,completed_at.lt.${today}T23:59:59)`)
        .order('due_date', { ascending: true })
        .order('due_time', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('[useUserTasks] fetch error:', error.message);
      } else {
        setTasks(data || []);
      }
    } catch (err) {
      console.error('[useUserTasks] fetch exception:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuth, userId]);

  useEffect(() => {
    if (isAuth && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchTasks();
    }
    if (!isAuth) {
      fetchedRef.current = false;
    }
  }, [isAuth, fetchTasks]);

  // ── Add task ───────────────────────────────────────────
  const addTask = useCallback(async ({ title, description, dueDate, dueTime }) => {
    const newTask = {
      id: crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`,
      user_id: userId,
      title,
      description: description || null,
      due_date: dueDate || todayStr(),
      due_time: dueTime || null,
      completed: false,
      completed_at: null,
      notified: false,
      created_at: new Date().toISOString(),
    };

    // Optimistic
    setTasks(prev => [...prev, newTask]);

    if (isAuth) {
      try {
        const sb = await getSb();
        if (!sb) return newTask;

        const { id, user_id, ...rest } = newTask;
        const { data, error } = await sb
          .from('user_tasks')
          .insert({ ...rest, user_id: userId })
          .select()
          .single();

        if (error) {
          console.error('[useUserTasks] add error:', error.message);
          // Rollback
          setTasks(prev => prev.filter(t => t.id !== newTask.id));
          return null;
        }
        // Replace optimistic with real
        setTasks(prev => prev.map(t => t.id === newTask.id ? data : t));
        return data;
      } catch (err) {
        console.error('[useUserTasks] add exception:', err);
        setTasks(prev => prev.filter(t => t.id !== newTask.id));
        return null;
      }
    }
    return newTask;
  }, [isAuth, userId]);

  // ── Complete task ──────────────────────────────────────
  const completeTask = useCallback(async (taskId) => {
    const now = new Date().toISOString();

    // Optimistic
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed: true, completed_at: now } : t
    ));

    if (isAuth) {
      try {
        const sb = await getSb();
        if (!sb) return;

        const { error } = await sb
          .from('user_tasks')
          .update({ completed: true, completed_at: now })
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
          console.error('[useUserTasks] complete error:', error.message);
          // Rollback
          setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, completed: false, completed_at: null } : t
          ));
        }
      } catch (err) {
        console.error('[useUserTasks] complete exception:', err);
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, completed: false, completed_at: null } : t
        ));
      }
    }
  }, [isAuth, userId]);

  // ── Delete task ────────────────────────────────────────
  const deleteTask = useCallback(async (taskId) => {
    const backup = tasks.find(t => t.id === taskId);

    // Optimistic
    setTasks(prev => prev.filter(t => t.id !== taskId));

    if (isAuth && backup) {
      try {
        const sb = await getSb();
        if (!sb) return;

        const { error } = await sb
          .from('user_tasks')
          .delete()
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
          console.error('[useUserTasks] delete error:', error.message);
          setTasks(prev => [...prev, backup]);
        }
      } catch (err) {
        console.error('[useUserTasks] delete exception:', err);
        setTasks(prev => [...prev, backup]);
      }
    }
  }, [isAuth, userId, tasks]);

  // ── Get completed tasks by date (for calendar) ────────
  const getCompletedTasks = useCallback(async (dateStr) => {
    if (!isAuth || !userId) return [];

    try {
      const sb = await getSb();
      if (!sb) return [];

      const { data, error } = await sb
        .from('user_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('completed_at', `${dateStr}T00:00:00`)
        .lt('completed_at', `${dateStr}T23:59:59`)
        .order('completed_at', { ascending: true });

      if (error) {
        console.error('[useUserTasks] getCompleted error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('[useUserTasks] getCompleted exception:', err);
      return [];
    }
  }, [isAuth, userId]);

  // ── Sync pending tasks to Service Worker ──────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const todayTasks = tasks.filter(t =>
      !t.completed && t.due_date === todayStr() && t.due_time
    ).map(t => ({
      id: t.id,
      title: t.title,
      due_time: t.due_time,
      notified: t.notified,
    }));

    navigator.serviceWorker.ready.then(reg => {
      if (reg.active) {
        reg.active.postMessage({
          type: 'SYNC_TASKS',
          tasks: todayTasks,
        });
      }
    }).catch(() => {});
  }, [tasks]);

  // Derived: split pending vs completed today
  const pendingTasks = tasks.filter(t => !t.completed);
  const completedToday = tasks.filter(t => t.completed);

  return {
    tasks,
    pendingTasks,
    completedToday,
    isLoading,
    addTask,
    completeTask,
    deleteTask,
    getCompletedTasks,
  };
}

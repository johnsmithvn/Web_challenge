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

// ── Date helpers for recurring tasks ────────────────────────
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function nextWeekday(targetDay) {
  // targetDay: 0=Sun, 1=Mon, ..., 6=Sat
  const d = new Date();
  const current = d.getDay();
  let diff = targetDay - current;
  if (diff <= 0) diff += 7; // always go to NEXT occurrence
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function nextMonthDay(targetDay) {
  const d = new Date();
  const today = d.getDate();
  if (today < targetDay) {
    d.setDate(targetDay);
  } else {
    d.setMonth(d.getMonth() + 1);
    d.setDate(targetDay);
  }
  return d.toISOString().split('T')[0];
}

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
  // v4.5.0: Embedded select for task_collections junction with graceful fallback
  const fetchTasks = useCallback(async () => {
    if (!isAuth || !userId) return;
    setIsLoading(true);
    try {
      const sb = await getSb();
      if (!sb) return;

      const today = todayStr();
      const filter = `completed.eq.false,and(completed.eq.true,completed_at.gte.${today}T00:00:00,completed_at.lt.${today}T23:59:59)`;

      // Try with task_collections join first (v4.5.0)
      let { data, error } = await sb
        .from('user_tasks')
        .select('*, task_collections(collection_id, collections(id, title, type))')
        .eq('user_id', userId)
        .or(filter)
        .order('due_date', { ascending: true })
        .order('due_time', { ascending: true, nullsFirst: false });

      // Fallback: if task_collections table doesn't exist yet (migration not run)
      if (error) {
        console.warn('[useUserTasks] junction join failed, falling back:', error.message);
        const result = await sb
          .from('user_tasks')
          .select('*')
          .eq('user_id', userId)
          .or(filter)
          .order('due_date', { ascending: true })
          .order('due_time', { ascending: true, nullsFirst: false });

        if (result.error) {
          console.error('[useUserTasks] fallback fetch error:', result.error.message);
        } else {
          setTasks((result.data || []).map(t => ({ ...t, _collections: [] })));
        }
        return;
      }

      // Flatten junction join → task._collections = [{id, title, type}, ...]
      const mapped = (data || []).map(task => ({
        ...task,
        _collections: (task.task_collections || [])
          .map(tc => tc.collections)
          .filter(Boolean),
      }));
      // Remove raw junction data
      mapped.forEach(t => delete t.task_collections);
      setTasks(mapped);
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
  const addTask = useCallback(async ({ title, description, dueDate, dueTime, priority, recurrenceRule, collectionId, completed, completedAt }) => {
    const newTask = {
      id: crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`,
      user_id: userId,
      title,
      description: description || null,
      due_date: dueDate || todayStr(),
      due_time: dueTime || '23:59',
      priority: priority || 0,
      recurrence_rule: recurrenceRule || null,
      collection_id: collectionId || null,
      completed: completed || false,
      completed_at: completedAt || null,
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

  // ── Spawn next recurring task (bounded retry, NEVER calls completeTask) ──
  const spawnRecurringTask = useCallback(async (task) => {
    if (!task?.recurrence_rule || !isAuth) return false;

    const rule = task.recurrence_rule;
    const today = todayStr();
    let nextDate;

    if (rule.type === 'interval') {
      nextDate = addDays(today, rule.days);
    } else if (rule.type === 'weekly') {
      nextDate = nextWeekday(rule.weekday);
    } else if (rule.type === 'monthly') {
      nextDate = nextMonthDay(rule.day);
    }

    if (!nextDate) return false;

    const MAX_RETRIES = 2;
    const BACKOFF_MS = 1000;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const sb = await getSb();
        if (!sb) return false;

        const { error } = await sb.from('user_tasks').insert({
          user_id: userId,
          title: task.title,
          description: task.description,
          due_date: nextDate,
          due_time: task.due_time,
          priority: task.priority || 0,
          recurrence_rule: task.recurrence_rule, // clone rule for chain
          completed: false,
          notified: false,
        });

        if (!error) return true; // Success

        console.warn(
          `[useUserTasks] spawnRecurring attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`,
          error.message
        );
      } catch (err) {
        console.warn(
          `[useUserTasks] spawnRecurring attempt ${attempt + 1}/${MAX_RETRIES + 1} exception:`,
          err.message
        );
      }

      // Backoff before retry (skip on last attempt)
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, BACKOFF_MS * (attempt + 1)));
      }
    }

    // All retries exhausted — structured warning for debugging
    console.error(
      `[useUserTasks] RECURRING TASK FAILED after ${MAX_RETRIES + 1} attempts.`,
      `Task: "${task.title}" → Next due: ${nextDate}.`,
      'User should manually create the next occurrence.'
    );
    return false;
  }, [isAuth, userId]);

  // ── Complete task ──────────────────────────────────────
  const completeTask = useCallback(async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
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
          return; // Don't spawn if complete failed
        }

        // Spawn next recurring task (fire-and-forget, non-blocking)
        if (task?.recurrence_rule) {
          spawnRecurringTask(task);
        }
      } catch (err) {
        console.error('[useUserTasks] complete exception:', err);
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, completed: false, completed_at: null } : t
        ));
      }
    }
  }, [isAuth, userId, tasks, spawnRecurringTask]);

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

  // ── Uncomplete task (revert to pending) ───────────────
  const uncompleteTask = useCallback(async (taskId) => {
    const backup = tasks.find(t => t.id === taskId);

    // Optimistic
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed: false, completed_at: null } : t
    ));

    if (isAuth) {
      try {
        const sb = await getSb();
        if (!sb) return;

        const { error } = await sb
          .from('user_tasks')
          .update({ completed: false, completed_at: null })
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
          console.error('[useUserTasks] uncomplete error:', error.message);
          if (backup) setTasks(prev => prev.map(t => t.id === taskId ? backup : t));
        }
      } catch (err) {
        console.error('[useUserTasks] uncomplete exception:', err);
        if (backup) setTasks(prev => prev.map(t => t.id === taskId ? backup : t));
      }
    }
  }, [isAuth, userId, tasks]);

  // ── Update task (title / description / date / time) ───
  const updateTask = useCallback(async (taskId, changes) => {
    const backup = tasks.find(t => t.id === taskId);

    // Optimistic
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...changes } : t
    ));

    if (isAuth) {
      try {
        const sb = await getSb();
        if (!sb) return;

        const { error } = await sb
          .from('user_tasks')
          .update(changes)
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
          console.error('[useUserTasks] update error:', error.message);
          if (backup) setTasks(prev => prev.map(t => t.id === taskId ? backup : t));
        }
      } catch (err) {
        console.error('[useUserTasks] update exception:', err);
        if (backup) setTasks(prev => prev.map(t => t.id === taskId ? backup : t));
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
      !t.completed && t.due_date === todayStr() && t.due_time && t.due_time.substring(0, 5) !== '00:00'
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

  // ── Link collection to task (v4.5.0 junction) ──────────────
  const linkCollection = useCallback(async (taskId, collectionId) => {
    if (!isAuth) return false;

    // Optimistic: add to _collections
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const already = (t._collections || []).some(c => c.id === collectionId);
      if (already) return t;
      return { ...t, _collections: [...(t._collections || []), { id: collectionId }] };
    }));

    try {
      const sb = await getSb();
      if (!sb) return false;

      const { error } = await sb.from('task_collections').insert({
        task_id: taskId,
        collection_id: collectionId,
      });

      if (error) {
        console.error('[useUserTasks] linkCollection error:', error.message);
        // Rollback
        setTasks(prev => prev.map(t => {
          if (t.id !== taskId) return t;
          return { ...t, _collections: (t._collections || []).filter(c => c.id !== collectionId) };
        }));
        return false;
      }
      return true;
    } catch (err) {
      console.error('[useUserTasks] linkCollection exception:', err);
      return false;
    }
  }, [isAuth]);

  // ── Unlink collection from task (v4.5.0 junction) ──────────
  const unlinkCollection = useCallback(async (taskId, collectionId) => {
    if (!isAuth) return false;

    // Backup for rollback
    const backup = tasks.find(t => t.id === taskId)?._collections || [];

    // Optimistic: remove from _collections
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, _collections: (t._collections || []).filter(c => c.id !== collectionId) };
    }));

    try {
      const sb = await getSb();
      if (!sb) return false;

      const { error } = await sb.from('task_collections')
        .delete()
        .eq('task_id', taskId)
        .eq('collection_id', collectionId);

      if (error) {
        console.error('[useUserTasks] unlinkCollection error:', error.message);
        setTasks(prev => prev.map(t => {
          if (t.id !== taskId) return t;
          return { ...t, _collections: backup };
        }));
        return false;
      }
      return true;
    } catch (err) {
      console.error('[useUserTasks] unlinkCollection exception:', err);
      return false;
    }
  }, [isAuth, tasks]);

  // Derived: split pending vs completed today
  const pendingTasks = tasks.filter(t => !t.completed);
  const completedToday = tasks.filter(t => t.completed);

  // ── Overdue Triage splits ─────────────────────────────────
  const today = todayStr();
  const todayTasks   = pendingTasks.filter(t => t.due_date === today);
  const overdueTasks = pendingTasks.filter(t => t.due_date < today);
  const futureTasks  = pendingTasks.filter(t => t.due_date > today);

  // ── Rollover: move overdue task to today ──────────────────
  const rolloverTask = useCallback(async (taskId) => {
    return updateTask(taskId, { due_date: todayStr() });
  }, [updateTask]);

  return {
    tasks,
    pendingTasks,
    completedToday,
    todayTasks,
    overdueTasks,
    futureTasks,
    isLoading,
    addTask,
    completeTask,
    uncompleteTask,
    updateTask,
    deleteTask,
    rolloverTask,
    getCompletedTasks,
    linkCollection,
    unlinkCollection,
  };
}

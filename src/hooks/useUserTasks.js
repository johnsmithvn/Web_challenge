import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';
import { toDateStr } from '../utils/dateUtils';
import { computeNextDueDate, resolveDeletionIds } from '../utils/recurrenceUtils';
import UI_STRINGS from '../data/ui-strings.json';

const todayStr = () => toDateStr();

// ── Date helper (dùng ở nhiều chỗ trong file, không chỉ recurrence) ──
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/**
 * useUserTasks — Personal task CRUD, Supabase-first.
 *
 * Tasks are independent from habits/journey/XP.
 * Guest = in-memory (reset on refresh).
 */
export function useUserTasks() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAuth = isSupabaseEnabled && !!user;
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
      const today = todayStr();
      // Exclusive upper bound = next-day midnight (a contiguous 24h window) so tasks
      // completed in the last second of the day (23:59:59.xxx) aren't dropped.
      const filter = `completed.eq.false,and(completed.eq.true,completed_at.gte.${today}T00:00:00,completed_at.lt.${addDays(today, 1)}T00:00:00)`;

      // Try with task_collections + task_tags join first (v4.5.0 / v4.31.0)
      let { data, error } = await supabase
        .from('user_tasks')
        .select('*, task_collections(collection_id, collections(id, title, type)), task_tags(tag_id, tags(id, name, color))')
        .eq('user_id', userId)
        .or(filter)
        .order('due_date', { ascending: true })
        .order('due_time', { ascending: true, nullsFirst: false });

      // Fallback: if a junction table doesn't exist yet (migration not run)
      if (error) {
        logger.warn('[useUserTasks] junction join failed, falling back:', error.message);
        const result = await supabase
          .from('user_tasks')
          .select('*')
          .eq('user_id', userId)
          .or(filter)
          .order('due_date', { ascending: true })
          .order('due_time', { ascending: true, nullsFirst: false });

        if (result.error) {
          logger.error('[useUserTasks] fallback fetch error:', result.error.message);
        } else {
          setTasks((result.data || []).map(t => ({ ...t, _collections: [], _tags: [] })));
        }
        return;
      }

      // Flatten junction joins → task._collections / task._tags
      const mapped = (data || []).map(task => ({
        ...task,
        _collections: (task.task_collections || [])
          .map(tc => tc.collections)
          .filter(Boolean),
        _tags: (task.task_tags || [])
          .map(tt => tt.tags)
          .filter(Boolean),
      }));
      // Remove raw junction data
      mapped.forEach(t => { delete t.task_collections; delete t.task_tags; });
      setTasks(mapped);
    } catch (err) {
      logger.error('[useUserTasks] fetch exception:', err);
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
  // v4.28.0: bỏ tham số `collectionId` + cột `collection_id`. Cột này đã
  // DEPRECATED từ v4.5.0 (thay bằng junction task_collections) — schema có
  // COMMENT nói rõ, nhưng addTask vẫn ghi vào, tạo 2 đường link song song cho
  // cùng 1 quan hệ. Không caller nào từng truyền collectionId (đã grep).
  // Dùng linkCollection(taskId, collectionId) thay thế. DROP ở migration_v5.0.0.
  const addTask = useCallback(async ({ title, description, dueDate, dueTime, priority, recurrenceRule, completed, completedAt }) => {
    const newTask = {
      id: crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`,
      user_id: userId,
      title,
      description: description || null,
      due_date: dueDate || todayStr(),
      due_time: dueTime || '23:59',
      priority: priority || 0,
      recurrence_rule: recurrenceRule || null,
      completed: completed || false,
      completed_at: completedAt || null,
      notified: false,
      created_at: new Date().toISOString(),
    };

    // Optimistic
    setTasks(prev => [...prev, newTask]);

    if (isAuth) {
      try {
        const { id, user_id, ...rest } = newTask;
        const { data, error } = await supabase
          .from('user_tasks')
          .insert({ ...rest, user_id: userId })
          .select()
          .single();

        if (error) {
          logger.error('[useUserTasks] add error:', error.message);
          // Rollback
          setTasks(prev => prev.filter(t => t.id !== newTask.id));
          return null;
        }
        // Replace optimistic with real
        setTasks(prev => prev.map(t => t.id === newTask.id ? data : t));
        return data;
      } catch (err) {
        logger.error('[useUserTasks] add exception:', err);
        setTasks(prev => prev.filter(t => t.id !== newTask.id));
        return null;
      }
    }
    return newTask;
  }, [isAuth, userId]);

  // ── Spawn next recurring task (bounded retry, NEVER calls completeTask) ──
  const spawnRecurringTask = useCallback(async (task) => {
    if (!task?.recurrence_rule || !isAuth) return false;

    // Chống sinh trùng: tích/bỏ tích/tích lại nhanh có thể gọi hàm này nhiều
    // lần cho cùng 1 task — nếu đã có occurrence tiếp theo rồi thì thôi.
    const { data: existingChild } = await supabase
      .from('user_tasks')
      .select('id')
      .eq('recurrence_parent_id', task.id)
      .maybeSingle();
    if (existingChild?.id) return true;

    const nextDate = computeNextDueDate(task.recurrence_rule, todayStr());

    if (!nextDate) {
      logger.error(
        `[useUserTasks] spawnRecurring: recurrence_rule.type không xác định — task "${task.title}" (rule.type="${task.recurrence_rule.type}") không tạo được occurrence tiếp theo, sẽ biến mất khỏi danh sách lặp lại.`
      );
      return false;
    }

    const MAX_RETRIES = 2;
    const BACKOFF_MS = 1000;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data: inserted, error } = await supabase.from('user_tasks').insert({
          user_id: userId,
          title: task.title,
          description: task.description,
          due_date: nextDate,
          due_time: task.due_time,
          priority: task.priority || 0,
          recurrence_rule: task.recurrence_rule, // clone rule for chain
          recurrence_parent_id: task.id,
          completed: false,
          notified: false,
        }).select('id').single();

        if (!error) {
          // Copy tag + link KB sang occurrence mới (best-effort — task chính đã
          // tạo thành công nên không rollback nếu bước copy này lỗi, chỉ log warn)
          if (inserted?.id) {
            if ((task._tags || []).length > 0) {
              const { error: tagError } = await supabase.from('task_tags').insert(
                task._tags.map(tag => ({ task_id: inserted.id, tag_id: tag.id }))
              );
              if (tagError) logger.warn('[useUserTasks] spawnRecurring: copy tags failed:', tagError.message);
            }
            if ((task._collections || []).length > 0) {
              const { error: collError } = await supabase.from('task_collections').insert(
                task._collections.map(c => ({ task_id: inserted.id, collection_id: c.id }))
              );
              if (collError) logger.warn('[useUserTasks] spawnRecurring: copy KB links failed:', collError.message);
            }
          }
          return true; // Success
        }

        logger.warn(
          `[useUserTasks] spawnRecurring attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`,
          error.message
        );
      } catch (err) {
        logger.warn(
          `[useUserTasks] spawnRecurring attempt ${attempt + 1}/${MAX_RETRIES + 1} exception:`,
          err.message
        );
      }

      // Backoff before retry (skip on last attempt)
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, BACKOFF_MS * (attempt + 1)));
      }
    }

    // All retries exhausted — chuỗi lặp chết âm thầm nếu không báo cho user
    logger.error(
      `[useUserTasks] RECURRING TASK FAILED after ${MAX_RETRIES + 1} attempts.`,
      `Task: "${task.title}" → Next due: ${nextDate}.`,
      'User should manually create the next occurrence.'
    );
    showToast(UI_STRINGS.toast.recurrenceSpawnFailed, { icon: '⚠️' });
    return false;
  }, [isAuth, userId, showToast]);

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
        const { error } = await supabase
          .from('user_tasks')
          .update({ completed: true, completed_at: now })
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
          logger.error('[useUserTasks] complete error:', error.message);
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
        logger.error('[useUserTasks] complete exception:', err);
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, completed: false, completed_at: null } : t
        ));
      }
    }
  }, [isAuth, userId, tasks, spawnRecurringTask]);

  // ── Delete task ────────────────────────────────────────
  // Must delete via Supabase regardless of whether the task is in local `tasks`
  // state — e.g. an old completed task fetched via getCompletedTasksRange for
  // the calendar/history views never enters `tasks`, so gating the API call on
  // `backup` (as before) silently no-op'd the delete for every such task.
  //
  // Quy tắc xoá task lặp (recurrence_parent_id):
  // - Task GỐC (recurrence_parent_id rỗng) → chỉ xoá đúng nó, KHÔNG cascade.
  // - Task KHÔNG PHẢI gốc → xoá nó + toàn bộ hậu duệ phía sau.
  // `ON DELETE CASCADE` của Postgres lan truyền vô điều kiện nên KHÔNG tự làm
  // được rule bất đối xứng này — task gốc phải được "cắt dây" con trước khi xoá
  // để CASCADE không bị kích hoạt xuống hậu duệ.
  const deleteTask = useCallback(async (taskId) => {
    // Best-effort dựa trên state cục bộ hiện có (có thể thiếu — vd 1 task lịch sử
    // chưa từng vào `tasks` — không sao, DB call bên dưới vẫn xử lý đúng dù state
    // cục bộ không đầy đủ).
    const localIds = resolveDeletionIds(tasks, taskId);
    const backups = tasks.filter(t => localIds.includes(t.id));

    // Optimistic
    setTasks(prev => prev.filter(t => !localIds.includes(t.id)));

    if (isAuth) {
      try {
        const { data: current, error: fetchError } = await supabase
          .from('user_tasks')
          .select('recurrence_parent_id')
          .eq('id', taskId)
          .eq('user_id', userId)
          .maybeSingle();

        if (fetchError) {
          logger.warn('[useUserTasks] delete: không đọc được recurrence_parent_id, xoá thẳng:', fetchError.message);
        } else if (!current?.recurrence_parent_id) {
          // Task GỐC — cắt dây con trực tiếp trước để CASCADE không lan xuống
          // hậu duệ khi xoá row gốc bên dưới.
          const { error: detachError } = await supabase
            .from('user_tasks')
            .update({ recurrence_parent_id: null })
            .eq('recurrence_parent_id', taskId);
          if (detachError) {
            logger.error('[useUserTasks] delete: detach child failed:', detachError.message);
          }
        }
        // Task KHÔNG PHẢI gốc → không detach, xoá thẳng để CASCADE tự lo hậu duệ.

        const { error } = await supabase
          .from('user_tasks')
          .delete()
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
          logger.error('[useUserTasks] delete error:', error.message);
          if (backups.length) setTasks(prev => [...prev, ...backups]);
          return false;
        }
      } catch (err) {
        logger.error('[useUserTasks] delete exception:', err);
        if (backups.length) setTasks(prev => [...prev, ...backups]);
        return false;
      }
    }
    showToast(UI_STRINGS.toast.taskDeleted);
    return true;
  }, [isAuth, userId, tasks, showToast]);

  // ── Uncomplete task (revert to pending) ───────────────
  // Bỏ tích 1 task lặp lại → xoá luôn occurrence nó đã sinh ra (nếu có), tránh
  // trùng khi user tích/bỏ tích/tích lại. Occurrence đó luôn KHÔNG PHẢI gốc
  // (recurrence_parent_id = taskId) nên xoá thẳng, để CASCADE tự lo hậu duệ xa
  // hơn nếu chính occurrence đó cũng đã hoàn thành và sinh tiếp.
  const uncompleteTask = useCallback(async (taskId) => {
    const backup = tasks.find(t => t.id === taskId);

    // Optimistic
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed: false, completed_at: null } : t
    ));

    if (isAuth) {
      try {
        const { error } = await supabase
          .from('user_tasks')
          .update({ completed: false, completed_at: null })
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
          logger.error('[useUserTasks] uncomplete error:', error.message);
          if (backup) setTasks(prev => prev.map(t => t.id === taskId ? backup : t));
          return;
        }

        const { data: child, error: findError } = await supabase
          .from('user_tasks')
          .select('id')
          .eq('recurrence_parent_id', taskId)
          .eq('user_id', userId)
          .maybeSingle();

        if (findError) {
          logger.warn('[useUserTasks] uncomplete: tìm task lặp con thất bại:', findError.message);
        } else if (child?.id) {
          const { error: delError } = await supabase
            .from('user_tasks')
            .delete()
            .eq('id', child.id)
            .eq('user_id', userId);

          if (delError) {
            logger.warn('[useUserTasks] uncomplete: xoá task lặp con thất bại:', delError.message);
          } else {
            setTasks(prev => {
              const ids = resolveDeletionIds(prev, child.id);
              return prev.filter(t => !ids.includes(t.id));
            });
            showToast(UI_STRINGS.toast.recurrenceChildRemoved);
          }
        }
      } catch (err) {
        logger.error('[useUserTasks] uncomplete exception:', err);
        if (backup) setTasks(prev => prev.map(t => t.id === taskId ? backup : t));
      }
    }
  }, [isAuth, userId, tasks, showToast]);

  // ── Update task (title / description / date / time) ───
  const updateTask = useCallback(async (taskId, changes) => {
    const backup = tasks.find(t => t.id === taskId);

    // Optimistic
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...changes } : t
    ));

    if (isAuth) {
      try {
        const { error } = await supabase
          .from('user_tasks')
          .update(changes)
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
          logger.error('[useUserTasks] update error:', error.message);
          if (backup) setTasks(prev => prev.map(t => t.id === taskId ? backup : t));
        }
      } catch (err) {
        logger.error('[useUserTasks] update exception:', err);
        if (backup) setTasks(prev => prev.map(t => t.id === taskId ? backup : t));
      }
    }
  }, [isAuth, userId, tasks]);

  // ── Get completed tasks in a date range (for calendar) ────────
  // v4.29.0: thay `getCompletedTasks(dateStr)` (1 query/ngày → 30 query/tháng khi
  // calendar cần chip trên mọi ô). Caller fetch 1 lần/tháng rồi tự group.
  //
  // Đệm ±1 ngày: `completed_at` là timestamptz, chuỗi không có timezone nên
  // Postgres so sánh theo UTC — còn caller group theo ngày ĐỊA PHƯƠNG. Task xong
  // lúc 00:30 giờ VN (+07) có completed_at UTC là ngày hôm trước, không đệm thì mất.
  const getCompletedTasksRange = useCallback(async (startDate, endDate) => {
    if (!isAuth || !userId) return [];

    try {
      const { data, error } = await supabase
        .from('user_tasks')
        .select('id, title, description, priority, completed_at')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('completed_at', `${addDays(startDate, -1)}T00:00:00`)
        .lt('completed_at', `${addDays(endDate, 2)}T00:00:00`)
        .order('completed_at', { ascending: true });

      if (error) {
        logger.error('[useUserTasks] getCompletedRange error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      logger.error('[useUserTasks] getCompletedRange exception:', err);
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
      const { error } = await supabase.from('task_collections').insert({
        task_id: taskId,
        collection_id: collectionId,
      });

      if (error) {
        logger.error('[useUserTasks] linkCollection error:', error.message);
        // Rollback
        setTasks(prev => prev.map(t => {
          if (t.id !== taskId) return t;
          return { ...t, _collections: (t._collections || []).filter(c => c.id !== collectionId) };
        }));
        return false;
      }
      return true;
    } catch (err) {
      logger.error('[useUserTasks] linkCollection exception:', err);
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
      const { error } = await supabase.from('task_collections')
        .delete()
        .eq('task_id', taskId)
        .eq('collection_id', collectionId);

      if (error) {
        logger.error('[useUserTasks] unlinkCollection error:', error.message);
        setTasks(prev => prev.map(t => {
          if (t.id !== taskId) return t;
          return { ...t, _collections: backup };
        }));
        return false;
      }
      return true;
    } catch (err) {
      logger.error('[useUserTasks] unlinkCollection exception:', err);
      return false;
    }
  }, [isAuth, tasks]);

  // ── Link tag to task (task_tags junction) ──────────────────
  const linkTaskTag = useCallback(async (taskId, tag) => {
    if (!isAuth) return false;

    // Optimistic: add to _tags
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const already = (t._tags || []).some(x => x.id === tag.id);
      if (already) return t;
      return { ...t, _tags: [...(t._tags || []), tag] };
    }));

    try {
      const { error } = await supabase.from('task_tags').insert({ task_id: taskId, tag_id: tag.id });

      if (error) {
        logger.error('[useUserTasks] linkTaskTag error:', error.message);
        setTasks(prev => prev.map(t => {
          if (t.id !== taskId) return t;
          return { ...t, _tags: (t._tags || []).filter(x => x.id !== tag.id) };
        }));
        return false;
      }
      return true;
    } catch (err) {
      logger.error('[useUserTasks] linkTaskTag exception:', err);
      return false;
    }
  }, [isAuth]);

  // ── Unlink tag from task ────────────────────────────────────
  const unlinkTaskTag = useCallback(async (taskId, tagId) => {
    if (!isAuth) return false;

    const backup = tasks.find(t => t.id === taskId)?._tags || [];

    // Optimistic: remove from _tags
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return { ...t, _tags: (t._tags || []).filter(x => x.id !== tagId) };
    }));

    try {
      const { error } = await supabase.from('task_tags')
        .delete()
        .eq('task_id', taskId)
        .eq('tag_id', tagId);

      if (error) {
        logger.error('[useUserTasks] unlinkTaskTag error:', error.message);
        setTasks(prev => prev.map(t => {
          if (t.id !== taskId) return t;
          return { ...t, _tags: backup };
        }));
        return false;
      }
      return true;
    } catch (err) {
      logger.error('[useUserTasks] unlinkTaskTag exception:', err);
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
    getCompletedTasksRange,
    linkCollection,
    unlinkCollection,
    linkTaskTag,
    unlinkTaskTag,
  };
}

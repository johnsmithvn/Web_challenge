import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';
import { toDateStr } from '../utils/dateUtils';
import { computeNextDueDate, resolveDeletionIds } from '../utils/recurrenceUtils';
import { buildTodayReminders } from '../utils/calendarTimeUtils';
import { daysBetween, isSubtask, reorderChanges, shiftDate, subtaskCopiesForNextOccurrence } from '../utils/subtaskUtils';
import { useActivityLog } from './useActivityLog';
import { useXpStore, XP_REWARDS } from './useXpStore';
import { diffTaskFields, ACTIONS } from '../utils/taskFields';
import UI_STRINGS from '../data/ui-strings.json';

const TASKS_CACHE_PREFIX = 'vl_tasks_cache_';
// Task + junction KB/tag (flatten thành _collections/_tags trong fetchTasks).
const TASK_SELECT = '*, task_collections(collection_id, collections(id, title, type)), task_tags(tag_id, tags(id, name, color))';

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
 * Guest = in-memory (reset on refresh).
 *
 * Authenticated writes log only after the database write succeeds:
 *   1. addTask + spawnRecurringTask  → task_created
 *   2. completeTask                  → task_completed
 *   3. uncompleteTask                → task_uncompleted
 *   4. updateTask                    → task_update (1 dòng / field đổi)
 *   5. link/unlinkTaskTag + link/unlinkCollection → task_tag_* / task_link_*
 *
 * Guest writes stay in memory and do not log or award XP. Delete intentionally
 * has no event because its task history is removed by FK cascade.
 */
export function useUserTasks() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { logTaskEvent, logFieldChanges, logTaskRelation } = useActivityLog();
  // Hoàn thành/bỏ hoàn thành Task cộng hoặc gỡ đúng XP event đã dedup.
  const { addXp, removeXp } = useXpStore();
  const isAuth = isSupabaseEnabled && !!user;
  const userId = user?.id;

  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchEpochRef = useRef(0);
  const sessionKey = isAuth ? userId : 'guest';
  const sessionKeyRef = useRef(sessionKey);
  if (sessionKeyRef.current !== sessionKey) {
    sessionKeyRef.current = sessionKey;
    fetchEpochRef.current += 1;
  }

  // ── Fetch tasks: pending + completed today ─────────────
  // v4.5.0: Embedded select for task_collections junction with graceful fallback
  const fetchTasks = useCallback(async (epoch) => {
    if (!isAuth || !userId || epoch !== fetchEpochRef.current) return;
    setIsLoading(true);
    try {
      const today = todayStr();
      // Exclusive upper bound = next-day midnight (a contiguous 24h window) so tasks
      // completed in the last second of the day (23:59:59.xxx) aren't dropped.
      const filter = `completed.eq.false,and(completed.eq.true,completed_at.gte.${today}T00:00:00,completed_at.lt.${addDays(today, 1)}T00:00:00)`;

      // Try with task_collections + task_tags join first (v4.5.0 / v4.31.0)
      let { data, error } = await supabase
        .from('user_tasks')
        .select(TASK_SELECT)
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
          try {
            const raw = localStorage.getItem(`${TASKS_CACHE_PREFIX}${userId}`);
            if (raw) {
              const cached = JSON.parse(raw);
              if (Array.isArray(cached) && epoch === fetchEpochRef.current) setTasks(cached);
            }
          } catch { /* ignore fallback error */ }
        } else if (epoch === fetchEpochRef.current) {
          const fallbackMapped = (result.data || []).map(t => ({ ...t, _collections: [], _tags: [] }));
          setTasks(fallbackMapped);
          try {
            localStorage.setItem(`${TASKS_CACHE_PREFIX}${userId}`, JSON.stringify(fallbackMapped));
          } catch { /* ignore cache write error */ }
        }
        return;
      }

      // Flatten junction joins → task._collections / task._tags (bỏ dữ liệu junction thô)
      const flatten = (row) => {
        const t = {
          ...row,
          _collections: (row.task_collections || []).map(tc => tc.collections).filter(Boolean),
          _tags: (row.task_tags || []).map(tt => tt.tags).filter(Boolean),
        };
        delete t.task_collections;
        delete t.task_tags;
        return t;
      };
      const mapped = (data || []).map(flatten);

      // Subtask (v6.20.0) ẩn khỏi mọi view, nhưng badge `☑ 2/4` trên task cha cần ĐỦ
      // subtask — query trên chỉ lấy task chưa xong + xong hôm nay → tải thêm mọi
      // subtask của các task cha vừa tải. Lô 100 id (giới hạn độ dài URL), số lô hữu
      // hạn. Lỗi (vd DB chưa chạy migration v6.19.0) → bỏ qua, phần còn lại vẫn chạy.
      const parentIds = mapped.filter(t => !t.parent_task_id).map(t => t.id);
      const seen = new Set(mapped.map(t => t.id));
      for (let i = 0; i < parentIds.length; i += 100) {
        const { data: kids, error: kidsError } = await supabase
          .from('user_tasks')
          .select(TASK_SELECT)
          .eq('user_id', userId)
          .in('parent_task_id', parentIds.slice(i, i + 100));
        if (kidsError) {
          logger.warn('[useUserTasks] subtask fetch skipped:', kidsError.message);
          break;
        }
        for (const k of kids || []) {
          if (!seen.has(k.id)) { seen.add(k.id); mapped.push(flatten(k)); }
        }
      }

      if (epoch === fetchEpochRef.current) {
        setTasks(mapped);
        try {
          localStorage.setItem(`${TASKS_CACHE_PREFIX}${userId}`, JSON.stringify(mapped));
        } catch { /* ignore cache write error */ }
      }
    } catch (err) {
      logger.error('[useUserTasks] fetch exception:', err);
      try {
        const raw = localStorage.getItem(`${TASKS_CACHE_PREFIX}${userId}`);
        if (raw) {
          const cached = JSON.parse(raw);
          if (Array.isArray(cached) && epoch === fetchEpochRef.current) setTasks(cached);
        }
      } catch { /* ignore fallback error */ }
    } finally {
      if (epoch === fetchEpochRef.current) setIsLoading(false);
    }
  }, [isAuth, userId]);

  useEffect(() => {
    const epoch = ++fetchEpochRef.current;
    setTasks([]);
    setIsLoading(false);
    if (isAuth && userId) fetchTasks(epoch);
    return () => {
      if (fetchEpochRef.current === epoch) fetchEpochRef.current += 1;
    };
  }, [isAuth, userId, fetchTasks]);

  // ── Add task ───────────────────────────────────────────
  // Knowledge links are created separately through task_collections/linkCollection.
  // Thời gian (v6.21.0): Hạn (dueDate/dueTime) và Bắt đầu (startDate/startTime) đều tuỳ
  // chọn — không truyền ngày = task không ngày. Giờ không có ngày thì bỏ (CHECK dưới DB).
  const addTask = useCallback(async ({ title, description, dueDate, dueTime, startDate, startTime, parentTaskId, priority, recurrenceRule, completed, completedAt, status }) => {
    const taskStatus = status || (completed ? 'done' : 'todo');
    const nowIso = new Date().toISOString();
    const newTask = {
      id: crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`,
      user_id: userId,
      title,
      description: description || null,
      due_date: dueDate || null,
      due_time: dueDate && dueTime ? dueTime : null,
      ...(startDate ? { start_date: startDate, start_time: startTime || null } : {}),
      // Tạo thẳng vào cột Doing = bắt đầu làm luôn.
      ...(taskStatus === 'doing' ? { started_at: nowIso } : {}),
      // Subtask (v6.19.0+) — cùng lý do: chỉ gửi khi có.
      ...(parentTaskId ? { parent_task_id: parentTaskId } : {}),
      priority: priority || 0,
      recurrence_rule: recurrenceRule || null,
      completed: completed || false,
      completed_at: completedAt || null,
      status: taskStatus,
      notified: false,
      created_at: nowIso,
    };

    // Optimistic
    setTasks(prev => [...prev, newTask]);

    if (isAuth) {
      try {
        const { id, user_id, ...rest } = newTask;
        let { data, error } = await supabase
          .from('user_tasks')
          .insert({ ...rest, user_id: userId })
          .select()
          .single();

        if (error && error.message?.includes('status')) {
          const { status: _s, ...restWithoutStatus } = rest;
          const fallbackRes = await supabase
            .from('user_tasks')
            .insert({ ...restWithoutStatus, user_id: userId })
            .select()
            .single();
          data = fallbackRes.data;
          error = fallbackRes.error;
        }

        if (error) {
          logger.error('[useUserTasks] add error:', error.message);
          // Rollback
          setTasks(prev => prev.filter(t => t.id !== newTask.id));
          return null;
        }
        // Replace optimistic with real
        setTasks(prev => prev.map(t => t.id === newTask.id ? data : t));
        logTaskEvent(ACTIONS.TASK_CREATED, data.id);
        return data;
      } catch (err) {
        logger.error('[useUserTasks] add exception:', err);
        setTasks(prev => prev.filter(t => t.id !== newTask.id));
        return null;
      }
    }
    return newTask;
  }, [isAuth, userId, logTaskEvent]);

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
    // Kỳ sau dời Bắt đầu + subtask cùng khoảng với Hạn. Task lặp luôn có Hạn (form bắt
    // buộc); thiếu thì không dời được → bỏ Bắt đầu.
    const shift = task.due_date ? daysBetween(task.due_date, nextDate) : null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data: inserted, error } = await supabase.from('user_tasks').insert({
          user_id: userId,
          title: task.title,
          description: task.description,
          due_date: nextDate,
          due_time: task.due_time,
          // Bắt đầu (kế hoạch) theo sang kỳ sau; started_at (thực tế) thì KHÔNG.
          ...(task.start_date && shift !== null
            ? { start_date: shiftDate(task.start_date, shift), start_time: task.start_time ?? null }
            : {}),
          // Subtask tự lặp: kỳ sau vẫn thuộc cùng task cha (undefined trước migration → bỏ qua).
          parent_task_id: task.parent_task_id,
          sort_order: task.sort_order,
          priority: task.priority || 0,
          recurrence_rule: task.recurrence_rule, // clone rule for chain
          recurrence_parent_id: task.id,
          completed: false,
          notified: false,
        }).select().single();

        if (!error) {
          // Copy tag + link KB sang occurrence mới (best-effort — task chính đã
          // tạo thành công nên không rollback nếu bước copy này lỗi, chỉ log warn)
          if (inserted?.id) {
            // Đưa kỳ mới vào state ngay — trước đây phải reload mới thấy kỳ sau.
            setTasks(prev => prev.some(t => t.id === inserted.id)
              ? prev
              : [...prev, { ...inserted, _tags: task._tags || [], _collections: task._collections || [] }]);
            logTaskEvent(ACTIONS.TASK_CREATED, inserted.id);
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
            // Task cha lặp: kỳ sau mang theo subtask (chưa xong, hạn dời theo) — giống
            // checklist cũ. Đọc từ DB để có đủ cả subtask không nằm trong state.
            // Best-effort như tag/KB ở trên.
            if (!task.parent_task_id) {
              const { data: kids, error: kidsError } = await supabase
                .from('user_tasks').select('*').eq('user_id', userId).eq('parent_task_id', task.id);
              if (kidsError) {
                logger.warn('[useUserTasks] spawnRecurring: read subtasks failed:', kidsError.message);
              } else if (kids?.length) {
                const copies = subtaskCopiesForNextOccurrence(kids, inserted.id, shift ?? 0)
                  .map(c => ({ ...c, user_id: userId }));
                const { data: copied, error: copyError } = await supabase.from('user_tasks').insert(copies).select();
                if (copyError) logger.warn('[useUserTasks] spawnRecurring: copy subtasks failed:', copyError.message);
                else setTasks(prev => [...prev, ...(copied || []).map(c => ({ ...c, _tags: [], _collections: [] }))]);
              }
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
    showToast(UI_STRINGS.toast.recurrenceSpawnFailed, { icon: 'warning' });
    return false;
  }, [isAuth, userId, showToast, logTaskEvent]);

  // ── Complete task ──────────────────────────────────────
  const completeTask = useCallback(async (taskId, completedAt = new Date().toISOString()) => {
    const task = tasks.find(t => t.id === taskId);
    const now = completedAt;

    // Optimistic
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed: true, completed_at: now, status: 'done' } : t
    ));

    if (isAuth) {
      try {
        let { error } = await supabase
          .from('user_tasks')
          .update({ completed: true, completed_at: now, status: 'done' })
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error && error.message?.includes('status')) {
          const res = await supabase
            .from('user_tasks')
            .update({ completed: true, completed_at: now })
            .eq('id', taskId)
            .eq('user_id', userId);
          error = res.error;
        }

        if (error) {
          logger.error('[useUserTasks] complete error:', error.message);
          // Rollback
          setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, completed: false, completed_at: null, status: task?.status || 'todo' } : t
          ));
          return false; // Don't spawn if complete failed
        }

        // Completion is a discrete event, not a generic field-diff row.
        logTaskEvent(ACTIONS.TASK_COMPLETED, taskId);
        // Dedup theo taskId — tích/bỏ tích/tích lại không cộng XP nhiều lần
        // (addXp tự kiểm `reason` + `meta` trên xp_logs trước khi ghi).
        // Subtask không cộng XP — XP chỉ tính khi xong task cha (v6.20.0).
        if (!task?.parent_task_id) addXp(XP_REWARDS.task_done, 'task_done', { taskId });

        // Spawn next recurring task (fire-and-forget, non-blocking)
        if (task?.recurrence_rule) {
          spawnRecurringTask(task);
        }
      } catch (err) {
        logger.error('[useUserTasks] complete exception:', err);
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, completed: false, completed_at: null, status: task?.status || 'todo' } : t
        ));
        return false;
      }
    }
    return true;
  }, [isAuth, userId, tasks, spawnRecurringTask, logTaskEvent, addXp]);

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
    const sessionAtStart = sessionKeyRef.current;
    // Best-effort dựa trên state cục bộ hiện có (có thể thiếu — vd 1 task lịch sử
    // chưa từng vào `tasks` — không sao, DB call bên dưới vẫn xử lý đúng dù state
    // cục bộ không đầy đủ).
    // + subtask của các task bị xoá: DB tự xoá theo (FK CASCADE, v6.20.0) → state làm theo.
    const chainIds = resolveDeletionIds(tasks, taskId);
    const localIds = [...chainIds, ...tasks.filter(t => chainIds.includes(t.parent_task_id)).map(t => t.id)];
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
          if (backups.length && sessionKeyRef.current === sessionAtStart) {
            setTasks(prev => [...prev, ...backups]);
          }
          return false;
        }
      } catch (err) {
        logger.error('[useUserTasks] delete exception:', err);
        if (backups.length && sessionKeyRef.current === sessionAtStart) {
          setTasks(prev => [...prev, ...backups]);
        }
        return false;
      }
    }
    showToast(UI_STRINGS.toast.taskDeleted, { icon: 'trash' });
    return true;
  }, [isAuth, userId, tasks, showToast]);

  // ── Uncomplete task (revert to pending) ───────────────
  // Bỏ tích 1 task lặp lại → xoá luôn occurrence nó đã sinh ra (nếu có), tránh
  // trùng khi user tích/bỏ tích/tích lại. Occurrence đó luôn KHÔNG PHẢI gốc
  // (recurrence_parent_id = taskId) nên xoá thẳng, để CASCADE tự lo hậu duệ xa
  // hơn nếu chính occurrence đó cũng đã hoàn thành và sinh tiếp.
  // Ngoại lệ: targetStatus 'skip' (Done → Bỏ qua trên Kanban) GIỮ occurrence đó.
  const uncompleteTask = useCallback(async (taskId, targetStatus = 'todo') => {
    const backup = tasks.find(t => t.id === taskId);
    const nextStatus = ['doing', 'skip'].includes(targetStatus) ? targetStatus : 'todo';
    // Done → Doing lần đầu cũng là bắt đầu làm (cùng quy tắc updateTask).
    const startedPatch = nextStatus === 'doing' && backup && !backup.started_at
      ? { started_at: new Date().toISOString() }
      : {};

    // Optimistic
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed: false, completed_at: null, status: nextStatus, ...startedPatch } : t
    ));

    if (isAuth) {
      try {
        let { error } = await supabase
          .from('user_tasks')
          .update({ completed: false, completed_at: null, status: nextStatus, ...startedPatch })
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error && error.message?.includes('status')) {
          const res = await supabase
            .from('user_tasks')
            .update({ completed: false, completed_at: null })
            .eq('id', taskId)
            .eq('user_id', userId);
          error = res.error;
        }

        if (error) {
          logger.error('[useUserTasks] uncomplete error:', error.message);
          if (backup) setTasks(prev => prev.map(t => t.id === taskId ? backup : t));
          return false;
        }

        logTaskEvent(ACTIONS.TASK_UNCOMPLETED, taskId);
        removeXp('task_done', { taskId });

        if (nextStatus === 'skip') {
          // Đã xong → Bỏ qua: bỏ qua KỲ NÀY vẫn giữ chuỗi lặp — KHÔNG xoá kỳ sau đã sinh
          // lúc hoàn thành; chưa có thì sinh (spawnRecurringTask tự chống trùng).
          if (backup?.recurrence_rule) spawnRecurringTask(backup);
        } else {
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
              showToast(UI_STRINGS.toast.recurrenceChildRemoved, { icon: 'trash' });
            }
          }
        }
      } catch (err) {
        logger.error('[useUserTasks] uncomplete exception:', err);
        if (backup) setTasks(prev => prev.map(t => t.id === taskId ? backup : t));
        return false;
      }
    }
    // Trả true/false như completeTask — Kanban dựa vào đây để quyết định rollback.
    return true;
  }, [isAuth, userId, tasks, showToast, logTaskEvent, removeXp, spawnRecurringTask]);

  // ── Update task (title / description / date / time) ───
  const updateTask = useCallback(async (taskId, rawChanges) => {
    const backup = tasks.find(t => t.id === taskId);

    // Tính diff TRƯỚC khi optimistic merge — sau đó `backup` vẫn là object cũ
    // (setTasks tạo object mới) nhưng tính sẵn ở đây thì không phụ thuộc vào
    // chi tiết đó. Xem diffTaskFields: so GIÁ TRỊ (form Sửa luôn gửi đủ 6 key
    // kể cả key không đổi), bỏ qua key join `_tags`/`_collections`, và chuẩn
    // hoá due_time 'HH:MM:SS' vs 'HH:MM' + recurrence_rule JSONB.
    //
    // `backup` undefined khi task không nằm trong state cục bộ (vd task lịch sử
    // mở từ Lịch) — khi đó old_value = null, log vẫn ghi được, chỉ thiếu vế cũ.
    const diffs = diffTaskFields(backup, rawChanges);
    // Sang Doing lần đầu → ghi lúc bắt đầu làm THẬT (v6.21.0). Mọi đường đổi status
    // (kéo thẻ, nút nhanh, popup) đều qua đây. Thêm SAU diff: đổi status đã có dòng log.
    const changes = rawChanges.status === 'doing' && backup && !backup.started_at
      ? { ...rawChanges, started_at: new Date().toISOString() }
      : rawChanges;

    // Optimistic
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...changes } : t
    ));

    if (isAuth) {
      try {
        let { error } = await supabase
          .from('user_tasks')
          .update(changes)
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error && error.message?.includes('status') && 'status' in changes) {
          const { status, ...rest } = changes;
          if (Object.keys(rest).length > 0) {
            const res = await supabase
              .from('user_tasks')
              .update(rest)
              .eq('id', taskId)
              .eq('user_id', userId);
            error = res.error;
          } else {
            error = null;
          }
        }

        if (error) {
          logger.error('[useUserTasks] update error:', error.message);
          if (backup) setTasks(prev => prev.map(t => t.id === taskId ? backup : t));
          return false; // đã rollback → KHÔNG ghi log, tránh dòng ma
        }

        logFieldChanges(taskId, diffs);
        // Bỏ qua 1 task lặp = bỏ qua KỲ NÀY (kiểu TickTick/Todoist "skip occurrence"):
        // vẫn sinh kỳ sau, không cộng XP. spawnRecurringTask tự chống sinh trùng.
        if (changes.status === 'skip' && backup && backup.status !== 'skip' && backup.recurrence_rule) {
          spawnRecurringTask({ ...backup, ...changes });
        }
      } catch (err) {
        logger.error('[useUserTasks] update exception:', err);
        if (backup) setTasks(prev => prev.map(t => t.id === taskId ? backup : t));
        return false;
      }
    }
    return true;
  }, [isAuth, userId, tasks, logFieldChanges, spawnRecurringTask]);

  // ── Subtask (v6.20.0): row user_tasks có parent_task_id, ẩn trong task cha ──

  // Tạo nhiều subtask cho 1 task cha (form tạo task). Tuần tự để thứ tự tạo = thứ
  // tự gõ (subtask chưa kéo thả xếp theo created_at). Hạn = ngày hạn task cha (có thể trống).
  const addSubtasks = useCallback(async (parent, titles) => {
    const created = [];
    for (const title of titles) {
      const t = await addTask({ title, dueDate: parent.due_date, parentTaskId: parent.id });
      if (t) created.push(t);
    }
    return created;
  }, [addTask]);

  // Kéo thả: ghi sort_order mới. Ghi thẳng Supabase, KHÔNG qua updateTask — thứ tự
  // không phải "sửa field" cần activity log. Optimistic, lỗi thì trả thứ tự cũ.
  const reorderSubtasks = useCallback(async (ordered) => {
    const changes = reorderChanges(ordered);
    if (changes.length === 0) return true;
    const next = new Map(changes.map(c => [c.id, c.sort_order]));
    const before = new Map(ordered.map(t => [t.id, t.sort_order ?? null]));
    setTasks(prev => prev.map(t => (next.has(t.id) ? { ...t, sort_order: next.get(t.id) } : t)));
    if (!isAuth) return true;

    const results = await Promise.all(changes.map(c => supabase
      .from('user_tasks')
      .update({ sort_order: c.sort_order })
      .eq('id', c.id)
      .eq('user_id', userId)));
    const failed = results.find(r => r.error);
    if (failed) {
      logger.error('[useUserTasks] reorderSubtasks error:', failed.error.message);
      setTasks(prev => prev.map(t => (next.has(t.id) ? { ...t, sort_order: before.get(t.id) } : t)));
      return false;
    }
    return true;
  }, [isAuth, userId]);

  // Subtask của 1 task cha, đủ cả subtask không nằm trong state (task cha đã xong
  // ngày cũ, mở từ Lịch). Guest/lỗi → [] (popup gộp thêm từ state, xem mergeSubtasks).
  const getSubtasks = useCallback(async (parentId) => {
    if (!isAuth || !userId || !parentId) return [];
    const { data, error } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('parent_task_id', parentId)
      .order('created_at', { ascending: true });
    if (error) {
      logger.warn('[useUserTasks] getSubtasks error:', error.message);
      return [];
    }
    return data || [];
  }, [isAuth, userId]);

  // ── Get completed tasks in a date range (for calendar) ────────
  // v4.29.0: thay `getCompletedTasks(dateStr)` (1 query/ngày → 30 query/tháng khi
  // calendar cần chip trên mọi ô). Caller fetch 1 lần/tháng rồi tự group.
  //
  // Đệm ±1 ngày: `completed_at` là timestamptz, chuỗi không có timezone nên
  // Postgres so sánh theo UTC — còn caller group theo ngày ĐỊA PHƯƠNG. Task xong
  // lúc 00:30 giờ VN (+07) có completed_at UTC là ngày hôm trước, không đệm thì mất.
  //
  // `byPlan`: lọc theo NGÀY KẾ HOẠCH thay vì lúc bấm hoàn thành — các view Lịch
  // đặt task đã xong ở đúng ô đã lên lịch (kiểu Google Calendar), bấm hoàn thành
  // muộn không làm task nhảy sang ngày khác. Khoảng Bắt đầu→Hạn (v6.21.0) giao với
  // [startDate, endDate]: Hạn trong khoảng, Bắt đầu trong khoảng, hoặc trùm cả khoảng.
  // Cột DATE nên không cần đệm.
  // Danh sách "Đã xong" và Kanban vẫn lọc theo completed_at (đó là lịch sử).
  const getCompletedTasksRange = useCallback(async (startDate, endDate, { byPlan = false } = {}) => {
    if (!isAuth || !userId) return [];

    try {
      let query = supabase
        .from('user_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', true);
      query = byPlan
        ? query
          .or(`and(due_date.gte.${startDate},due_date.lte.${endDate}),and(start_date.gte.${startDate},start_date.lte.${endDate}),and(start_date.lt.${startDate},due_date.gt.${endDate})`)
          .order('due_date', { ascending: true })
        : query
          .gte('completed_at', `${addDays(startDate, -1)}T00:00:00`)
          .lt('completed_at', `${addDays(endDate, 2)}T00:00:00`)
          .order('completed_at', { ascending: true });
      const { data, error } = await query;

      if (error) {
        logger.error('[useUserTasks] getCompletedRange error:', error.message);
        return [];
      }
      // Subtask ẩn khỏi Lịch/Kanban/Đã xong. Lọc ở client (không .is() trong query)
      // để vẫn chạy khi DB chưa có cột parent_task_id.
      return (data || []).filter(t => !isSubtask(t));
    } catch (err) {
      logger.error('[useUserTasks] getCompletedRange exception:', err);
      return [];
    }
  }, [isAuth, userId]);

  // ── Sync pending tasks to Service Worker ──────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Nhắc lúc bắt đầu khung giờ làm + lúc đến hạn — logic thuần, xem buildTodayReminders.
    const reminders = buildTodayReminders(tasks, todayStr());

    navigator.serviceWorker.ready.then(reg => {
      if (reg.active) {
        reg.active.postMessage({ type: 'SYNC_REMINDERS', reminders });
      }
    }).catch(() => {});
  }, [tasks]);

  // ── Link collection to task (v4.5.0 junction) ──────────────
  // `title` (tuỳ chọn) chỉ để activity log ghi được TÊN bài viết thay vì uuid —
  // sau khi bài viết bị xoá thì không còn nguồn nào tra ngược tên.
  const linkCollection = useCallback(async (taskId, collectionId, title) => {
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
      logTaskRelation(ACTIONS.TASK_LINK_ADD, taskId, title || 'bài viết');
      return true;
    } catch (err) {
      logger.error('[useUserTasks] linkCollection exception:', err);
      return false;
    }
  }, [isAuth, logTaskRelation]);

  // ── Unlink collection from task (v4.5.0 junction) ──────────
  const unlinkCollection = useCallback(async (taskId, collectionId, title) => {
    if (!isAuth) return false;

    // Backup for rollback
    const backup = tasks.find(t => t.id === taskId)?._collections || [];
    const label = title || backup.find(c => c.id === collectionId)?.title || 'bài viết';

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
      logTaskRelation(ACTIONS.TASK_LINK_REMOVE, taskId, label, true);
      return true;
    } catch (err) {
      logger.error('[useUserTasks] unlinkCollection exception:', err);
      return false;
    }
  }, [isAuth, tasks, logTaskRelation]);

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
      logTaskRelation(ACTIONS.TASK_TAG_ADD, taskId, tag.name);
      return true;
    } catch (err) {
      logger.error('[useUserTasks] linkTaskTag exception:', err);
      return false;
    }
  }, [isAuth, logTaskRelation]);

  // ── Unlink tag from task ────────────────────────────────────
  const unlinkTaskTag = useCallback(async (taskId, tagId) => {
    if (!isAuth) return false;

    const backup = tasks.find(t => t.id === taskId)?._tags || [];
    // Lấy tên tag TRƯỚC khi optimistic gỡ nó khỏi state.
    const tagName = backup.find(x => x.id === tagId)?.name || 'tag';

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
      logTaskRelation(ACTIONS.TASK_TAG_REMOVE, taskId, tagName, true);
      return true;
    } catch (err) {
      logger.error('[useUserTasks] unlinkTaskTag exception:', err);
      return false;
    }
  }, [isAuth, tasks, logTaskRelation]);

  // Derived: split pending vs completed today.
  // status 'skip' (cột Bỏ qua của Kanban) = user chủ động gác lại → KHÔNG còn là việc
  // cần làm: ra khỏi Quá hạn/Hôm nay/Sắp tới, số đếm, Lịch và bộ chọn task của
  // Finance/Knowledge. Chỉ Kanban đọc `skippedTasks` để dựng cột Bỏ qua.
  // Subtask (parent_task_id, v6.20.0) chỉ sống bên trong task cha → loại khỏi MỌI
  // danh sách dẫn xuất; ai cần subtask thì đọc `tasks` (badge, popup, nhắc giờ).
  const topLevel = tasks.filter(t => !isSubtask(t));
  const pendingTasks = topLevel.filter(t => !t.completed && t.status !== 'skip');
  const skippedTasks = topLevel.filter(t => !t.completed && t.status === 'skip');
  const completedToday = topLevel.filter(t => t.completed);

  // ── Overdue Triage splits ─────────────────────────────────
  const today = todayStr();
  const todayTasks   = pendingTasks.filter(t => t.due_date === today);
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < today);
  const futureTasks  = pendingTasks.filter(t => t.due_date && t.due_date > today);
  const noDateTasks  = pendingTasks.filter(t => !t.due_date);

  // ── Rollover: move overdue task to today ──────────────────
  const rolloverTask = useCallback(async (taskId) => {
    return updateTask(taskId, { due_date: todayStr() });
  }, [updateTask]);

  return {
    tasks,
    pendingTasks,
    skippedTasks,
    completedToday,
    todayTasks,
    overdueTasks,
    futureTasks,
    noDateTasks,
    isLoading,
    addTask,
    completeTask,
    uncompleteTask,
    updateTask,
    deleteTask,
    addSubtasks,
    reorderSubtasks,
    getSubtasks,
    rolloverTask,
    getCompletedTasksRange,
    linkCollection,
    unlinkCollection,
    linkTaskTag,
    unlinkTaskTag,
  };
}

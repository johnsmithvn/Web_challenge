import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { toDateStr } from '../utils/dateUtils';
import BASE_EXERCISES from '../data/body-exercises.json';
import ROUTINE_TEMPLATES from '../data/body-routine-templates.json';

export function useWorkouts() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;
  const userId = user?.id;

  const [routines, setRoutines] = useState([]);
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [routineItems, setRoutineItems] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [recentSets, setRecentSets] = useState([]);
  const [customExercises, setCustomExercises] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Reset state when user logs out or user changes (RULES §3)
  useEffect(() => {
    if (!enabled) {
      setRoutines([]);
      setActiveRoutine(null);
      setRoutineItems([]);
      setSessions([]);
      setRecentSets([]);
      setCustomExercises([]);
      setHasLoaded(true);
      setIsLoading(false);
    }
  }, [enabled, userId]);

  // Map of all exercises (built-in + normalized custom)
  const exerciseMap = useMemo(() => {
    const map = new Map();
    BASE_EXERCISES.forEach(e => map.set(e.key, e));
    customExercises.forEach(c => {
      const normalized = {
        key: c.id,
        name: c.name,
        primary: c.primary_muscle || c.primary || 'chest',
        secondary: c.secondary_muscles || c.secondary || [],
        equipment: c.equipment || 'bw',
        level: c.level || 'Cơ bản',
        metric: c.metric || 'rep',
        defaultSets: 3,
        defaultTarget: 10,
        defaultKg: 0,
        steps: c.steps || [],
        tip: c.mistake_tip || c.tip || '',
        isCustom: true
      };
      map.set(c.id, normalized);
    });
    return map;
  }, [customExercises]);

  // Fetch data from Supabase
  const fetchData = useCallback(async () => {
    if (!enabled) {
      setHasLoaded(true);
      return;
    }
    setIsLoading(true);
    try {
      // 1. Fetch routines
      const { data: rData, error: rErr } = await supabase
        .from('body_routines')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (rErr) throw rErr;

      let currentRoutine = null;
      if (rData && rData.length > 0) {
        setRoutines(rData);
        currentRoutine = rData.find(r => r.is_active) || rData[0];
        setActiveRoutine(currentRoutine);
      } else {
        setRoutines([]);
        setActiveRoutine(null);
      }

      // 2. Fetch routine items for active routine
      if (currentRoutine) {
        const { data: itemData, error: itemErr } = await supabase
          .from('body_routine_items')
          .select('*')
          .eq('routine_id', currentRoutine.id)
          .eq('user_id', userId)
          .order('position', { ascending: true });

        if (!itemErr && itemData) {
          setRoutineItems(itemData);
        }
      } else {
        setRoutineItems([]);
      }

      // 3. Fetch recent sessions
      const { data: sessData, error: sessErr } = await supabase
        .from('body_workout_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('local_date', { ascending: false })
        .order('started_at', { ascending: false })
        .limit(30);

      if (!sessErr && sessData) {
        setSessions(sessData);
      }

      // 4. Fetch recent sets (for PR & progression comparison)
      const { data: setsData, error: setsErr } = await supabase
        .from('body_workout_sets')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(200);

      if (!setsErr && setsData) {
        setRecentSets(setsData);
      }

      // 5. Fetch custom exercises
      const { data: customData, error: customErr } = await supabase
        .from('body_custom_exercises')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null);

      if (!customErr && customData) {
        setCustomExercises(customData);
      }
    } catch (err) {
      logger.error('Failed to fetch workout data:', err);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, [enabled, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── LỘ TRÌNH (ROUTINES) ACTIONS ──────────────────────────────────────────

  // Tạo lộ trình mới từ template JSON
  const createRoutineFromTemplate = useCallback(async (templateKey) => {
    const tmpl = ROUTINE_TEMPLATES.find(t => t.key === templateKey);
    if (!tmpl) throw new Error(`Template not found: ${templateKey}`);

    const newRoutineId = crypto.randomUUID();
    const todayStr = toDateStr(new Date());

    const newRoutine = {
      id: newRoutineId,
      user_id: userId,
      name: tmpl.name,
      goal: tmpl.goal,
      weeks: tmpl.weeks || 8,
      start_date: todayStr,
      auto_progress: true,
      is_active: true,
      created_at: new Date().toISOString()
    };

    // Chuẩn bị các items
    const items = [];
    let pos = 1;
    (tmpl.days || []).forEach(day => {
      (day.items || []).forEach(it => {
        items.push({
          id: crypto.randomUUID(),
          routine_id: newRoutineId,
          user_id: userId,
          weekday: day.weekday,
          day_name: day.day_name,
          position: pos++,
          exercise_key: it.exercise_key,
          target_sets: it.target_sets || 3,
          target_val: it.target_val || 10,
          unit: it.unit || 'rep',
          kg: it.kg || 0,
          rest_seconds: it.rest_seconds || 60,
          created_at: new Date().toISOString()
        });
      });
    });

    // Optimistic update
    const prevRoutines = routines;
    const prevActive = activeRoutine;
    const prevItems = routineItems;

    setRoutines(prev => [newRoutine, ...prev.map(r => ({ ...r, is_active: false }))]);
    setActiveRoutine(newRoutine);
    setRoutineItems(items);

    if (enabled) {
      try {
        // Đặt các routine cũ về inactive
        await supabase
          .from('body_routines')
          .update({ is_active: false })
          .eq('user_id', userId);

        // Insert routine mới
        const { error: rErr } = await supabase
          .from('body_routines')
          .insert(newRoutine);

        if (rErr) throw rErr;

        // Insert các items
        if (items.length > 0) {
          const { error: itemErr } = await supabase
            .from('body_routine_items')
            .insert(items);

          if (itemErr) throw itemErr;
        }
      } catch (err) {
        logger.error('Failed to create routine from template, rolling back:', err);
        setRoutines(prevRoutines);
        setActiveRoutine(prevActive);
        setRoutineItems(prevItems);
        throw err;
      }
    }

    return newRoutine;
  }, [enabled, userId, routines, activeRoutine, routineItems]);

  // Tạo lộ trình tùy chỉnh mới (tự đặt tên, số tuần, chia lịch theo ngày)
  const createCustomRoutine = useCallback(async ({ name, goal, weeks = 8, days = [] }) => {
    const newRoutineId = crypto.randomUUID();
    const todayStr = toDateStr(new Date());

    const newRoutine = {
      id: newRoutineId,
      user_id: userId,
      name: name?.trim() || 'Lộ trình mới',
      goal: goal?.trim() || 'Rèn luyện sức khỏe & thể hình',
      weeks: Number(weeks) || 8,
      start_date: todayStr,
      auto_progress: true,
      is_active: true,
      created_at: new Date().toISOString()
    };

    const items = [];
    let pos = 1;
    (days || []).forEach(day => {
      (day.items || []).forEach(it => {
        items.push({
          id: crypto.randomUUID(),
          routine_id: newRoutineId,
          user_id: userId,
          weekday: day.weekday,
          day_name: day.day_name || '',
          position: pos++,
          exercise_key: it.exercise_key,
          target_sets: Number(it.target_sets) || 3,
          target_val: Number(it.target_val) || 10,
          unit: it.unit || 'rep',
          kg: Number(it.kg) || 0,
          rest_seconds: Number(it.rest_seconds) || 60,
          created_at: new Date().toISOString()
        });
      });
    });

    const prevRoutines = routines;
    const prevActive = activeRoutine;
    const prevItems = routineItems;

    setRoutines(prev => [newRoutine, ...prev.map(r => ({ ...r, is_active: false }))]);
    setActiveRoutine(newRoutine);
    setRoutineItems(items);

    if (enabled) {
      try {
        await supabase
          .from('body_routines')
          .update({ is_active: false })
          .eq('user_id', userId);

        const { error: rErr } = await supabase
          .from('body_routines')
          .insert(newRoutine);

        if (rErr) throw rErr;

        if (items.length > 0) {
          const { error: itemErr } = await supabase
            .from('body_routine_items')
            .insert(items);

          if (itemErr) throw itemErr;
        }
      } catch (err) {
        logger.error('Failed to create custom routine, rolling back:', err);
        setRoutines(prevRoutines);
        setActiveRoutine(prevActive);
        setRoutineItems(prevItems);
        throw err;
      }
    }

    return newRoutine;
  }, [enabled, userId, routines, activeRoutine, routineItems]);

  // Chuyển đổi sang lộ trình khác đã có trong danh sách
  const switchRoutine = useCallback(async (routineId) => {
    const target = routines.find(r => r.id === routineId);
    if (!target) return;

    const prevRoutines = routines;
    const prevActive = activeRoutine;
    const prevItems = routineItems;

    setRoutines(prev => prev.map(r => ({ ...r, is_active: r.id === routineId })));
    setActiveRoutine({ ...target, is_active: true });

    if (enabled) {
      try {
        await supabase
          .from('body_routines')
          .update({ is_active: false })
          .eq('user_id', userId);

        const { error } = await supabase
          .from('body_routines')
          .update({ is_active: true })
          .eq('id', routineId)
          .eq('user_id', userId);

        if (error) throw error;

        const { data: itemData, error: itemErr } = await supabase
          .from('body_routine_items')
          .select('*')
          .eq('routine_id', routineId)
          .eq('user_id', userId)
          .order('position', { ascending: true });

        if (!itemErr && itemData) {
          setRoutineItems(itemData);
        }
      } catch (err) {
        logger.error('Failed to switch routine, rolling back:', err);
        setRoutines(prevRoutines);
        setActiveRoutine(prevActive);
        setRoutineItems(prevItems);
        throw err;
      }
    }
  }, [enabled, userId, routines, activeRoutine, routineItems]);

  // Cập nhật thông tin lộ trình (tên, mục tiêu, số tuần)
  const updateRoutineDetails = useCallback(async (routineId, { name, goal, weeks }) => {
    const prevRoutines = routines;
    const prevActive = activeRoutine;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (goal !== undefined) updates.goal = goal.trim();
    if (weeks !== undefined) updates.weeks = Number(weeks);
    updates.updated_at = new Date().toISOString();

    setRoutines(prev => prev.map(r => r.id === routineId ? { ...r, ...updates } : r));
    if (activeRoutine?.id === routineId) {
      setActiveRoutine(prev => prev ? { ...prev, ...updates } : prev);
    }

    if (enabled && routineId) {
      try {
        const { error } = await supabase
          .from('body_routines')
          .update(updates)
          .eq('id', routineId)
          .eq('user_id', userId);

        if (error) throw error;
      } catch (err) {
        logger.error('Failed to update routine details, rolling back:', err);
        setRoutines(prevRoutines);
        setActiveRoutine(prevActive);
        throw err;
      }
    }
  }, [enabled, userId, routines, activeRoutine]);

  // Xóa lộ trình
  const deleteRoutine = useCallback(async (routineId) => {
    const prevRoutines = routines;
    const prevActive = activeRoutine;
    const prevItems = routineItems;

    const remaining = routines.filter(r => r.id !== routineId);
    let nextActive = null;
    if (activeRoutine?.id === routineId) {
      nextActive = remaining[0] || null;
    } else {
      nextActive = activeRoutine;
    }

    setRoutines(remaining);
    setActiveRoutine(nextActive);

    if (enabled) {
      try {
        const { error } = await supabase
          .from('body_routines')
          .delete()
          .eq('id', routineId)
          .eq('user_id', userId);

        if (error) throw error;

        if (nextActive && nextActive.id !== activeRoutine?.id) {
          await supabase
            .from('body_routines')
            .update({ is_active: true })
            .eq('id', nextActive.id)
            .eq('user_id', userId);

          const { data: itemData } = await supabase
            .from('body_routine_items')
            .select('*')
            .eq('routine_id', nextActive.id)
            .eq('user_id', userId)
            .order('position', { ascending: true });

          setRoutineItems(itemData || []);
        } else if (!nextActive) {
          setRoutineItems([]);
        }
      } catch (err) {
        logger.error('Failed to delete routine, rolling back:', err);
        setRoutines(prevRoutines);
        setActiveRoutine(prevActive);
        setRoutineItems(prevItems);
        throw err;
      }
    }
  }, [enabled, userId, routines, activeRoutine, routineItems]);

  // Cập nhật target_val của 1 routine item (optimistic with rollback)
  const updateRoutineTarget = useCallback(async (itemId, newTargetVal) => {
    const prevItems = routineItems;
    setRoutineItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, target_val: Number(newTargetVal) } : item
    ));

    if (enabled) {
      try {
        const { error } = await supabase
          .from('body_routine_items')
          .update({ target_val: Number(newTargetVal) })
          .eq('id', itemId)
          .eq('user_id', userId);

        if (error) throw error;
      } catch (err) {
        logger.error('Failed to update routine item target, rolling back:', err);
        setRoutineItems(prevItems);
        throw err;
      }
    }
  }, [enabled, userId, routineItems]);

  // Cập nhật target_sets của 1 routine item (optimistic with rollback)
  const updateRoutineSets = useCallback(async (itemId, newSets) => {
    const prevItems = routineItems;
    setRoutineItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, target_sets: Number(newSets) } : item
    ));

    if (enabled) {
      try {
        const { error } = await supabase
          .from('body_routine_items')
          .update({ target_sets: Number(newSets) })
          .eq('id', itemId)
          .eq('user_id', userId);

        if (error) throw error;
      } catch (err) {
        logger.error('Failed to update routine item sets, rolling back:', err);
        setRoutineItems(prevItems);
        throw err;
      }
    }
  }, [enabled, userId, routineItems]);

  // Thêm 1 bài tập vào lộ trình (optimistic with rollback)
  const addRoutineItem = useCallback(async ({ weekday, dayName, exerciseKey, sets = 3, targetVal = 10, unit = 'rep', kg = 0, restSeconds = 60 }) => {
    if (!activeRoutine?.id) throw new Error('Chưa có lộ trình đang kích hoạt');
    const existingDayItems = routineItems.filter(it => it.weekday === weekday);
    const newItem = {
      id: crypto.randomUUID(),
      routine_id: activeRoutine.id,
      user_id: userId,
      weekday,
      day_name: dayName || '',
      position: existingDayItems.length,
      exercise_key: exerciseKey,
      target_sets: Number(sets) || 3,
      target_val: Number(targetVal) || 10,
      unit: unit || 'rep',
      kg: Number(kg) || 0,
      rest_seconds: Number(restSeconds) || 60,
      created_at: new Date().toISOString()
    };

    const prevItems = routineItems;
    setRoutineItems(prev => [...prev, newItem]);

    if (enabled) {
      try {
        const { error } = await supabase
          .from('body_routine_items')
          .insert(newItem);

        if (error) throw error;
      } catch (err) {
        logger.error('Failed to add routine item, rolling back:', err);
        setRoutineItems(prevItems);
        throw err;
      }
    }

    return newItem;
  }, [enabled, userId, activeRoutine, routineItems]);

  // Xóa 1 bài tập khỏi lộ trình (optimistic with rollback)
  const deleteRoutineItem = useCallback(async (itemId) => {
    const prevItems = routineItems;
    setRoutineItems(prev => prev.filter(it => it.id !== itemId));

    if (enabled) {
      try {
        const { error } = await supabase
          .from('body_routine_items')
          .delete()
          .eq('id', itemId)
          .eq('user_id', userId);

        if (error) throw error;
      } catch (err) {
        logger.error('Failed to delete routine item, rolling back:', err);
        setRoutineItems(prevItems);
        throw err;
      }
    }
  }, [enabled, userId, routineItems]);

  // Bật/tắt tự động tăng tiến (optimistic with rollback)
  const toggleAutoProgress = useCallback(async (routineId, nextVal) => {
    const prevActive = activeRoutine;
    setActiveRoutine(prev => prev ? { ...prev, auto_progress: nextVal } : prev);

    if (enabled && routineId) {
      try {
        const { error } = await supabase
          .from('body_routines')
          .update({ auto_progress: nextVal })
          .eq('id', routineId)
          .eq('user_id', userId);

        if (error) throw error;
      } catch (err) {
        logger.error('Failed to update auto_progress, rolling back:', err);
        setActiveRoutine(prevActive);
        throw err;
      }
    }
  }, [enabled, userId, activeRoutine]);

  // Áp dụng hàng loạt tăng tiến cho các routine_items
  const applyProgression = useCallback(async (progressions) => {
    if (!Array.isArray(progressions) || progressions.length === 0) return;

    const prevItems = routineItems;
    setRoutineItems(prev => prev.map(item => {
      const found = progressions.find(p => p.routineItemId === item.id);
      return found ? { ...item, target_val: Number(found.nextTargetVal) } : item;
    }));

    if (enabled) {
      try {
        for (const p of progressions) {
          const { error } = await supabase
            .from('body_routine_items')
            .update({ target_val: Number(p.nextTargetVal) })
            .eq('id', p.routineItemId)
            .eq('user_id', userId);
          if (error) throw error;
        }
      } catch (err) {
        logger.error('Failed to apply progressions, rolling back:', err);
        setRoutineItems(prevItems);
        throw err;
      }
    }
  }, [enabled, userId, routineItems]);

  // ── BUỔI TẬP (SESSIONS & SETS) ACTIONS ────────────────────────────────────

  // Bắt đầu buổi tập mới
  const startSession = useCallback(async ({ plannedWeekday, dayName, routineId, mode = 'straight' }) => {
    const newSessionId = crypto.randomUUID();
    const todayStr = toDateStr(new Date());

    const newSession = {
      id: newSessionId,
      user_id: userId,
      routine_id: routineId || activeRoutine?.id || null,
      planned_weekday: plannedWeekday || 1,
      local_date: todayStr,
      title: `Buổi ${dayName || 'Tập luyện'}`,
      day_type: dayName || 'Tập luyện',
      mode,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      duration_seconds: 0,
      notes: ''
    };

    setSessions(prev => [newSession, ...prev.map(s => s.status === 'in_progress' ? { ...s, status: 'abandoned' } : s)]);

    if (enabled) {
      try {
        // Tự động đóng bất kỳ session in_progress cũ nào còn sót lại để không bị chặn bởi unique index
        await supabase
          .from('body_workout_sessions')
          .update({ status: 'abandoned', ended_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('status', 'in_progress');

        const { error } = await supabase
          .from('body_workout_sessions')
          .insert(newSession);

        if (error) throw error;
      } catch (err) {
        logger.error('Failed to start workout session:', err);
        setSessions(prev => prev.filter(s => s.id !== newSessionId));
        throw err;
      }
    }

    return newSession;
  }, [enabled, userId, activeRoutine]);

  // Ghi nhận một set tập (actualVal = null nếu bỏ set)
  const logSet = useCallback(async (setData) => {
    const newSetId = crypto.randomUUID();
    const newSet = {
      id: newSetId,
      session_id: setData.sessionId,
      user_id: userId,
      routine_item_id: setData.routineItemId || null,
      exercise_key: setData.exerciseKey,
      exercise_name: setData.exerciseName || setData.exerciseKey,
      set_no: setData.setNo,
      sequence_order: setData.sequenceOrder,
      target_val: Number(setData.targetVal),
      unit: setData.unit || 'rep',
      actual_val: setData.actualVal != null ? Number(setData.actualVal) : null,
      kg: Number(setData.kg || 0),
      is_pr: !!setData.isPR,
      completed_at: new Date().toISOString()
    };

    setRecentSets(prev => [newSet, ...prev]);

    if (enabled) {
      try {
        const { error } = await supabase
          .from('body_workout_sets')
          .upsert(newSet, { onConflict: 'id,user_id' });

        if (error) throw error;
      } catch (err) {
        logger.error('Failed to log workout set:', err);
        setRecentSets(prev => prev.filter(s => s.id !== newSetId));
        throw err;
      }
    }

    return newSet;
  }, [enabled, userId]);

  // Hoàn tất buổi tập
  const finishSession = useCallback(async ({ sessionId, durationSeconds, notes = '' }) => {
    const endedAt = new Date().toISOString();
    const prevSessions = sessions;

    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, status: 'completed', duration_seconds: durationSeconds, ended_at: endedAt, notes } : s
    ));

    if (enabled) {
      try {
        const { error } = await supabase
          .from('body_workout_sessions')
          .update({
            status: 'completed',
            duration_seconds: durationSeconds,
            ended_at: endedAt,
            notes
          })
          .eq('id', sessionId)
          .eq('user_id', userId);

        if (error) throw error;
      } catch (err) {
        logger.error('Failed to finish workout session, rolling back:', err);
        setSessions(prevSessions);
        throw err;
      }
    }
  }, [enabled, userId, sessions]);

  // Hủy buổi tập (abandon)
  const abandonSession = useCallback(async (sessionId) => {
    const endedAt = new Date().toISOString();
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, status: 'abandoned', ended_at: endedAt } : s
    ));

    if (enabled && sessionId) {
      try {
        const { error } = await supabase
          .from('body_workout_sessions')
          .update({ status: 'abandoned', ended_at: endedAt })
          .eq('id', sessionId)
          .eq('user_id', userId);
        if (error) throw error;
      } catch (err) {
        logger.error('Failed to abandon workout session:', err);
        throw err;
      }
    }
  }, [enabled, userId]);

  return {
    routines,
    activeRoutine,
    routineItems,
    sessions,
    recentSets,
    customExercises,
    exerciseMap,
    baseExercises: BASE_EXERCISES,
    routineTemplates: ROUTINE_TEMPLATES,
    isLoading,
    hasLoaded,
    fetchData,
    createRoutineFromTemplate,
    createCustomRoutine,
    switchRoutine,
    updateRoutineDetails,
    deleteRoutine,
    updateRoutineTarget,
    updateRoutineSets,
    addRoutineItem,
    deleteRoutineItem,
    toggleAutoProgress,
    applyProgression,
    startSession,
    logSet,
    finishSession,
    abandonSession
  };
}

import { useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'vl_custom_habits';

import HABITS_DATA from '../data/habits.json';

const DEFAULT_HABITS = HABITS_DATA.defaultHabits;
export const CATEGORIES  = HABITS_DATA.categories;
export const HABIT_ICONS = HABITS_DATA.icons;
export const HABIT_COLORS = HABITS_DATA.colors;


function loadLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || DEFAULT_HABITS; }
  catch { return DEFAULT_HABITS; }
}

export function useCustomHabits() {
  const { user, isAuthenticated } = useAuth();
  const useDB = isSupabaseEnabled && isAuthenticated;

  const [habits, setHabits] = useState(loadLocal);

  const saveLocal = (list) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    setHabits(list);
  };

  // ── CRUD ──────────────────────────────────────────────
  const addHabit = useCallback(async (habit) => {
    const newHabit = {
      id:          crypto.randomUUID(),
      name:        habit.name,
      action:      habit.action || habit.name, // fallback: action = name
      icon:        habit.icon || '⚡',
      color:       habit.color || '#8B5CF6',
      category:    habit.category || 'other',
      timeTarget:  habit.timeTarget || null,
      durationMin: habit.durationMin || null,
      status:      'active',
      cycleCount:  1,
      conqueredAt: null,
      active:      true,
      createdAt:   new Date().toISOString(),
    };
    const next = [...habits, newHabit];
    saveLocal(next);

    if (useDB) {
      await supabase.from('habits').insert({
        ...newHabit,
        user_id:      user.id,
        cycle_count:  newHabit.cycleCount,
        conquered_at: newHabit.conqueredAt,
      });
    }
    return newHabit;
  }, [habits, useDB, user]);

  const updateHabit = useCallback(async (id, updates) => {
    const next = habits.map(h => h.id === id ? { ...h, ...updates } : h);
    saveLocal(next);
    if (useDB) await supabase.from('habits').update(updates).eq('id', id).eq('user_id', user.id);
  }, [habits, useDB, user]);

  const deleteHabit = useCallback(async (id) => {
    const next = habits.filter(h => h.id !== id);
    saveLocal(next);
    if (useDB) await supabase.from('habits').delete().eq('id', id).eq('user_id', user.id);
  }, [habits, useDB, user]);

  const reorderHabits = useCallback((fromIdx, toIdx) => {
    const next = [...habits];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    saveLocal(next);
  }, [habits]);

  // Mark habit as conquered after 21-day cycle completion
  const conquestHabit = useCallback(async (id) => {
    const now = new Date().toISOString();
    const updates = { status: 'conquered', conqueredAt: now };
    const next = habits.map(h =>
      h.id === id ? { ...h, ...updates } : h
    );
    saveLocal(next);
    if (useDB) {
      await supabase.from('habits').update({
        status:       'conquered',
        conquered_at: now,
      }).eq('id', id).eq('user_id', user.id);
    }
  }, [habits, useDB, user]);

  // Renew habit for another 21-day cycle (harder round)
  const renewHabit = useCallback(async (id) => {
    const next = habits.map(h =>
      h.id === id ? { ...h, status: 'active', cycleCount: (h.cycleCount || 1) + 1 } : h
    );
    saveLocal(next);
    if (useDB) {
      const h = habits.find(x => x.id === id);
      await supabase.from('habits').update({
        status:      'active',
        cycle_count: (h?.cycleCount || 1) + 1,
      }).eq('id', id).eq('user_id', user.id);
    }
  }, [habits, useDB, user]);

  const activeHabits    = habits.filter(h => h.active !== false && (h.status ?? 'active') === 'active');
  const conqueredHabits = habits.filter(h => h.status === 'conquered');

  return { habits, activeHabits, conqueredHabits, addHabit, updateHabit, deleteHabit, reorderHabits, conquestHabit, renewHabit };
}

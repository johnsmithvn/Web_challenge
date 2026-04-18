import { useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'vl_custom_habits';

const DEFAULT_HABITS = [
  { id: 'h1', name: 'Tập thể dục', icon: '💪', color: '#06B6D4', category: 'health',  timeTarget: '07:00', durationMin: 20 },
  { id: 'h2', name: 'Đọc sách',    icon: '📚', color: '#8B5CF6', category: 'learning', timeTarget: '21:00', durationMin: 30 },
  { id: 'h3', name: 'MVA hàng ngày', icon: '⚡', color: '#00FF88', category: 'focus',  timeTarget: '08:00', durationMin: 15 },
];

export const CATEGORIES = [
  { id: 'health',   label: 'Sức Khoẻ',  icon: '💚' },
  { id: 'learning', label: 'Học Tập',   icon: '📖' },
  { id: 'focus',    label: 'Tập Trung', icon: '🎯' },
  { id: 'social',   label: 'Xã Hội',   icon: '👥' },
  { id: 'finance',  label: 'Tài Chính', icon: '💰' },
  { id: 'other',    label: 'Khác',      icon: '✨' },
];

export const HABIT_ICONS = ['💪','📚','⚡','🏃','🧘','💧','🥗','😴','🎯','✍️','🎵','🪴','🐕','🧹','💊','🚴','🏊','📝','🎨','🧠'];
export const HABIT_COLORS = ['#06B6D4','#8B5CF6','#00FF88','#F97316','#EF4444','#FFD700','#EC4899','#10B981','#6366F1','#F59E0B'];

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
      icon:        habit.icon || '⚡',
      color:       habit.color || '#8B5CF6',
      category:    habit.category || 'other',
      timeTarget:  habit.timeTarget || null,
      durationMin: habit.durationMin || null,
      active:      true,
      createdAt:   new Date().toISOString(),
    };
    const next = [...habits, newHabit];
    saveLocal(next);

    if (useDB) {
      await supabase.from('habits').insert({ ...newHabit, user_id: user.id });
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

  const activeHabits = habits.filter(h => h.active !== false);

  return { habits, activeHabits, addHabit, updateHabit, deleteHabit, reorderHabits };
}

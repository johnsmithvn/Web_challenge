import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

import HABITS_DATA from '../data/habits.json';

const DEFAULT_HABITS  = HABITS_DATA.defaultHabits;
export const CATEGORIES   = HABITS_DATA.categories;
export const HABIT_ICONS  = HABITS_DATA.icons;
export const HABIT_COLORS = HABITS_DATA.colors;

// Legacy localStorage key — read once for migration, then ignore
const LEGACY_KEY    = 'vl_custom_habits';
const MIGRATED_KEY  = 'vl_custom_habits_migrated';

// One-time migration: push any localStorage habits to Supabase
async function migrateLocalHabits(userId) {
  if (localStorage.getItem(MIGRATED_KEY) === userId) return;
  try {
    const local = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (local && Array.isArray(local) && local.length) {
      // Only push non-default habits (UUID ids)
      const custom = local.filter(h => h.id && h.id.includes('-'));
      if (custom.length) {
        const rows = custom.map(h => ({
          id:           h.id,
          user_id:      userId,
          name:         h.name,
          action:       h.action || h.name,
          icon:         h.icon || '⚡',
          color:        h.color || '#8B5CF6',
          category:     h.category || 'other',
          time_target:  h.timeTarget || null,
          duration_min: h.durationMin || null,
          status:       h.status || 'active',
          cycle_count:  h.cycleCount || 1,
          conquered_at: h.conqueredAt || null,
          active:       h.active !== false,
          created_at:   h.createdAt || new Date().toISOString(),
        }));
        await supabase.from('habits').upsert(rows, { onConflict: 'id' });
        console.log(`[CustomHabits] Migrated ${rows.length} habits from localStorage`);
      }
    }
    localStorage.removeItem(LEGACY_KEY);
    localStorage.setItem(MIGRATED_KEY, userId);
  } catch (e) {
    console.warn('[CustomHabits] Migration failed:', e.message);
  }
}

// Map Supabase row → camelCase habit object used by UI
function rowToHabit(r) {
  return {
    id:          r.id,
    name:        r.name,
    action:      r.action || r.name,
    icon:        r.icon || '⚡',
    color:       r.color || '#8B5CF6',
    category:    r.category || 'other',
    timeTarget:  r.time_target || null,
    durationMin: r.duration_min || null,
    status:      r.status || 'active',
    cycleCount:  r.cycle_count || 1,
    conqueredAt: r.conquered_at || null,
    active:      r.active !== false,
    createdAt:   r.created_at,
  };
}

export function useCustomHabits() {
  const { user, isAuthenticated } = useAuth();
  const useDB = isSupabaseEnabled && isAuthenticated;

  // Default habits shown for guests (not persisted)
  const [habits, setHabits] = useState(DEFAULT_HABITS);

  // On login: migrate + load from Supabase
  useEffect(() => {
    if (!useDB || !user) return;

    migrateLocalHabits(user.id).then(async () => {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at');

      if (!error && data) {
        const loaded = data.map(rowToHabit);
        setHabits(loaded.length ? loaded : DEFAULT_HABITS);
      }
    });
  }, [useDB, user?.id]);

  // Clear on logout — back to defaults
  useEffect(() => {
    if (!useDB) setHabits(DEFAULT_HABITS);
  }, [useDB]);

  // ── CRUD ──────────────────────────────────────────────────
  const addHabit = useCallback(async (habit) => {
    const newHabit = {
      id:          crypto.randomUUID(),
      name:        habit.name,
      action:      habit.action || habit.name,
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

    setHabits(prev => [...prev, newHabit]);

    if (useDB && user) {
      const { error } = await supabase.from('habits').insert({
        id:           newHabit.id,
        user_id:      user.id,
        name:         newHabit.name,
        action:       newHabit.action,
        icon:         newHabit.icon,
        color:        newHabit.color,
        category:     newHabit.category,
        time_target:  newHabit.timeTarget,
        duration_min: newHabit.durationMin,
        status:       newHabit.status,
        cycle_count:  newHabit.cycleCount,
        active:       true,
        created_at:   newHabit.createdAt,
      });
      if (error) {
        console.warn('[CustomHabits] add failed:', error.message);
        setHabits(prev => prev.filter(h => h.id !== newHabit.id));
        return null;
      }
    }
    return newHabit;
  }, [useDB, user]);

  const updateHabit = useCallback(async (id, updates) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));

    if (useDB && user) {
      const { error } = await supabase
        .from('habits')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) console.warn('[CustomHabits] update failed:', error.message);
    }
  }, [useDB, user]);

  const deleteHabit = useCallback(async (id) => {
    const prev = habits.find(h => h.id === id);
    setHabits(p => p.filter(h => h.id !== id));

    if (useDB && user) {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) {
        console.warn('[CustomHabits] delete failed:', error.message);
        if (prev) setHabits(p => [...p, prev]);
      }
    }
  }, [habits, useDB, user]);

  const reorderHabits = useCallback((fromIdx, toIdx) => {
    setHabits(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    // Reorder is UI-only — no DB column for sort_order yet
  }, []);

  const conquestHabit = useCallback(async (id) => {
    const now = new Date().toISOString();
    setHabits(prev => prev.map(h =>
      h.id === id ? { ...h, status: 'conquered', conqueredAt: now } : h
    ));
    if (useDB && user) {
      await supabase.from('habits')
        .update({ status: 'conquered', conquered_at: now })
        .eq('id', id).eq('user_id', user.id);
    }
  }, [useDB, user]);

  const renewHabit = useCallback(async (id) => {
    setHabits(prev => prev.map(h =>
      h.id === id ? { ...h, status: 'active', cycleCount: (h.cycleCount || 1) + 1 } : h
    ));
    if (useDB && user) {
      const h = habits.find(x => x.id === id);
      await supabase.from('habits')
        .update({ status: 'active', cycle_count: (h?.cycleCount || 1) + 1 })
        .eq('id', id).eq('user_id', user.id);
    }
  }, [habits, useDB, user]);

  const activeHabits    = habits.filter(h => h.active !== false && (h.status ?? 'active') === 'active');
  const conqueredHabits = habits.filter(h => h.status === 'conquered');

  return { habits, activeHabits, conqueredHabits, addHabit, updateHabit, deleteHabit, reorderHabits, conquestHabit, renewHabit };
}

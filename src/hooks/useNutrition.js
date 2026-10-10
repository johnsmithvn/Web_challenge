import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toDateStr } from '../utils/dateUtils';

const DEFAULT_SAVED_TEMPLATES = [
  { name: '1 Muỗng Whey Protein', calories: 120, protein: 25, carbs: 2, fat: 1 },
  { name: '100g Ức gà luộc', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: '2 Quả trứng luộc', calories: 140, protein: 12, carbs: 1, fat: 10 },
  { name: '1 Bát cơm trắng (150g)', calories: 200, protein: 4, carbs: 45, fat: 0.5 },
  { name: '1 Chuối tây', calories: 90, protein: 1, carbs: 23, fat: 0.3 }
];

export function useNutrition() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => toDateStr());

  const [mealLogs, setMealLogs] = useState([]);
  const [savedMeals, setSavedMeals] = useState([]);
  const [waterCups, setWaterCups] = useState(0);
  const [weeklyCheckins, setWeeklyCheckins] = useState([]);
  const [loading, setLoading] = useState(false);
  // Lần tải đầu đã xong chưa — `loading` còn false ở frame đầu nên không phân biệt được "đang tải" với "không có gì".
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load data for user and selected date
  useEffect(() => {
    if (!user) {
      setMealLogs([]);
      setSavedMeals([]);
      setWaterCups(0);
      setWeeklyCheckins([]);
      setHasLoaded(true);
      return;
    }

    let isMounted = true;
    async function fetchNutritionData() {
      try {
        setLoading(true);
        const [mealsRes, savedRes, waterRes, checkinsRes] = await Promise.all([
          supabase
            .from('body_meal_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('local_date', selectedDate)
            .order('created_at', { ascending: true }),
          supabase
            .from('body_saved_meals')
            .select('*')
            .eq('user_id', user.id)
            .order('name', { ascending: true }),
          supabase
            .from('body_water_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('local_date', selectedDate)
            .maybeSingle(),
          supabase
            .from('body_weekly_checkins')
            .select('*')
            .eq('user_id', user.id)
            .order('year', { ascending: false })
            .order('week_number', { ascending: false })
        ]);

        if (isMounted) {
          if (!mealsRes.error) setMealLogs(mealsRes.data || []);
          if (!savedRes.error) {
            setSavedMeals(savedRes.data && savedRes.data.length > 0 ? savedRes.data : DEFAULT_SAVED_TEMPLATES);
          }
          if (!waterRes.error) {
            setWaterCups(waterRes.data ? waterRes.data.cups_count : 0);
          }
          if (!checkinsRes.error) setWeeklyCheckins(checkinsRes.data || []);
        }
      } catch (err) {
        console.warn('Failed to load nutrition data:', err);
      } finally {
        if (isMounted) { setLoading(false); setHasLoaded(true); }
      }
    }

    fetchNutritionData();
    return () => { isMounted = false; };
  }, [user, selectedDate]);

  // Add meal log (Optimistic with rollback)
  const addMealLog = useCallback(async (mealData) => {
    const tempId = `meal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newRecord = {
      id: tempId,
      local_date: selectedDate,
      meal_type: mealData.meal_type || mealData.type || 'lunch',
      name: mealData.name.trim(),
      calories: Math.max(0, Math.round(Number(mealData.calories || mealData.kcal || 0))),
      protein: Math.max(0, Number(mealData.protein || 0)),
      carbs: Math.max(0, Number(mealData.carbs || 0)),
      fat: Math.max(0, Number(mealData.fat || 0)),
      created_at: new Date().toISOString()
    };

    setMealLogs(prev => [...prev, newRecord]);

    if (!user) return newRecord;

    try {
      const { data, error } = await supabase
        .from('body_meal_logs')
        .insert({
          user_id: user.id,
          local_date: newRecord.local_date,
          meal_type: newRecord.meal_type,
          name: newRecord.name,
          calories: newRecord.calories,
          protein: newRecord.protein,
          carbs: newRecord.carbs,
          fat: newRecord.fat
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setMealLogs(prev => prev.map(m => m.id === tempId ? data : m));
        return data;
      }
    } catch (err) {
      console.error('Failed to insert meal log, rolling back:', err);
      setMealLogs(prev => prev.filter(m => m.id !== tempId));
      throw err;
    }
  }, [user, selectedDate]);

  // Delete meal log (Optimistic with rollback)
  const deleteMealLog = useCallback(async (mealId) => {
    let removedItem = null;
    setMealLogs(prev => {
      removedItem = prev.find(m => m.id === mealId);
      return prev.filter(m => m.id !== mealId);
    });

    if (!user || !removedItem) return;

    try {
      const { error } = await supabase
        .from('body_meal_logs')
        .delete()
        .eq('id', mealId)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete meal log, rolling back:', err);
      setMealLogs(prev => [...prev, removedItem]);
      throw err;
    }
  }, [user]);

  // Update water cups (Optimistic with rollback)
  const updateWater = useCallback(async (newCups) => {
    const val = Math.max(0, Math.round(Number(newCups)));
    const prevVal = waterCups;
    setWaterCups(val);

    if (!user) return;

    try {
      const { error } = await supabase
        .from('body_water_logs')
        .upsert({
          user_id: user.id,
          local_date: selectedDate,
          cups_count: val
        }, { onConflict: 'user_id,local_date' });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update water log, rolling back:', err);
      setWaterCups(prevVal);
      throw err;
    }
  }, [user, selectedDate, waterCups]);

  // Save weekly check-in (Upsert)
  const saveWeeklyCheckin = useCallback(async (checkinData) => {
    const record = {
      week_number: Number(checkinData.week_number),
      year: Number(checkinData.year || new Date().getFullYear()),
      weight_avg: checkinData.weight_avg ? Number(checkinData.weight_avg) : null,
      waist_cm: checkinData.waist_cm ? Number(checkinData.waist_cm) : null,
      feel_energy: checkinData.feel_energy ? Number(checkinData.feel_energy) : null,
      feel_sleep: checkinData.feel_sleep ? Number(checkinData.feel_sleep) : null,
      feel_hunger: checkinData.feel_hunger ? Number(checkinData.feel_hunger) : null,
      feel_soreness: checkinData.feel_soreness ? Number(checkinData.feel_soreness) : null,
      notes: checkinData.notes || '',
      status: checkinData.status || 'completed'
    };

    let prevCheckins = null;
    setWeeklyCheckins(prev => {
      prevCheckins = prev;
      const filtered = prev.filter(c => !(c.week_number === record.week_number && c.year === record.year));
      return [record, ...filtered];
    });

    if (!user) return record;

    try {
      const { data, error } = await supabase
        .from('body_weekly_checkins')
        .upsert({
          user_id: user.id,
          ...record
        }, { onConflict: 'user_id,week_number,year' })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setWeeklyCheckins(prev => prev.map(c => (c.week_number === data.week_number && c.year === data.year) ? data : c));
        return data;
      }
    } catch (err) {
      console.error('Failed to save weekly checkin, rolling back:', err);
      if (prevCheckins) setWeeklyCheckins(prevCheckins);
      throw err;
    }
  }, [user]);

  // Save meal template
  const saveMealTemplate = useCallback(async (tplData) => {
    const newTpl = {
      name: tplData.name.trim(),
      calories: Math.max(0, Math.round(Number(tplData.calories || tplData.kcal || 0))),
      protein: Math.max(0, Number(tplData.protein || 0)),
      carbs: Math.max(0, Number(tplData.carbs || 0)),
      fat: Math.max(0, Number(tplData.fat || 0))
    };

    let prevTemplates = null;
    setSavedMeals(prev => {
      prevTemplates = prev;
      return [newTpl, ...prev];
    });

    if (!user) return newTpl;

    try {
      const { data, error } = await supabase
        .from('body_saved_meals')
        .insert({
          user_id: user.id,
          ...newTpl
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setSavedMeals(prev => prev.map(t => t.name === newTpl.name ? data : t));
        return data;
      }
    } catch (err) {
      console.error('Failed to save meal template, rolling back:', err);
      if (prevTemplates) setSavedMeals(prevTemplates);
      throw err;
    }
  }, [user]);

  return {
    selectedDate,
    setSelectedDate,
    mealLogs,
    savedMeals,
    waterCups,
    weeklyCheckins,
    loading,
    hasLoaded,
    addMealLog,
    deleteMealLog,
    updateWater,
    saveWeeklyCheckin,
    saveMealTemplate
  };
}

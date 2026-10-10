import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { calculateBMI, calculateBMR, calculateTDEE, calculateBodyScore } from '../utils/bodyMetrics';
import { toDateStr } from '../utils/dateUtils';

export function useBiometrics() {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  // Lần tải đầu đã xong chưa — `loading` còn false ở frame đầu nên không phân biệt được "đang tải" với "không có gì".
  const [hasLoaded, setHasLoaded] = useState(false);

  // Fetch measurements & profile from Supabase
  useEffect(() => {
    if (!user) {
      setMeasurements([]);
      setProfile(null);
      setHasLoaded(true);
      return;
    }

    let isMounted = true;
    async function fetchData() {
      try {
        setLoading(true);
        const [mRes, pRes] = await Promise.all([
          supabase
            .from('body_measurements')
            .select('*')
            .eq('user_id', user.id)
            .order('measured_at', { ascending: false }),
          supabase
            .from('body_profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle()
        ]);

        if (isMounted) {
          if (!mRes.error && mRes.data) {
            setMeasurements(mRes.data);
          }
          if (!pRes.error && pRes.data) {
            setProfile(pRes.data);
          }
        }
      } catch (err) {
        console.warn('Biometrics fetch error:', err);
      } finally {
        if (isMounted) { setLoading(false); setHasLoaded(true); }
      }
    }

    fetchData();
    return () => { isMounted = false; };
  }, [user]);

  const latest = useMemo(() => {
    return measurements.length > 0 ? measurements[0] : null;
  }, [measurements]);

  // Derived metrics (only computed if latest measurement exists)
  const bmiInfo = useMemo(() => {
    if (!latest?.weight || !profile?.height_cm) return null;
    return calculateBMI(latest.weight, profile.height_cm);
  }, [latest?.weight, profile?.height_cm]);

  const currentAge = useMemo(() => {
    if (!profile?.birth_year) return null;
    return new Date().getFullYear() - profile.birth_year;
  }, [profile?.birth_year]);

  const bmr = useMemo(() => {
    if (!latest?.weight || !profile?.height_cm || !profile?.gender || !currentAge) return null;
    return calculateBMR(latest.weight, profile.height_cm, currentAge, profile.gender);
  }, [latest?.weight, profile?.height_cm, currentAge, profile?.gender]);

  const tdee = useMemo(() => {
    if (!bmr || !profile?.activity_level) return null;
    return calculateTDEE(bmr, profile.activity_level);
  }, [bmr, profile?.activity_level]);

  const bodyScore = useMemo(() => {
    if (!latest) return null;
    return calculateBodyScore({
      bmi: bmiInfo?.bmi,
      bodyFatPct: latest.body_fat_pct,
      skeletalMuscleKg: latest.skeletal_muscle_kg,
      visceralFat: latest.visceral_fat
    });
  }, [latest, bmiInfo]);

  // Add measurement (Optimistic with rollback)
  const addMeasurement = useCallback(async (data) => {
    const tempId = `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newRecord = {
      id: tempId,
      measured_at: data.measured_at || new Date().toISOString(),
      local_date: data.local_date || toDateStr(data.measured_at ? new Date(data.measured_at) : new Date()),
      time_slot: data.time_slot || 'morning',
      weight: Number(data.weight),
      body_fat_pct: data.body_fat_pct ? Number(data.body_fat_pct) : null,
      skeletal_muscle_kg: data.skeletal_muscle_kg ? Number(data.skeletal_muscle_kg) : null,
      visceral_fat: data.visceral_fat ? Number(data.visceral_fat) : null,
      water_pct: data.water_pct ? Number(data.water_pct) : null,
      bone_mass_kg: data.bone_mass_kg ? Number(data.bone_mass_kg) : null,
      source: data.source || 'manual',
      is_outlier: !!data.is_outlier
    };

    setMeasurements(prev => [newRecord, ...prev]);

    if (!user) return newRecord;

    try {
      const { data: inserted, error } = await supabase
        .from('body_measurements')
        .insert({
          user_id: user.id,
          measured_at: newRecord.measured_at,
          local_date: newRecord.local_date,
          time_slot: newRecord.time_slot,
          weight: newRecord.weight,
          body_fat_pct: newRecord.body_fat_pct,
          skeletal_muscle_kg: newRecord.skeletal_muscle_kg,
          visceral_fat: newRecord.visceral_fat,
          water_pct: newRecord.water_pct,
          bone_mass_kg: newRecord.bone_mass_kg,
          source: newRecord.source,
          is_outlier: newRecord.is_outlier
        })
        .select()
        .single();

      if (error) throw error;
      if (inserted) {
        setMeasurements(prev => prev.map(m => m.id === tempId ? inserted : m));
        return inserted;
      }
    } catch (err) {
      console.error('Save measurement failed, rolling back:', err);
      setMeasurements(prev => prev.filter(m => m.id !== tempId));
      throw err;
    }
  }, [user]);

  // Toggle outlier flag (Optimistic with rollback)
  const toggleOutlier = useCallback(async (id) => {
    const target = measurements.find(m => m.id === id);
    if (!target) return;

    const prevOutlier = target.is_outlier;
    setMeasurements(prev => prev.map(m => m.id === id ? { ...m, is_outlier: !prevOutlier } : m));

    if (!user) return;

    try {
      const { error } = await supabase
        .from('body_measurements')
        .update({ is_outlier: !prevOutlier })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (err) {
      console.error('Toggle outlier failed, rolling back:', err);
      setMeasurements(prev => prev.map(m => m.id === id ? { ...m, is_outlier: prevOutlier } : m));
      throw err;
    }
  }, [user, measurements]);

  // Delete measurement (Optimistic with rollback)
  const deleteMeasurement = useCallback(async (id) => {
    const target = measurements.find(m => m.id === id);
    if (!target) return;

    setMeasurements(prev => prev.filter(m => m.id !== id));

    if (!user) return;

    try {
      const { error } = await supabase
        .from('body_measurements')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (err) {
      console.error('Delete measurement failed, rolling back:', err);
      setMeasurements(prev => [target, ...prev]);
      throw err;
    }
  }, [user, measurements]);

  // Update profile (Optimistic with rollback)
  const updateProfile = useCallback(async (updates) => {
    const prevProfile = profile;
    const merged = { ...(prevProfile || {}), ...updates };
    setProfile(merged);

    if (!user) return;

    try {
      const { error } = await supabase
        .from('body_profiles')
        .upsert({
          user_id: user.id,
          ...merged,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (err) {
      console.error('Update profile failed, rolling back:', err);
      setProfile(prevProfile);
      throw err;
    }
  }, [user, profile]);

  return {
    measurements,
    latest,
    profile,
    bmiInfo,
    bmr,
    tdee,
    bodyScore,
    loading,
    hasLoaded,
    addMeasurement,
    toggleOutlier,
    deleteMeasurement,
    updateProfile
  };
}

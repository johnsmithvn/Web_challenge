import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY   = 'vl_focus_sessions';
const SETTINGS_KEY  = 'vl_focus_settings';

const DEFAULT_SETTINGS = {
  workMin:       25,
  shortBreakMin: 5,
  longBreakMin:  15,
  sessionsBeforeLong: 4,
};

export function useFocusTimer() {
  const { user, isAuthenticated } = useAuth();
  const useDB = isSupabaseEnabled && isAuthenticated;
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch { return DEFAULT_SETTINGS; }
  });

  const [phase,       setPhase]       = useState('work');   // 'work' | 'short_break' | 'long_break'
  const [secondsLeft, setSecondsLeft] = useState(settings.workMin * 60);
  const [running,     setRunning]     = useState(false);
  const [session,     setSession]     = useState(0);        // completed work sessions today
  const [habitId,     setHabitId]     = useState(null);     // linked habit
  const [sessions,    setSessions]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  });

  const totalSec = phase === 'work'
    ? settings.workMin * 60
    : phase === 'short_break'
      ? settings.shortBreakMin * 60
      : settings.longBreakMin * 60;

  const pct = Math.round(((totalSec - secondsLeft) / totalSec) * 100);

  // Tick
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(id);
          handlePhaseEnd();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, phase]);

  const handlePhaseEnd = useCallback(() => {
    setRunning(false);
    if (phase === 'work') {
      const newSession = session + 1;
      setSession(newSession);

      // Log session
      const log = {
        id:       crypto.randomUUID(),
        habitId,
        date:     new Date().toISOString().split('T')[0],
        durationMin: settings.workMin,
        completedAt: new Date().toISOString(),
      };
      const next = [...sessions, log];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSessions(next);

      // Sync to Supabase if authenticated
      if (useDB && user) {
        supabase.from('focus_sessions').insert({
          user_id:     user.id,
          habit_id:    habitId || null,
          duration_min: settings.workMin,
          date:        log.date,
          completed_at: log.completedAt,
        }).then();  // fire-and-forget, don't block UI
      }

      // Determine next phase
      if (newSession % settings.sessionsBeforeLong === 0) {
        setPhase('long_break');
        setSecondsLeft(settings.longBreakMin * 60);
      } else {
        setPhase('short_break');
        setSecondsLeft(settings.shortBreakMin * 60);
      }

      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification('⚡ Xong rồi!', { body: `${settings.workMin} phút hoàn thành! Nghỉ thôi.` });
      }
    } else {
      // Break ended
      setPhase('work');
      setSecondsLeft(settings.workMin * 60);
      if (Notification.permission === 'granted') {
        new Notification('🎯 Bắt đầu lại!', { body: 'Nghỉ xong rồi. Focus tiếp nào!' });
      }
    }
  }, [phase, session, sessions, settings, habitId]);

  const start  = useCallback(() => setRunning(true), []);
  const pause  = useCallback(() => setRunning(false), []);
  const reset  = useCallback(() => { setRunning(false); setPhase('work'); setSecondsLeft(settings.workMin * 60); }, [settings]);
  const skip   = useCallback(() => { setRunning(false); handlePhaseEnd(); }, [handlePhaseEnd]);

  const updateSettings = useCallback((s) => {
    const next = { ...settings, ...s };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setSettings(next);
    setSecondsLeft(next.workMin * 60);
    setPhase('work'); setRunning(false);
  }, [settings]);

  const linkHabit = useCallback((id) => setHabitId(id), []);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  // Today sessions
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter(s => s.date === today);
  const todayMinutes  = todaySessions.reduce((a, s) => a + s.durationMin, 0);

  return {
    phase, running, mins, secs, pct, session,
    settings, sessions, todaySessions, todayMinutes,
    habitId, secondsLeft, totalSec,
    start, pause, reset, skip,
    updateSettings, linkHabit,
  };
}

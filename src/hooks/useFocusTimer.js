import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// XP for completing a focus session (avoid circular import from useXpStore)
const FOCUS_XP      = 15;
const XP_STORE_KEY  = 'vl_xp_store';

function awardFocusXp(sessionId) {
  try {
    const log = JSON.parse(localStorage.getItem(XP_STORE_KEY) || '[]');
    const already = log.some(e => e.reason === 'focus_session' && e.meta?.sessionId === sessionId);
    if (already) return;
    log.push({ amount: FOCUS_XP, reason: 'focus_session', meta: { sessionId }, ts: Date.now() });
    localStorage.setItem(XP_STORE_KEY, JSON.stringify(log));
  } catch (e) {
    console.warn('[FocusTimer] XP award failed:', e.message);
  }
}

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

      // Award focus XP (deduped per session id)
      awardFocusXp(log.id);

      // Auto-tick linked habit in vl_habit_progress if session >= habit.durationMin
      if (habitId) {
        try {
          const HABITS_KEY  = 'vl_custom_habits';
          const PROG_KEY    = 'vl_habit_progress';
          const habits      = JSON.parse(localStorage.getItem(HABITS_KEY) || '[]');
          const habit       = habits.find(h => h.id === habitId);
          const totalFocusMin = [...next]
            .filter(s => s.habitId === habitId && s.date === log.date)
            .reduce((sum, s) => sum + s.durationMin, 0);
          const target = habit?.durationMin ?? settings.workMin;
          if (habit && totalFocusMin >= target) {
            const prog = JSON.parse(localStorage.getItem(PROG_KEY) || '{}');
            const key  = `${log.date}_${habitId}`;
            if (!prog[key]) {
              prog[key] = true;
              localStorage.setItem(PROG_KEY, JSON.stringify(prog));
              // Dispatch storage event so HabitsPage can react without reload
              window.dispatchEvent(new Event('storage'));
            }
          }
        } catch (e) {
          console.warn('[FocusTimer] habit auto-tick failed:', e.message);
        }
      }

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

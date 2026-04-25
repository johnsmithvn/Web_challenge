import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useActiveJourney } from '../contexts/JourneyContext';

// XP for completing a focus session.
// Written directly to Supabase xp_logs to avoid circular import with useXpStore.
const FOCUS_XP = 15;

async function awardFocusXp(userId, sessionId, useDB) {
  if (!useDB || !userId) return;
  try {
    // Dedup: check if this session already rewarded
    const { data } = await supabase
      .from('xp_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('reason', 'focus_session')
      .contains('meta', { sessionId })
      .maybeSingle();

    if (data) return; // already awarded

    await supabase.from('xp_logs').insert({
      user_id:    userId,
      amount:     FOCUS_XP,
      reason:     'focus_session',
      meta:       { sessionId },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[FocusTimer] XP award failed:', e.message);
  }
}

// Settings can stay in localStorage — it's a UI preference, not user data
const SETTINGS_KEY = 'vl_focus_settings';

const DEFAULT_SETTINGS = {
  workMin:            25,
  shortBreakMin:      5,
  longBreakMin:       15,
  sessionsBeforeLong: 4,
};

export function useFocusTimer() {
  const { user, isAuthenticated } = useAuth();
  const { activeJourney } = useActiveJourney();  // ← context, always up-to-date
  const activeJourneyRef = useRef(activeJourney);
  useEffect(() => { activeJourneyRef.current = activeJourney; }, [activeJourney]);
  const useDB = isSupabaseEnabled && isAuthenticated;

  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch { return DEFAULT_SETTINGS; }
  });

  const [phase,       setPhase]       = useState('work');
  const [secondsLeft, setSecondsLeft] = useState(settings.workMin * 60);
  const [running,     setRunning]     = useState(false);
  const [session,     setSession]     = useState(0);
  const [habitId,     setHabitId]     = useState(null);

  // In-memory session log (loaded from Supabase on login)
  const [sessions, setSessions] = useState([]);

  // Load today's sessions from Supabase on login
  useEffect(() => {
    if (!useDB || !user) return;
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('focus_sessions')
      .select('id, habit_id, duration_min, date, completed_at')
      .eq('user_id', user.id)
      .eq('date', today)
      .then(({ data, error }) => {
        if (!error && data) {
          setSessions(data.map(r => ({
            id:          r.id,
            habitId:     r.habit_id,
            date:        r.date,
            durationMin: r.duration_min,
            completedAt: r.completed_at,
          })));
        }
      });
  }, [useDB, user?.id]);

  // Clear on logout
  useEffect(() => {
    if (!useDB) setSessions([]);
  }, [useDB]);

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
        if (s <= 1) { clearInterval(id); handlePhaseEnd(); return 0; }
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

      const today = new Date().toISOString().split('T')[0];
      const log = {
        id:          crypto.randomUUID(),
        habitId,
        date:        today,
        durationMin: settings.workMin,
        completedAt: new Date().toISOString(),
      };
      const next = [...sessions, log];
      setSessions(next);

      // Persist to Supabase (fire-and-forget)
      if (useDB && user) {
        supabase.from('focus_sessions').insert({
          id:           log.id,
          user_id:      user.id,
          habit_id:     habitId || null,
          journey_id:   activeJourneyRef.current?.id || null,
          duration_min: settings.workMin,
          date:         today,
          completed_at: log.completedAt,
        }).then(({ error }) => {
          if (error) console.warn('[FocusTimer] session insert failed:', error.message);
        });

        // Award XP via Supabase (deduped)
        awardFocusXp(user.id, log.id, useDB);
      }

      // Auto-tick linked habit via useHabitLogs event
      // Emit a custom event so TrackerPage/useHabitLogs can react
      if (habitId) {
        const totalFocusMin = next
          .filter(s => s.habitId === habitId && s.date === today)
          .reduce((sum, s) => sum + s.durationMin, 0);

        window.dispatchEvent(new CustomEvent('focus:habit-tick', {
          detail: { habitId, date: today, totalFocusMin }
        }));
      }

      // Determine next phase
      if (newSession % settings.sessionsBeforeLong === 0) {
        setPhase('long_break');
        setSecondsLeft(settings.longBreakMin * 60);
      } else {
        setPhase('short_break');
        setSecondsLeft(settings.shortBreakMin * 60);
      }

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
  }, [phase, session, sessions, settings, habitId, useDB, user]);

  const start  = useCallback(() => setRunning(true), []);
  const pause  = useCallback(() => setRunning(false), []);
  const reset  = useCallback(() => {
    setRunning(false); setPhase('work'); setSecondsLeft(settings.workMin * 60);
  }, [settings]);
  const skip   = useCallback(() => { setRunning(false); handlePhaseEnd(); }, [handlePhaseEnd]);

  const updateSettings = useCallback((s) => {
    const next = { ...settings, ...s };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); // UI pref — OK in LS
    setSettings(next);
    setSecondsLeft(next.workMin * 60);
    setPhase('work'); setRunning(false);
  }, [settings]);

  const linkHabit = useCallback((id) => setHabitId(id), []);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

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

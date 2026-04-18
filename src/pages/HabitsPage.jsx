import { useState, useEffect } from 'react';
import { useHabitStore } from '../hooks/useHabitStore';
import { useCustomHabits } from '../hooks/useCustomHabits';
import { useXpStore, XP_REWARDS } from '../hooks/useXpStore';
import { useMoodLog, useSkipReasons } from '../hooks/useMoodSkip';
import { useAuth } from '../contexts/AuthContext';
import MonthCalendar from '../components/MonthCalendar';
import HabitManager from '../components/HabitManager';
import LoginNudgeModal from '../components/LoginNudgeModal';
import '../styles/calendar.css';
import '../styles/tracker.css';
import '../styles/completion.css';

import HABITS_DATA from '../data/habits.json';
const SKIP_REASONS = HABITS_DATA.skipReasons;
const MOODS        = HABITS_DATA.moods;

export default function HabitsPage() {
  const { data, toggle, streak, totalDone } = useHabitStore();
  const { activeHabits, conqueredHabits } = useCustomHabits();
  const { addXp, hasMilestone } = useXpStore();
  const { saveMood, getMood } = useMoodLog();
  const { saveSkip } = useSkipReasons();
  const { isAuthenticated } = useAuth();

  const NUDGE_KEY = 'vl_login_nudge_shown';
  const [showNudge, setShowNudge] = useState(false);

  const [tab,           setTab]           = useState('calendar');
  const [skipModal,     setSkipModal]     = useState(null);
  const [skipReason,    setSkipReason]    = useState('');
  const [skipNote,      setSkipNote]      = useState('');
  const [celebration,   setCelebration]   = useState(false); // day-complete banner

  // Per-habit daily progress: { "2026-04-18_h1": true, ... }
  const HABIT_PROG_KEY = 'vl_habit_progress';
  const [habitProg, setHabitProg] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HABIT_PROG_KEY) || '{}'); }
    catch { return {}; }
  });

  const todayKey  = new Date().toISOString().split('T')[0];
  const todayMood = getMood(todayKey);

  // Tick a specific habit for today
  const handleHabitTick = (habit) => {
    const key       = `${todayKey}_${habit.id}`;
    const wasDone   = !!habitProg[key];
    const next      = { ...habitProg, [key]: !wasDone };
    localStorage.setItem(HABIT_PROG_KEY, JSON.stringify(next));
    setHabitProg(next);

    // Award XP once per habit per day (only when checking)
    if (!wasDone && !hasMilestone('habit_tick', { habitId: habit.id, date: todayKey })) {
      addXp(XP_REWARDS.daily_check, 'habit_tick', { habitId: habit.id, date: todayKey });
    }

    // Mark overall day done if ALL habits ticked
    const allDone = activeHabits.every(h =>
      h.id === habit.id ? !wasDone : !!next[`${todayKey}_${h.id}`]
    );
    if (allDone && !data[todayKey]) {
      toggle(todayKey);
      setCelebration(true);
      // Show login nudge for guest users on their FIRST completed day
      if (!isAuthenticated && totalDone === 0 && !localStorage.getItem(NUDGE_KEY)) {
        setTimeout(() => setShowNudge(true), 1500); // slight delay for celebration first
      }
    } else if (!allDone && data[todayKey]) {
      toggle(todayKey); // untick overall if any unchecked
      setCelebration(false);
    }
  };

  // Auto-dismiss celebration after 4s
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(false), 4000);
    return () => clearTimeout(t);
  }, [celebration]);

  const todayDone = activeHabits.length > 0
    ? activeHabits.every(h => !!habitProg[`${todayKey}_${h.id}`])
    : !!data[todayKey];

  const handleSkipSubmit = () => {
    saveSkip(skipModal, skipReason, skipNote);
    setSkipModal(null); setSkipReason(''); setSkipNote('');
  };

  const handleMood = (m) => saveMood(todayKey, m);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '6rem 0 4rem' }}>
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-label">📋 Habits</div>
          <h1 className="display-2">
            Theo Dõi <span className="gradient-text">Thói Quen</span>
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <div className="tracker-stat-card card" style={{ flex: '0 0 auto', padding: '0.75rem 1.25rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🔥</span>
              <span className="gradient-text" style={{ fontWeight: 800, fontSize: '1.4rem' }}>{streak}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Streak</span>
            </div>
            <div className="tracker-stat-card card" style={{ flex: '0 0 auto', padding: '0.75rem 1.25rem' }}>
              <span style={{ fontSize: '1.4rem' }}>📅</span>
              <span className="gradient-text-green" style={{ fontWeight: 800, fontSize: '1.4rem' }}>{totalDone}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tổng ngày</span>
            </div>
          </div>
        </div>

        {/* ── Celebration banner ── */}
        {celebration && (
          <div style={{
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(0,255,136,0.12), rgba(139,92,246,0.12))',
            border: '1px solid rgba(0,255,136,0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.25rem',
            textAlign: 'center',
            animation: 'completionPop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-display)', color: 'var(--green)' }}>
              Chúc mừng! Ngày thứ <span style={{ color: 'var(--gold)' }}>{streak}/{Math.max(streak, 21)}</span> hoàn thành!
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              {streak < 21
                ? `Còn ${21 - streak} ngày nữa để hoàn thành chương trình 🌱`
                : '🏆 Bạn đã hoàn thành 21 ngày! Kỷ luật thành bản năng.'}
            </div>
          </div>
        )}

        {/* Today's habits quick-tick */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <div className="dash-card-title">⚡ Hôm Nay — {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
            {activeHabits.map(habit => {
              const doneToday = !!habitProg[`${todayKey}_${habit.id}`];
              return (
                <div key={habit.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem', background: doneToday ? `${habit.color}11` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${doneToday ? habit.color + '55' : 'rgba(255,255,255,0.07)'}`,
                  borderLeft: `3px solid ${habit.color}`,
                  borderRadius: 'var(--radius-md)', transition: 'var(--transition-base)',
                }}>
                  <span style={{ fontSize: '1.4rem' }}>{habit.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem',
                      textDecoration: doneToday ? 'line-through' : 'none',
                      color: doneToday ? 'var(--text-muted)' : 'var(--text-primary)',
                    }}>
                      {/* Show specific action if defined, fallback to name */}
                      {habit.action && habit.action !== habit.name ? habit.action : habit.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                      {habit.action && habit.action !== habit.name && (
                        <span style={{ marginRight: '0.5rem', opacity: 0.7 }}>{habit.name}</span>
                      )}
                      {habit.timeTarget && `⏰ ${habit.timeTarget}`}
                      {habit.timeTarget && habit.durationMin && ' · '}
                      {habit.durationMin && `⏱ ${habit.durationMin}p`}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="habit-checkbox"
                    checked={doneToday}
                    onChange={() => handleHabitTick(habit)}
                    id={`today-habit-${habit.id}`}
                    aria-label={habit.name}
                  />
                </div>
              );
            })}
          </div>

          {/* Skip reason trigger */}
          {!todayDone && new Date().getHours() >= 20 && (
            <button
              className="btn btn-ghost"
              style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}
              onClick={() => setSkipModal(todayKey)}
              id="skip-reason-btn"
            >
              📝 Ghi nhận lý do bỏ hôm nay
            </button>
          )}
        </div>

        {/* Mood tracker */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <div className="dash-card-title">😊 Tâm Trạng Hôm Nay</div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            {MOODS.map(m => (
              <button
                key={m.label}
                onClick={() => handleMood(m)}
                id={`mood-${m.label}`}
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: 'var(--radius-full)',
                  background: todayMood?.label === m.label
                    ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${ todayMood?.label === m.label
                    ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  color: 'var(--text-secondary)',
                  transition: 'var(--transition-base)',
                  display: 'flex', gap: '0.4rem', alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
          {todayMood && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Đã lưu: {todayMood.emoji} {todayMood.label}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(255,255,255,0.04)', padding: '0.25rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.25rem' }}>
          {[['calendar','📅 Lịch Tháng'],['manage','⚙️ Quản Lý Habits']].map(([id,label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              id={`tab-${id}`}
              style={{
                flex: 1, padding: '0.55rem', borderRadius: 'var(--radius-md)',
                fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                background: tab === id ? 'rgba(139,92,246,0.2)' : 'transparent',
                border: tab === id ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                color: tab === id ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'var(--transition-base)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'calendar' && <MonthCalendar habitData={data} />}
        {tab === 'manage'   && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <HabitManager />
          </div>
        )}
      </div>

      {/* ── Conquered Habits ── */}
      {conqueredHabits.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <div className="dash-card-title">🏅 Đã Chinh Phục</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
            Những thói quen bạn đã hoàn thành 21 ngày. Kỷ luật thành bản năng!
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {conqueredHabits.map(habit => (
              <div key={habit.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem',
                background: 'rgba(255,215,0,0.04)',
                border: '1px solid rgba(255,215,0,0.2)',
                borderLeft: '3px solid #FFD700',
                borderRadius: 'var(--radius-md)',
              }}>
                <span style={{ fontSize: '1.4rem' }}>{habit.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{habit.name}</div>
                  {habit.action && habit.action !== habit.name && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🎯 {habit.action}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#FFD700', fontWeight: 700 }}>🏅 Vòng {habit.cycleCount || 1}</div>
                  {habit.conqueredAt && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {new Date(habit.conqueredAt).toLocaleDateString('vi-VN')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skip Reason Modal */}
      {skipModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setSkipModal(null)}>
          <div className="auth-modal card" style={{ maxWidth: 440 }}>
            <button className="auth-modal__close" onClick={() => setSkipModal(null)}>✕</button>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}>
              📝 Tại sao bỏ hôm nay?
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
              {SKIP_REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setSkipReason(r)}
                  id={`skip-${r}`}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    background: skipReason === r ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${skipReason === r ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: skipReason === r ? '#f87171' : 'var(--text-secondary)',
                    transition: 'var(--transition-base)',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              className="auth-input"
              rows={3}
              placeholder="Ghi chú thêm (tuỳ chọn)..."
              value={skipNote}
              onChange={e => setSkipNote(e.target.value)}
              id="skip-note-input"
              style={{ resize: 'none', marginBottom: '0.75rem' }}
            />
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
              onClick={handleSkipSubmit}
              disabled={!skipReason}
              id="skip-submit-btn"
            >
              Lưu Lý Do
            </button>
          </div>
        </div>
      )}
      {showNudge && (
        <LoginNudgeModal onClose={() => setShowNudge(false)} />
      )}

    </div>
  );
}

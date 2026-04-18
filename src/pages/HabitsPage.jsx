import { useState } from 'react';
import { useHabitStore } from '../hooks/useHabitStore';
import { useCustomHabits } from '../hooks/useCustomHabits';
import { useXpStore, XP_REWARDS } from '../hooks/useXpStore';
import { useMoodLog, useSkipReasons } from '../hooks/useMoodSkip';
import MonthCalendar from '../components/MonthCalendar';
import HabitManager from '../components/HabitManager';
import '../styles/calendar.css';
import '../styles/tracker.css';

const SKIP_REASONS = [
  'Bận công việc', 'Ốm / mệt', 'Quên mất', 'Thiếu động lực',
  'Không có thời gian', 'Có việc đột xuất', 'Lý do khác',
];
const MOODS = [
  { emoji: '😴', label: 'Kiệt sức' },
  { emoji: '😔', label: 'Thấp' },
  { emoji: '😐', label: 'Bình thường' },
  { emoji: '😊', label: 'Tốt' },
  { emoji: '💪', label: 'Tuyệt vời' },
];

export default function HabitsPage() {
  const { data, toggle, streak, totalDone } = useHabitStore();
  const { activeHabits } = useCustomHabits();
  const { addXp, hasMilestone } = useXpStore();
  const { saveMood, getMood } = useMoodLog();
  const { saveSkip } = useSkipReasons();

  const [tab,         setTab]         = useState('calendar');
  const [skipModal,   setSkipModal]   = useState(null);
  const [skipReason,  setSkipReason]  = useState('');
  const [skipNote,    setSkipNote]    = useState('');

  const todayKey = new Date().toISOString().split('T')[0];
  const todayDone = !!data[todayKey];
  const todayMood = getMood(todayKey);

  const handleTick = (dateKey) => {
    const wasUnchecked = !data[dateKey];
    toggle(dateKey);
    if (wasUnchecked && !hasMilestone('daily_check', { date: dateKey })) {
      addXp(XP_REWARDS.daily_check, 'daily_check', { date: dateKey });
    }
  };

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

        {/* Today's habits quick-tick */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <div className="dash-card-title">⚡ Hôm Nay — {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
            {activeHabits.map(habit => {
              const doneToday = !!data[`${todayKey}_${habit.id}`] || (activeHabits.length === 1 && todayDone);
              return (
                <div key={habit.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem', background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${doneToday ? habit.color + '55' : 'rgba(255,255,255,0.07)'}`,
                  borderLeft: `3px solid ${habit.color}`,
                  borderRadius: 'var(--radius-md)', transition: 'var(--transition-base)',
                }}>
                  <span style={{ fontSize: '1.4rem' }}>{habit.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{habit.name}</div>
                    {habit.timeTarget && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ⏰ {habit.timeTarget} · ⏱ {habit.durationMin}p
                      </div>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    className="habit-checkbox"
                    checked={doneToday}
                    onChange={() => handleTick(todayKey)}
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
                onClick={() => saveMood(m)}
                id={`mood-${m.label}`}
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: 'var(--radius-full)',
                  background: (todayMood?.label || mood?.label) === m.label
                    ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${(todayMood?.label || mood?.label) === m.label
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
    </div>
  );
}

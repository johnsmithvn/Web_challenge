import { useState } from 'react';
import { useFocusTimer } from '../hooks/useFocusTimer';
import { useCustomHabits } from '../hooks/useCustomHabits';
import '../styles/focus.css';

const PHASE_LABELS = {
  work:        { label: '🎯 Tập Trung',  color: 'var(--purple)' },
  short_break: { label: '☕ Nghỉ Ngắn',  color: 'var(--cyan)' },
  long_break:  { label: '🌿 Nghỉ Dài',  color: 'var(--green)' },
};

export default function FocusTimer({ defaultHabitId }) {
  const {
    phase, running, mins, secs, pct, session,
    settings, todaySessions, todayMinutes,
    habitId, start, pause, reset, skip,
    updateSettings, linkHabit,
  } = useFocusTimer();

  const { activeHabits } = useCustomHabits();
  const [showSettings,   setShowSettings]   = useState(false);
  const [showHabitPick,  setShowHabitPick]  = useState(false);
  const [ws, setWs] = useState(settings.workMin);
  const [sb, setSb] = useState(settings.shortBreakMin);
  const [lb, setLb] = useState(settings.longBreakMin);

  const phaseInfo    = PHASE_LABELS[phase];
  const circumference = 2 * Math.PI * 54; // radius 54
  const dashOffset    = circumference - (pct / 100) * circumference;
  const linkedHabit   = activeHabits.find(h => h.id === (habitId || defaultHabitId));

  return (
    <div className="focus-timer card" id="focus-timer">
      <div className="focus-timer__header">
        <div className="section-label" style={{ margin: 0 }}>⏱ Focus Timer</div>
        <button
          className="btn btn-ghost"
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
          onClick={() => setShowSettings(v => !v)}
          id="focus-settings-btn"
        >
          ⚙️ Cài đặt
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="focus-settings">
          <div className="focus-settings__row">
            <label>🎯 Tập trung</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="range" min={5} max={60} step={5} value={ws}
                onChange={e => setWs(+e.target.value)} className="focus-range" />
              <span className="focus-settings__val">{ws}p</span>
            </div>
          </div>
          <div className="focus-settings__row">
            <label>☕ Nghỉ ngắn</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="range" min={1} max={15} step={1} value={sb}
                onChange={e => setSb(+e.target.value)} className="focus-range" />
              <span className="focus-settings__val">{sb}p</span>
            </div>
          </div>
          <div className="focus-settings__row">
            <label>🌿 Nghỉ dài</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="range" min={5} max={30} step={5} value={lb}
                onChange={e => setLb(+e.target.value)} className="focus-range" />
              <span className="focus-settings__val">{lb}p</span>
            </div>
          </div>
          <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            onClick={() => { updateSettings({ workMin: ws, shortBreakMin: sb, longBreakMin: lb }); setShowSettings(false); }}>
            Lưu
          </button>
        </div>
      )}

      {/* Link habit — custom pill picker */}
      <div className="focus-habit-link">
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>Gắn habit:</span>
        <div style={{ position: 'relative', flex: 1 }}>
          {/* Trigger button */}
          <button
            className="focus-habit-trigger"
            onClick={() => setShowHabitPick(v => !v)}
            id="focus-habit-select"
            style={{ borderColor: linkedHabit ? linkedHabit.color + '88' : 'rgba(255,255,255,0.1)' }}
          >
            {linkedHabit
              ? <><span>{linkedHabit.icon}</span><span style={{ flex: 1 }}>{linkedHabit.name}</span>
                 <span style={{ width: 8, height: 8, borderRadius: '50%', background: linkedHabit.color, flexShrink: 0 }} /></>
              : <><span style={{ color: 'var(--text-muted)' }}>— Không gắn —</span><span style={{ marginLeft: 'auto' }}>▾</span></>
            }
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.7rem' }}>▾</span>
          </button>

          {/* Dropdown panel */}
          {showHabitPick && (
            <div className="focus-habit-dropdown">
              <button
                className={`focus-habit-option ${!habitId ? 'focus-habit-option--active' : ''}`}
                onClick={() => { linkHabit(null); setShowHabitPick(false); }}
                id="focus-habit-none"
              >
                <span className="focus-habit-option__icon">○</span>
                <span>Không gắn</span>
              </button>
              {activeHabits.map(h => (
                <button
                  key={h.id}
                  className={`focus-habit-option ${habitId === h.id ? 'focus-habit-option--active' : ''}`}
                  onClick={() => { linkHabit(h.id); setShowHabitPick(false); }}
                  id={`focus-habit-opt-${h.id}`}
                  style={{ '--opt-color': h.color }}
                >
                  <span className="focus-habit-option__icon" style={{ background: h.color + '22' }}>{h.icon}</span>
                  <span style={{ flex: 1 }}>{h.name}</span>
                  {h.timeTarget && <span className="focus-habit-option__time">⏰ {h.timeTarget}</span>}
                  {habitId === h.id && <span style={{ color: h.color }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Phase badge */}
      <div className="focus-phase-badge" style={{ color: phaseInfo.color }}>
        {phaseInfo.label}
      </div>

      {/* Circle timer */}
      <div className="focus-ring-wrap">
        <svg className="focus-ring" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" className="focus-ring__track" />
          <circle
            cx="60" cy="60" r="54"
            className="focus-ring__fill"
            style={{
              stroke: phaseInfo.color,
              strokeDasharray: circumference,
              strokeDashoffset: dashOffset,
            }}
          />
        </svg>
        <div className="focus-ring__time">
          <span className="focus-time">{mins}:{secs}</span>
          <span className="focus-time-label">{phase === 'work' ? 'Focus' : 'Break'}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="focus-controls">
        {!running
          ? <button className="btn btn-primary focus-btn" onClick={start} id="focus-start">▶ Bắt Đầu</button>
          : <button className="btn btn-ghost   focus-btn" onClick={pause} id="focus-pause">⏸ Tạm Dừng</button>
        }
        <button className="btn btn-ghost focus-btn-sm" onClick={reset} id="focus-reset" title="Reset">⟳</button>
        <button className="btn btn-ghost focus-btn-sm" onClick={skip}  id="focus-skip"  title="Skip">⏭</button>
      </div>

      {/* Today stats */}
      <div className="focus-today-stats">
        <div className="focus-stat">
          <span className="focus-stat__val">{session}</span>
          <span className="focus-stat__label">Sessions</span>
        </div>
        <div className="focus-stat">
          <span className="focus-stat__val">{todayMinutes}</span>
          <span className="focus-stat__label">Phút hôm nay</span>
        </div>
        <div className="focus-stat">
          <span className="focus-stat__val">
            {linkedHabit ? `${linkedHabit.icon} ${linkedHabit.name}` : '—'}
          </span>
          <span className="focus-stat__label">Habit</span>
        </div>
      </div>
    </div>
  );
}

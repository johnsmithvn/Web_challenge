import { useState } from 'react';
import { useFocusTimer } from '../hooks/useFocusTimer';
import AppIcon from './AppIcon';
import '../styles/focus.css';

const PHASE_LABELS = {
  work:        { label: 'Tập Trung', icon: 'trend', color: 'var(--purple)' },
  short_break: { label: 'Nghỉ Ngắn', icon: 'coffee', color: 'var(--cyan)' },
  long_break:  { label: 'Nghỉ Dài', icon: 'tree', color: 'var(--green)' },
};

export default function FocusTimer() {
  const {
    phase, running, mins, secs, pct, session,
    settings, todayMinutes,
    start, pause, reset, skip,
    updateSettings,
  } = useFocusTimer();

  const [showSettings, setShowSettings] = useState(false);
  const [ws, setWs] = useState(settings.workMin);
  const [sb, setSb] = useState(settings.shortBreakMin);
  const [lb, setLb] = useState(settings.longBreakMin);

  const phaseInfo    = PHASE_LABELS[phase];
  const circumference = 2 * Math.PI * 54; // radius 54
  const dashOffset    = circumference - (pct / 100) * circumference;

  return (
    <div className="focus-timer card" id="focus-timer">
      <div className="focus-timer__header">
        <div className="section-label" style={{ margin: 0 }}><AppIcon name="timer" size={15} /> Focus Timer</div>
        <button
          className="btn btn-ghost"
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
          onClick={() => setShowSettings(v => !v)}
          id="focus-settings-btn"
        >
          <AppIcon name="gear" size={15} /> Cài đặt
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="focus-settings">
          <div className="focus-settings__row">
            <label><AppIcon name="trend" size={14} /> Tập trung</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="range" min={5} max={60} step={5} value={ws}
                onChange={e => setWs(+e.target.value)} className="focus-range" />
              <span className="focus-settings__val">{ws}p</span>
            </div>
          </div>
          <div className="focus-settings__row">
            <label><AppIcon name="coffee" size={14} /> Nghỉ ngắn</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="range" min={1} max={15} step={1} value={sb}
                onChange={e => setSb(+e.target.value)} className="focus-range" />
              <span className="focus-settings__val">{sb}p</span>
            </div>
          </div>
          <div className="focus-settings__row">
            <label><AppIcon name="tree" size={14} /> Nghỉ dài</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="range" min={5} max={30} step={5} value={lb}
                onChange={e => setLb(+e.target.value)} className="focus-range" />
              <span className="focus-settings__val">{lb}p</span>
            </div>
          </div>
          <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            onClick={() => { updateSettings({ workMin: ws, shortBreakMin: sb, longBreakMin: lb }); setShowSettings(false); }}>
            <AppIcon name="save" size={14} /> Lưu
          </button>
        </div>
      )}

      {/* Phase badge */}
      <div className="focus-phase-badge" style={{ color: phaseInfo.color }}>
        <AppIcon name={phaseInfo.icon} size={15} /> {phaseInfo.label}
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
          ? <button className="btn btn-primary focus-btn" onClick={start} id="focus-start"><AppIcon name="play" size={16} weight="fill" /> Bắt Đầu</button>
          : <button className="btn btn-ghost   focus-btn" onClick={pause} id="focus-pause"><AppIcon name="pause" size={16} weight="fill" /> Tạm Dừng</button>
        }
        <button className="btn btn-ghost focus-btn-sm" onClick={reset} id="focus-reset" title="Reset" aria-label="Reset"><AppIcon name="refresh" size={17} /></button>
        <button className="btn btn-ghost focus-btn-sm" onClick={skip}  id="focus-skip"  title="Skip" aria-label="Bỏ qua"><AppIcon name="skip" size={17} /></button>
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
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHabitStore } from '../hooks/useHabitStore';
import { useCustomHabits } from '../hooks/useCustomHabits';
import { useXpStore, XP_REWARDS } from '../hooks/useXpStore';
import { useNotifications } from '../hooks/useNotifications';
import { useTeam } from '../hooks/useTeam';
import { useMoodLog } from '../hooks/useMoodSkip';
import DailyChallenge from '../components/DailyChallenge';
import XpBar from '../components/XpBar';
import NotificationSettings from '../components/NotificationSettings';
import '../styles/tracker.css';
import '../styles/xpbar.css';
import '../styles/calendar.css';

/* ── Plant levels based on streak ──────────────────────── */
const PLANT_STAGES = [
  { min: 0,  emoji: '🌰', label: 'Hạt giống', color: '#94a3b8' },
  { min: 1,  emoji: '🌱', label: 'Mầm',       color: '#4ade80' },
  { min: 3,  emoji: '🪴', label: 'Cây nhỏ',   color: '#22c55e' },
  { min: 7,  emoji: '🌿', label: 'Cây xanh',  color: '#16a34a' },
  { min: 14, emoji: '🌳', label: 'Cây lớn',   color: '#15803d' },
  { min: 21, emoji: '🏆', label: 'Hoàn Thành',color: '#fbbf24' },
];

function getPlant(streak) {
  return [...PLANT_STAGES].reverse().find(s => streak >= s.min) || PLANT_STAGES[0];
}

const MOODS = [
  { emoji: '😴', label: 'Kiệt sức' },
  { emoji: '😔', label: 'Thấp' },
  { emoji: '😐', label: 'Bình thường' },
  { emoji: '😊', label: 'Tốt' },
  { emoji: '💪', label: 'Tuyệt vời' },
];

/* ── 21-day dots in 3 rows of 7 ────────────────────────── */
function WeekDots({ data }) {
  const today = new Date().toISOString().split('T')[0];
  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (20 - i));
    const key = d.toISOString().split('T')[0];
    return { key, done: !!data[key], isToday: key === today, isFuture: key > today };
  });

  // Group into 3 weeks
  const weeks = [days.slice(0, 7), days.slice(7, 14), days.slice(14, 21)];
  const weekLabels = ['Tuần 1', 'Tuần 2', 'Tuần 3'];

  return (
    <div className="week-dots-wrap">
      {weeks.map((week, wi) => (
        <div key={wi} className="week-dots-row">
          <span className="week-dots-label">{weekLabels[wi]}</span>
          <div className="week-dots-cells">
            {week.map((day, di) => (
              <div
                key={di}
                className={[
                  'week-dot',
                  day.done    ? 'week-dot--done'    : '',
                  day.isToday ? 'week-dot--today'   : '',
                  day.isFuture? 'week-dot--future'  : '',
                ].join(' ')}
                title={day.key}
              >
                {day.done && <span className="week-dot__check">✓</span>}
                {day.isToday && !day.done && <span className="week-dot__pulse" />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Streak Ring ────────────────────────────────────────── */
function StreakRing({ streak, target = 21 }) {
  const plant  = getPlant(streak);
  const pct    = Math.min(streak / target, 1);
  const r      = 52;
  const circ   = 2 * Math.PI * r;
  const offset = circ - pct * circ;

  return (
    <div className="streak-ring-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* Track */}
        <circle cx="70" cy="70" r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        {/* Fill */}
        <circle cx="70" cy="70" r={r} fill="none"
          stroke={plant.color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="streak-ring-center">
        <span className="streak-ring-plant">{plant.emoji}</span>
        <span className="streak-ring-num" style={{ color: plant.color }}>{streak}</span>
        <span className="streak-ring-label">ngày</span>
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────── */
export default function TrackerPage() {
  const {
    data, toggle, weekDates, streak, longestStreak,
    totalDone, completionPct, badge, todayDone
  } = useHabitStore();
  const { activeHabits } = useCustomHabits();
  const { addXp, hasMilestone } = useXpStore();
  const { scheduleTodayReminder } = useNotifications();
  const { saveMood, getMood } = useMoodLog();

  const { team } = useTeam();

  const [tickAnim, setTickAnim] = useState(false);

  const todayKey  = new Date().toISOString().split('T')[0];
  const plant     = getPlant(streak);
  const todayMood = getMood(todayKey);

  // XP milestones
  useEffect(() => {
    if (streak >= 3  && !hasMilestone('streak_3'))  addXp(XP_REWARDS.streak_3,  'streak_3',  {});
    if (streak >= 10 && !hasMilestone('streak_10')) addXp(XP_REWARDS.streak_10, 'streak_10', {});
    if (streak >= 21 && !hasMilestone('streak_21')) addXp(XP_REWARDS.streak_21, 'streak_21', {});
  }, [streak]);

  useEffect(() => {
    const cleanup = scheduleTodayReminder(todayDone);
    return cleanup;
  }, [todayDone]);

  const handleMainTick = () => {
    toggle(todayKey);
    if (!todayDone) {
      setTickAnim(true);
      setTimeout(() => setTickAnim(false), 600);
      if (!hasMilestone('daily_check', { date: todayKey }))
        addXp(XP_REWARDS.daily_check, 'daily_check', { date: todayKey });
    }
  };

  return (
    <div className="tracker-v2-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="tracker-v2-header">
          <div>
            <div className="section-label">🗓 Kỷ Luật</div>
            <h1 className="display-2">Tracker <span className="gradient-text">21 Ngày</span></h1>
          </div>
          <Link to="/habits" className="btn btn-ghost" style={{ fontSize: '0.85rem' }}>
            📋 Xem Calendar →
          </Link>
        </div>

        {/* ── XP Bar ── */}
        <XpBar />

        {/* ── Hero tick area ── */}
        <div className="tracker-hero card">
          {/* Streak ring */}
          <div className="tracker-hero__left">
            <StreakRing streak={streak} />
            <div className="tracker-hero__plant-label" style={{ color: plant.color }}>
              {plant.label}
            </div>
          </div>

          {/* Big tick button */}
          <div className="tracker-hero__center">
            <button
              onClick={handleMainTick}
              className={`tick-btn ${todayDone ? 'tick-btn--done' : 'tick-btn--idle'} ${tickAnim ? 'tick-btn--pop' : ''}`}
              id="main-tick-btn"
              aria-label="Tick hôm nay"
            >
              <span className="tick-btn__icon">{todayDone ? '✅' : '⭕'}</span>
              <span className="tick-btn__label">
                {todayDone ? 'Hôm nay ✓' : 'Tick Hôm Nay!'}
              </span>
            </button>
            <div className="tick-date">
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>

          {/* Stats column */}
          <div className="tracker-hero__right">
            <div className="tracker-hero-stat">
              <span className="tracker-hero-stat__val" style={{ color: 'var(--gold)' }}>{longestStreak}</span>
              <span className="tracker-hero-stat__label">Best Streak</span>
            </div>
            <div className="tracker-hero-stat">
              <span className="tracker-hero-stat__val" style={{ color: 'var(--green)' }}>{totalDone}</span>
              <span className="tracker-hero-stat__label">Tổng ngày</span>
            </div>
            <div className="tracker-hero-stat">
              <span className="tracker-hero-stat__val" style={{ color: 'var(--cyan)' }}>{completionPct}%</span>
              <span className="tracker-hero-stat__label">Tuần này</span>
            </div>
          </div>
        </div>

        {/* ── 21-day visual progress ── */}
        <div className="card tracker-dots-card">
          <div className="dash-card-title">📍 Tiến Độ 21 Ngày</div>
          <WeekDots data={data} />
          <div className="progress-bar-track" style={{ marginTop: '1rem' }}>
            <div className="progress-bar-fill" style={{ width: `${Math.round((streak / 21) * 100)}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            <span>Ngày 1</span>
            <span style={{ color: plant.color, fontWeight: 700 }}>{streak}/21 ngày</span>
            <span>Ngày 21</span>
          </div>
        </div>

        {/* ── Today's habits quick-tick (if custom) ── */}
        {activeHabits.length > 0 && (
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="dash-card-title" style={{ marginBottom: '0.75rem' }}>
              ⚡ Habits Hôm Nay
              <Link to="/habits" style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                Xem tất cả →
              </Link>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {activeHabits.slice(0, 4).map(h => {
                const prog = JSON.parse(localStorage.getItem('vl_habit_progress') || '{}');
                const done = !!prog[`${todayKey}_${h.id}`];
                return (
                  <div key={h.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    background: done ? `${h.color}22` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${done ? h.color + '55' : 'rgba(255,255,255,0.08)'}`,
                    fontSize: '0.85rem', color: done ? h.color : 'var(--text-secondary)',
                  }}>
                    <span>{h.icon}</span>
                    <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{h.name}</span>
                    {done && <span>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Mood ── */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="dash-card-title" style={{ marginBottom: '0.75rem' }}>😊 Tâm Trạng</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {MOODS.map(m => (
              <button key={m.label} onClick={() => saveMood(todayKey, m)} id={`mood-t-${m.label}`}
                style={{
                  padding: '0.4rem 0.85rem', borderRadius: 'var(--radius-full)',
                  fontSize: '0.88rem', cursor: 'pointer',
                  background: todayMood?.label === m.label ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${todayMood?.label === m.label ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: 'var(--text-secondary)', transition: 'var(--transition-base)',
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}>
                <span>{m.emoji}</span> {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Daily Challenge ── */}
        <DailyChallenge />

        {/* ── Insight ── */}
        <div className="card" style={{ marginTop: '1.25rem', padding: '1.25rem' }}>
          <div className="dash-card-title">💡 Nhận Xét</div>
          <div className="dash-insight" style={{ marginTop: '0.75rem' }}>
            {streak === 0 && 'Bắt đầu hôm nay! Streak đầu tiên luôn là khó nhất — nhưng sau ngày 1, mọi thứ dễ hơn.'}
            {streak > 0 && streak < 3  && `🔥 Streak ${streak} ngày! Chỉ cần ${3 - streak} ngày nữa để nhận badge Lấy Đà + 50 XP.`}
            {streak >= 3 && streak < 10 && `🟢 Bạn đang có đà! Tiếp tục ${10 - streak} ngày nữa để đạt Bứt Phá + 100 XP.`}
            {streak >= 10 && streak < 21 && `🟡 Ấn tượng! Chỉ còn ${21 - streak} ngày nữa để Hoàn Thành + 200 XP!`}
            {streak >= 21 && '🏆 XUẤT SẮC! 21 ngày hoàn thành! Kỷ luật đã trở thành bản năng.'}
          </div>
        </div>

        {/* ── Notification settings ── */}
        <div style={{ marginTop: '1.25rem' }}>
          <NotificationSettings />
        </div>

      </div>
    </div>
  );
}

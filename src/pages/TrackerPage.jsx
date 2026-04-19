import { useEffect, useState, lazy, Suspense, memo } from 'react';
import { Link } from 'react-router-dom';
import { useHabitStore } from '../hooks/useHabitStore';
import { useCustomHabits } from '../hooks/useCustomHabits';
import { useXpStore, XP_REWARDS } from '../hooks/useXpStore';
import { useNotifications } from '../hooks/useNotifications';
import { useTeam } from '../hooks/useTeam';
import { useMoodLog, useSkipReasons } from '../hooks/useMoodSkip';
import { useJourney } from '../hooks/useJourney';
import { useHabitLogs } from '../hooks/useHabitLogs';
import { useAuth } from '../contexts/AuthContext';
import DailyChallenge from '../components/DailyChallenge';
import XpBar from '../components/XpBar';
import NotificationSettings from '../components/NotificationSettings';
import CompletionModal from '../components/CompletionModal';
import LoginNudgeModal from '../components/LoginNudgeModal';
import '../styles/tracker.css';
import '../styles/xpbar.css';
import '../styles/calendar.css';
import '../styles/completion.css';
import '../styles/journey.css';

import HABITS_DATA from '../data/habits.json';
import QUOTES_DATA from '../data/quotes.json';

const SKIP_REASONS = HABITS_DATA.skipReasons;
const MOODS = HABITS_DATA.moods;
const DAILY_QUOTES = QUOTES_DATA.dailyQuotes;

// ── Lazy tab content (performance: only load when tab is active) ──
// lazyRetry: auto-reload on chunk load failure (stale deployment cache)
const lazyRetry = (fn) => lazy(() => fn().catch(() => {
  if (!sessionStorage.getItem('vl_chunk_retry')) {
    sessionStorage.setItem('vl_chunk_retry', '1');
    window.location.reload();
  }
  return fn(); // re-throw if already retried
}));
const MonthCalendar      = lazyRetry(() => import('../components/MonthCalendar'));
const HabitManager       = lazyRetry(() => import('../components/HabitManager'));

function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

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

/* ── Per-habit consecutive streak from today ───────────── */
function computeHabitStreak(habitId, habitProg) {
  let count = 0;
  const today = new Date();
  while (true) {
    const key = new Date(today.getFullYear(), today.getMonth(), today.getDate() - count)
      .toISOString().split('T')[0];
    if (habitProg[`${key}_${habitId}`]) count++;
    else break;
    if (count > 365) break;
  }
  return count;
}

/* ── Daily completion % across ALL habits for a given day ── */
function dayPct(dateKey, activeHabits, habitProg) {
  if (!activeHabits.length) return 0;
  const done = activeHabits.filter(h => !!habitProg[`${dateKey}_${h.id}`]).length;
  return Math.round((done / activeHabits.length) * 100);
}

/* ── 21-day dots ──────────────────────────────────────── */
function WeekDots({ data, journeyStart }) {
  const today = new Date().toISOString().split('T')[0];
  const checkedDates = Object.keys(data).filter(k => data[k]).sort();
  const startStr     = journeyStart || checkedDates[0] || today;
  const startDate    = new Date(startStr);

  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = d.toISOString().split('T')[0];
    return { key, dayNum: i + 1, done: !!data[key], isToday: key === today, isFuture: key > today };
  });

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
                  day.done    ? 'week-dot--done'   : '',
                  day.isToday ? 'week-dot--today'  : '',
                  day.isFuture? 'week-dot--future' : '',
                ].join(' ')}
                title={`Ngày ${day.dayNum} · ${day.key}`}
              >
                {day.done    && <span className="week-dot__check">✓</span>}
                {day.isToday && !day.done && <span className="week-dot__pulse" />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Streak Ring ──────────────────────────────────────── */
function StreakRing({ streak, target = 21 }) {
  const plant  = getPlant(streak);
  const pct    = Math.min(streak / target, 1);
  const r      = 52;
  const circ   = 2 * Math.PI * r;
  const offset = circ - pct * circ;

  return (
    <div className="streak-ring-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
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

/* ── Per-habit weekly grid (14 days) — memoized ──────── */
const PerHabitWeeklyGrid = memo(function PerHabitWeeklyGrid({ habitProg, activeHabits }) {
  const today    = new Date();
  const todayKey = today.toISOString().split('T')[0];

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    const key = d.toISOString().split('T')[0];
    return {
      key,
      label:   d.toLocaleDateString('vi-VN', { weekday: 'narrow' }),
      dayNum:  d.getDate(),
      isToday: key === todayKey,
      isFuture: key > todayKey,
    };
  });

  const week1 = days.slice(0, 7);
  const week2 = days.slice(7, 14);

  const cellStyle = (done, isToday, isFuture, color, pct) => ({
    width: 32, height: 32, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
    position: 'relative', overflow: 'hidden',
    background: done
      ? `${color}44`
      : isFuture
        ? 'rgba(255,255,255,0.02)'
        : pct > 0
          ? `${color}${Math.round(pct / 100 * 30).toString(16).padStart(2,'0')}`
          : 'rgba(255,255,255,0.03)',
    border: `1px solid ${done ? color + '88' : isToday ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
    color: done ? color : isToday ? 'var(--text-secondary)' : 'var(--text-muted)',
    boxShadow: isToday ? `0 0 0 2px ${color}44` : 'none',
    transition: 'all 0.15s ease',
  });

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div className="dash-card-title" style={{ marginBottom: '0.25rem' }}>📊 Theo Dõi Từng Thói Quen</div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>14 ngày gần nhất · lịch đầy đủ ở tab 📅</p>

      {activeHabits.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chưa có habit nào.</p>
      )}

      {activeHabits.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', paddingLeft: 70 }}>
          {days.map(day => {
            const pct = dayPct(day.key, activeHabits, habitProg);
            return (
              <div key={day.key}
                title={`${day.label} ${day.dayNum}: ${pct}% toàn bộ habits`}
                style={{
                  width: 32, flexShrink: 0, textAlign: 'center',
                  fontSize: '0.6rem', color: day.isToday ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: day.isToday ? 700 : 400,
                }}>
                <div>{day.label}</div>
                <div style={{ fontWeight: 700, fontSize: '0.58rem', color: pct === 100 ? 'var(--green)' : pct > 0 ? '#f97316' : 'var(--text-muted)' }}>
                  {day.isFuture ? '' : `${pct}%`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeHabits.map(habit => {
        const week1Done = week1.filter(d => !!habitProg[`${d.key}_${habit.id}`]).length;
        const week2Done = week2.filter(d => !!habitProg[`${d.key}_${habit.id}`]).length;
        const totalDone = week1Done + week2Done;
        const pct14     = Math.round((totalDone / 14) * 100);
        const hStreak   = computeHabitStreak(habit.id, habitProg);

        return (
          <div key={habit.id} style={{ marginBottom: '1.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1rem' }}>{habit.icon}</span>
              <span style={{ fontWeight: 600, fontSize: '0.82rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {habit.action && habit.action !== habit.name ? habit.action : habit.name}
              </span>
              {hStreak > 0 && (
                <span title={`Chuỗi liên tục: ${hStreak} ngày`}
                  style={{ fontSize: '0.72rem', fontWeight: 700, color: hStreak >= 7 ? '#f97316' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  🔥{hStreak}
                </span>
              )}
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.45rem',
                borderRadius: 99, background: `${habit.color}22`, color: habit.color, whiteSpace: 'nowrap',
              }}>
                {totalDone}/14 · {pct14}%
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>
                T.trước&nbsp;&nbsp;T.này
              </span>
              {days.map(day => {
                const done   = !!habitProg[`${day.key}_${habit.id}`];
                const pctDay = dayPct(day.key, activeHabits, habitProg);
                return (
                  <div key={day.key}
                    title={`${day.label} ${day.dayNum}: ${done ? '✓ Hoàn thành' : day.isFuture ? 'Chưa đến' : `${pctDay}% toàn bộ ngày`}`}
                    style={cellStyle(done, day.isToday, day.isFuture, habit.color, pctDay)}>
                    {done ? '✓' : day.isFuture ? '' : pctDay > 0 ? <span style={{ opacity: 0.5, fontSize: '0.6rem' }}>{pctDay}%</span> : <span style={{ opacity: 0.2 }}>·</span>}
                  </div>
                );
              })}
            </div>

            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, marginTop: '0.4rem', marginLeft: 70 }}>
              <div style={{ height: '100%', width: `${pct14}%`, background: habit.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
});


/* ══════════════════════════════════════════════════════════
   Main TrackerPage — consolidated from TrackerPage + HabitsPage
   ══════════════════════════════════════════════════════════ */
export default function TrackerPage() {
  const {
    data, toggle, weekDates, streak, longestStreak,
    totalDone, completionPct, badge, todayDone
  } = useHabitStore();
  const { activeHabits, conqueredHabits, conquestHabit, renewHabit } = useCustomHabits();
  const { addXp, hasMilestone, totalXp } = useXpStore();
  const { scheduleTodayReminder } = useNotifications();
  const { saveMood, getMood } = useMoodLog();
  const { saveSkip } = useSkipReasons();
  const { activeJourney } = useJourney();
  const { habitProg, toggleLog } = useHabitLogs();
  const { isAuthenticated } = useAuth();
  const { team } = useTeam();

  const [tab, setTab] = useState('today');

  const [celebration, setCelebration] = useState(false);
  const [skipModal, setSkipModal]   = useState(null);
  const [skipReason, setSkipReason] = useState('');
  const [skipNote, setSkipNote]     = useState('');

  // Login nudge
  const NUDGE_KEY = 'vl_login_nudge_shown';
  const [showNudge, setShowNudge] = useState(false);

  // Completion modal
  const COMPLETION_KEY = `vl_completion_shown_${streak >= 21 ? Math.floor(streak / 21) : 0}`;
  const [showCompletion, setShowCompletion] = useState(() =>
    streak >= 21 && !localStorage.getItem(COMPLETION_KEY)
  );

  const dismissCompletion = () => {
    localStorage.setItem(COMPLETION_KEY, '1');
    setShowCompletion(false);
  };

  const handleRenew = () => {
    localStorage.setItem(COMPLETION_KEY, '1');
    setShowCompletion(false);
    activeHabits.forEach(h => renewHabit(h.id));
    window.location.reload();
  };

  const handleNewChallenge = () => {
    localStorage.setItem(COMPLETION_KEY, '1');
    setShowCompletion(false);
    activeHabits.forEach(h => conquestHabit(h.id));
    window.location.reload();
  };

  const todayKey  = new Date().toISOString().split('T')[0];
  const plant     = getPlant(streak);
  const todayMood = getMood(todayKey);

  // Per-habit tick
  const handleHabitTick = async (habit) => {
    const key     = `${todayKey}_${habit.id}`;
    const wasDone = !!habitProg[key];

    await toggleLog(habit.id, todayKey);

    if (!wasDone && !hasMilestone('habit_tick', { habitId: habit.id, date: todayKey })) {
      addXp(XP_REWARDS.daily_check, 'habit_tick', { habitId: habit.id, date: todayKey });
    }

    const nextDone = !wasDone;
    const allDone = activeHabits.every(h =>
      h.id === habit.id ? nextDone : !!habitProg[`${todayKey}_${h.id}`]
    );
    if (allDone && !data[todayKey]) {
      toggle(todayKey);
      setCelebration(true);
      if (!isAuthenticated && totalDone === 0 && !localStorage.getItem(NUDGE_KEY)) {
        setTimeout(() => setShowNudge(true), 1500);
      }
    } else if (!allDone && data[todayKey]) {
      toggle(todayKey);
      setCelebration(false);
    }
  };

  // Auto-dismiss celebration
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(false), 4000);
    return () => clearTimeout(t);
  }, [celebration]);

  const allHabitsDone = activeHabits.length > 0
    ? activeHabits.every(h => !!habitProg[`${todayKey}_${h.id}`])
    : !!data[todayKey];

  // XP milestones
  useEffect(() => {
    if (streak >= 3  && !hasMilestone('streak_3'))  addXp(XP_REWARDS.streak_3,  'streak_3',  {});
    if (streak >= 10 && !hasMilestone('streak_10')) addXp(XP_REWARDS.streak_10, 'streak_10', {});
    if (streak >= 21 && !hasMilestone('streak_21')) addXp(XP_REWARDS.streak_21, 'streak_21', {});
  }, [streak]);

  useEffect(() => {
    const cleanup = scheduleTodayReminder(allHabitsDone);
    return cleanup;
  }, [allHabitsDone]);



  const handleMood = (m) => saveMood(todayKey, m);

  const handleSkipSubmit = () => {
    saveSkip(skipModal, skipReason, skipNote);
    setSkipModal(null); setSkipReason(''); setSkipNote('');
  };

  // ── Tab definitions ──────────────────────────────────────
  const TABS = [
    { key: 'today',    label: '⚡ Hôm Nay' },
    { key: 'calendar', label: '📅 Lịch' },
    { key: 'weekly',   label: '📊 Tuần' },
    { key: 'manage',   label: '⚙️ Quản Lý' },
  ];

  return (
    <div className="tracker-v2-page">
      {showCompletion && (
        <CompletionModal
          streak={streak}
          totalXp={totalXp}
          onRenew={handleRenew}
          onNewChallenge={handleNewChallenge}
          onClose={dismissCompletion}
        />
      )}
      <div className="container">

        {/* ── Header ── */}
        <div className="tracker-v2-header">
          <div>
            <div className="section-label">🗓 Kỷ Luật</div>
            <h1 className="display-2">Tracker <span className="gradient-text">21 Ngày</span></h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div className="tracker-stat-card card" style={{ flex: '0 0 auto', padding: '0.5rem 0.85rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🔥</span>
              <span className="gradient-text" style={{ fontWeight: 800, fontSize: '1.2rem' }}>{streak}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Streak</span>
            </div>
            <div className="tracker-stat-card card" style={{ flex: '0 0 auto', padding: '0.5rem 0.85rem' }}>
              <span style={{ fontSize: '1.2rem' }}>📅</span>
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--green)' }}>{totalDone}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tổng</span>
            </div>
            <div className="tracker-stat-card card" style={{ flex: '0 0 auto', padding: '0.5rem 0.85rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🎯</span>
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{activeHabits.length}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Habits</span>
            </div>
          </div>
        </div>

        {/* ── XP Bar ── */}
        <XpBar />

        {/* ── Hero status area (auto-derived from habit ticks) ── */}
        <div className="tracker-hero card">
          <div className="tracker-hero__left">
            <StreakRing streak={streak} />
            <div className="tracker-hero__plant-label" style={{ color: plant.color }}>
              {plant.label}
            </div>
          </div>
          <div className="tracker-hero__center">
            <div className={`tick-btn ${allHabitsDone ? 'tick-btn--done' : 'tick-btn--idle'}`}
              style={{ cursor: 'default' }}
              id="main-status-indicator"
            >
              <span className="tick-btn__icon">{allHabitsDone ? '✅' : '⭕'}</span>
              <span className="tick-btn__label">
                {activeHabits.length === 0
                  ? 'Chưa có habit'
                  : allHabitsDone
                    ? 'Hoàn thành! 🎉'
                    : `${activeHabits.filter(h => !!habitProg[`${todayKey}_${h.id}`]).length}/${activeHabits.length} habits`}
              </span>
            </div>
            <div className="tick-date">
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
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
          <WeekDots data={data} journeyStart={activeJourney?.started_at || null} />
          <div className="progress-bar-track" style={{ marginTop: '1rem' }}>
            <div className="progress-bar-fill" style={{ width: `${Math.round((streak / 21) * 100)}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            <span>Ngày 1</span>
            <span style={{ color: plant.color, fontWeight: 700 }}>{streak}/21 ngày</span>
            <span>Ngày 21</span>
          </div>
        </div>

        {/* ── Journey Banner ── */}
        {(() => {
          if (!activeJourney) {
            return isAuthenticated ? (
              <div className="habits-journey-banner" style={{ marginBottom: '1.25rem' }}>
                <span className="banner-icon">🗺</span>
                <span className="banner-text">
                  Chưa có lộ trình đang chạy
                  <span className="banner-sub">— Chọn một lộ trình để track có mục tiêu hơn</span>
                </span>
                <Link to="/journey" className="banner-link">Chọn lộ trình →</Link>
              </div>
            ) : null;
          }
          const start = new Date(activeJourney.started_at);
          const today2 = new Date();
          const currentDay = Math.min(
            Math.floor((today2 - start) / 86400000) + 1,
            activeJourney.target_days || 21
          );
          return (
            <div className="habits-journey-banner" style={{ marginBottom: '1.25rem' }}>
              <span className="banner-icon">🗺</span>
              <span className="banner-text">
                {activeJourney.title}
                <span className="banner-sub">— Ngày {currentDay}/{activeJourney.target_days || 21}</span>
              </span>
              <Link to="/journey" className="banner-link">Xem lộ trình →</Link>
            </div>
          );
        })()}

        {/* ── Daily quote ── */}
        {(() => {
          const q = getDailyQuote();
          return (
            <div style={{
              padding: '0.9rem 1.25rem', marginBottom: '1.25rem',
              background: 'rgba(139,92,246,0.06)',
              border: '1px solid rgba(139,92,246,0.15)',
              borderLeft: '3px solid rgba(139,92,246,0.5)',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
            }}>
              <span style={{ fontSize: '1.1rem', opacity: 0.6, flexShrink: 0, marginTop: '0.05rem' }}>"</span>
              <div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.55, margin: 0 }}>
                  {q.text}
                </p>
                {q.author && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontWeight: 600 }}>
                    — {q.author}
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Celebration banner ── */}
        {celebration && (
          <div style={{
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(0,255,136,0.12), rgba(139,92,246,0.12))',
            border: '1px solid rgba(0,255,136,0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
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

        {/* ═══════ Tab Navigation ═══════ */}
        <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(255,255,255,0.04)', padding: '0.25rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.25rem' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              id={`tab-${t.key}`}
              style={{
                flex: 1, padding: '0.55rem', borderRadius: 'var(--radius-md)',
                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                background: tab === t.key ? 'rgba(139,92,246,0.2)' : 'transparent',
                border: tab === t.key ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'var(--transition-base)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════ Tab Content ═══════ */}

        {/* ── Tab: Hôm Nay ── */}
        {tab === 'today' && (
          <>
            {/* Empty state for authenticated user with no habits */}
            {activeHabits.length === 0 && isAuthenticated && (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗺</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Chưa có thói quen nào
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  Hãy chọn một lộ trình để bắt đầu hành trình kỷ luật của bạn!
                  <br />Hoặc tự tạo thói quen ở tab <strong>⚙️ Quản Lý</strong>.
                </div>
                <Link to="/journey" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                  🗺 Chọn Lộ Trình
                </Link>
              </div>
            )}

            {/* Per-habit tick list */}
            {activeHabits.length > 0 && (
              <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div className="dash-card-title" style={{ marginBottom: 0 }}>⚡ Hôm Nay — {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                  {(() => {
                    const doneCount = activeHabits.filter(h => !!habitProg[`${todayKey}_${h.id}`]).length;
                    return (
                      <span style={{
                        fontWeight: 800, fontSize: '0.9rem',
                        color: doneCount === activeHabits.length ? 'var(--green)' : 'var(--text-secondary)',
                        background: doneCount === activeHabits.length ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${doneCount === activeHabits.length ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 99, padding: '0.2rem 0.65rem',
                      }}>
                        {doneCount}/{activeHabits.length}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
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
                            {habit.action && habit.action !== habit.name ? habit.action : habit.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {(() => { const s = computeHabitStreak(habit.id, habitProg); return s > 0 ? (
                              <span style={{ color: s >= 7 ? '#f97316' : 'var(--text-muted)', fontWeight: 700 }}>🔥{s}</span>
                            ) : null; })()}
                            {habit.action && habit.action !== habit.name && (
                              <span style={{ opacity: 0.7 }}>{habit.name}</span>
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
                {!allHabitsDone && new Date().getHours() >= 20 && (
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
            )}

            {/* ── Mood (single instance — no duplicate) ── */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="dash-card-title" style={{ marginBottom: '0.75rem' }}>😊 Tâm Trạng Hôm Nay</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {MOODS.map(m => (
                  <button key={m.label} onClick={() => handleMood(m)} id={`mood-${m.label}`}
                    style={{
                      padding: '0.5rem 0.9rem', borderRadius: 'var(--radius-full)',
                      fontSize: '0.88rem', cursor: 'pointer',
                      background: todayMood?.label === m.label ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${todayMood?.label === m.label ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: 'var(--text-secondary)', transition: 'var(--transition-base)',
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                    }}>
                    <span style={{ fontSize: '1.1rem' }}>{m.emoji}</span> {m.label}
                  </button>
                ))}
              </div>
              {todayMood && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Đã lưu: {todayMood.emoji} {todayMood.label}
                </p>
              )}
            </div>

            {/* ── Daily Challenge ── */}
            <DailyChallenge streak={streak} />

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
          </>
        )}

        {/* ── Tab: Calendar (lazy loaded) ── */}
        {tab === 'calendar' && (
          <Suspense fallback={<div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Loading...</div>}>
            <MonthCalendar habitData={data} />
          </Suspense>
        )}

        {/* ── Tab: Weekly (memoized, only renders when active) ── */}
        {tab === 'weekly' && (
          <PerHabitWeeklyGrid habitProg={habitProg} activeHabits={activeHabits} />
        )}

        {/* ── Tab: Manage (lazy loaded) ── */}
        {tab === 'manage' && (
          <>
            <Suspense fallback={<div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Loading...</div>}>
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
                <HabitManager />
              </div>
            </Suspense>

            {/* Conquered Habits */}
            {conqueredHabits.length > 0 && (
              <div className="card" style={{ padding: '1.25rem' }}>
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
          </>
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
                    padding: '0.4rem 0.85rem', borderRadius: 'var(--radius-full)',
                    fontSize: '0.82rem', cursor: 'pointer',
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

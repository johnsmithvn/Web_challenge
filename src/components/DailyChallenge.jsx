import { useState, useMemo, useEffect } from 'react';
import { useXpStore, XP_REWARDS } from '../hooks/useXpStore';
import { useActivityLog } from '../hooks/useActivityLog';

import '../styles/daily.css';
import ALL_CHALLENGES from '../data/challenges.json';

// MVA = Minimum Viable Action = Hành động nhỏ nhất có thể làm được ngay hôm nay
const MVA_TIP = 'MVA = Hành động nhỏ nhất bạn có thể làm ngay hôm nay cho thói quen của mình. Ví dụ: "Tập thể dục" → chỉ cần mang giày ra trước cửa.';
const SOLO_CHALLENGES = ALL_CHALLENGES.filter(c => c.type !== 'Team');

// Pick challenge by streak day so new users start from Day 1, not a random point
// Stable per day: streak only changes when user ticks, not mid-day
function pickByDay(pool, streak) {
  // streak=0 or 1 → index 0 (first challenge)
  // Clamp to pool length so it wraps cleanly for repeat users
  const idx = Math.max(0, streak - 1) % pool.length;
  return pool[idx];
}

const TYPE_COLORS = {
  MVA: 'cyan', Reflection: 'purple', Team: 'green',
  Challenge: 'gold', Brain: 'purple', System: 'cyan', Mindset: 'blue',
};

export default function DailyChallenge({ streak = 0 }) {
  const dateKey   = new Date().toISOString().split('T')[0];
  // Personal mode: always use solo challenges (no team challenges)
  const challenge = useMemo(() => pickByDay(SOLO_CHALLENGES, streak), [streak]);

  const { addXp, removeXp, hasMilestone, isReady } = useXpStore();
  const { logActivity } = useActivityLog();
  const storageKey = `vl_dc_${dateKey}`;

  const [done, setDone]           = useState(() => !!localStorage.getItem(storageKey));
  const [showSteps, setShowSteps] = useState(false);
  const [showXpPop, setShowXpPop] = useState(false);

  // Sync done state with XP log after it loads.
  // Handles case where localStorage was cleared but XP was already awarded.
  useEffect(() => {
    if (!isReady) return;
    if (!done && hasMilestone('daily_challenge', { date: dateKey })) {
      setDone(true);
      localStorage.setItem(storageKey, '1');
    }
  }, [isReady]);

  const toggle = () => {
    if (!done) {
      localStorage.setItem(storageKey, '1');
      setDone(true);
      if (!hasMilestone('daily_challenge', { date: dateKey })) {
        addXp(XP_REWARDS.daily_challenge, 'daily_challenge', { date: dateKey });
        setShowXpPop(true);
        setTimeout(() => setShowXpPop(false), 3000);
      }
      logActivity('challenge_done', challenge.title, XP_REWARDS.daily_challenge, { type: challenge.type });
    } else {
      localStorage.removeItem(storageKey);
      setDone(false);
      // Deduct the XP that was awarded for this challenge
      removeXp('daily_challenge', { date: dateKey });
    }
  };

  const color = TYPE_COLORS[challenge.type] || 'purple';
  const isMVA = challenge.type === 'MVA';

  return (
    <div className={`daily-challenge card daily-challenge--${color}`} id="daily-challenge">
      {showXpPop && (
        <div className="xp-toast">⚡ +{XP_REWARDS.daily_challenge} XP — Daily Challenge!</div>
      )}

      <div className="daily-challenge__header">
        <div className="section-label" style={{ margin: 0 }}>🎯 Daily Challenge</div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isMVA && (
            <span className="dc-mva-tip" title={MVA_TIP}>
              ❓ MVA là gì?
            </span>
          )}
          <span className={`badge badge-${color === 'gold' ? 'gold' : color === 'green' ? 'green' : 'cyan'}`}>
            {challenge.type}
          </span>
        </div>
      </div>

      <div className="daily-challenge__icon">{challenge.icon}</div>
      <h3 className="h2" style={{ marginBottom: '0.5rem' }}>{challenge.title}</h3>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1rem' }}>
        {challenge.desc}
      </p>

      <button
        className="dc-steps-toggle"
        onClick={() => setShowSteps(v => !v)}
        id="dc-steps-btn"
      >
        {showSteps ? '▲ Ẩn hướng dẫn' : '▼ Xem hướng dẫn làm thế nào'}
      </button>

      {showSteps && (
        <ol className="dc-steps-list">
          {challenge.steps.map((step, i) => (
            <li key={i} className="dc-step-item">{step}</li>
          ))}
        </ol>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <button
          className={`btn ${done ? 'btn-ghost' : 'btn-primary'}`}
          onClick={toggle}
          id="daily-challenge-complete"
          style={{
            background:  done ? 'rgba(0,255,136,0.1)' : undefined,
            borderColor: done ? 'rgba(0,255,136,0.35)' : undefined,
            color:       done ? 'var(--green)' : undefined,
          }}
        >
          {done ? '✅ Đã Hoàn Thành' : `⚡ Hoàn Thành — +${XP_REWARDS.daily_challenge} XP`}
        </button>
        {done ? (
          <button onClick={toggle} id="daily-challenge-uncheck"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            bỏ chọn
          </button>
        ) : (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Reset lúc 00:00 mỗi ngày
          </span>
        )}
      </div>
    </div>
  );
}

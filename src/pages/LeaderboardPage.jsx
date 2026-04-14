import { useState } from 'react';
import { useHabitStore } from '../hooks/useHabitStore';
import { useXpStore, computeLevel } from '../hooks/useXpStore';
import '../styles/leaderboard.css';

// Seeded mock users to fill leaderboard
const MOCK_USERS = [
  { id: 'm1', name: 'Minh Anh',    avatar: '🧑‍💻', streak: 18, totalXp: 1240, totalDone: 20 },
  { id: 'm2', name: 'Thu Hà',      avatar: '👩‍💼', streak: 14, totalXp:  890, totalDone: 15 },
  { id: 'm3', name: 'Hùng Kiên',   avatar: '👨‍🎓', streak: 12, totalXp:  740, totalDone: 13 },
  { id: 'm4', name: 'Lan Anh',     avatar: '👩‍🏫', streak: 10, totalXp:  620, totalDone: 11 },
  { id: 'm5', name: 'Quân Nam',    avatar: '🧑‍💼', streak:  8, totalXp:  490, totalDone:  9 },
  { id: 'm6', name: 'Phương Vy',   avatar: '👩‍🔬', streak:  6, totalXp:  350, totalDone:  7 },
  { id: 'm7', name: 'Đức Thịnh',   avatar: '🧑‍🎨', streak:  5, totalXp:  290, totalDone:  6 },
  { id: 'm8', name: 'Hoa Trần',    avatar: '👩‍💻', streak:  3, totalXp:  180, totalDone:  4 },
  { id: 'm9', name: 'Bảo Long',    avatar: '🧑‍🔧', streak:  2, totalXp:   80, totalDone:  2 },
];

const TABS = [
  { id: 'streak', label: '🔥 Streak' },
  { id: 'xp',     label: '⚡ XP' },
  { id: 'done',   label: '✅ Ngày Done' },
];

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const RANK_EMOJIS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const { streak, totalDone } = useHabitStore();
  const { totalXp }           = useXpStore();
  const [tab, setTab]         = useState('streak');

  const me = {
    id: 'me', name: 'Bạn', avatar: '😤',
    streak, totalXp, totalDone, isMe: true,
  };

  const all = [...MOCK_USERS, me];

  const sorted = [...all].sort((a, b) => {
    if (tab === 'streak') return b.streak  - a.streak;
    if (tab === 'xp')     return b.totalXp - a.totalXp;
    return b.totalDone - a.totalDone;
  });

  const myRank = sorted.findIndex(u => u.id === 'me') + 1;

  return (
    <div className="lb-page">
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-label">🏆 Xếp Hạng</div>
          <h1 className="display-2">
            Leaderboard <span className="gradient-text">Cộng Đồng</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Hạng của bạn hiện tại:&nbsp;
            <strong style={{ color: 'var(--gold)' }}>#{myRank}</strong>
            &nbsp;— {streak > 0 ? `Streak ${streak} ngày 🔥` : 'Bắt đầu hôm nay!'}
          </p>
        </div>

        {/* Tab */}
        <div className="lb-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`lb-tab ${tab === t.id ? 'lb-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
              id={`lb-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Top 3 podium */}
        <div className="lb-podium">
          {sorted.slice(0, 3).map((u, i) => {
            const lv = computeLevel(u.totalXp);
            const val = tab === 'streak' ? `${u.streak}🔥` : tab === 'xp' ? `${u.totalXp}⚡` : `${u.totalDone}✅`;
            return (
              <div key={u.id} className={`lb-podium-card ${u.isMe ? 'lb-podium-card--me' : ''}`}
                style={{ '--rank-color': RANK_COLORS[i] }}>
                <div className="lb-podium-rank">{RANK_EMOJIS[i]}</div>
                <div className="lb-avatar">{u.avatar}</div>
                <div className="lb-name">{u.name}</div>
                <div className="lb-level">{lv.emoji} {lv.name}</div>
                <div className="lb-val" style={{ color: RANK_COLORS[i] }}>{val}</div>
              </div>
            );
          })}
        </div>

        {/* Full table */}
        <div className="lb-table-wrap card">
          {sorted.map((u, i) => {
            const lv  = computeLevel(u.totalXp);
            const val = tab === 'streak' ? u.streak : tab === 'xp' ? u.totalXp : u.totalDone;
            const unit = tab === 'streak' ? 'ngày 🔥' : tab === 'xp' ? 'XP ⚡' : 'ngày ✅';
            return (
              <div key={u.id} className={`lb-row ${u.isMe ? 'lb-row--me' : ''}`}>
                <span className="lb-row__rank" style={{ color: i < 3 ? RANK_COLORS[i] : 'var(--text-muted)' }}>
                  {i < 3 ? RANK_EMOJIS[i] : `#${i + 1}`}
                </span>
                <span className="lb-row__avatar">{u.avatar}</span>
                <div className="lb-row__info">
                  <span className="lb-row__name">{u.name}{u.isMe && <span className="badge badge-cyan" style={{ marginLeft: 6, fontSize: '0.65rem' }}>Bạn</span>}</span>
                  <span className="lb-row__level">{lv.emoji} {lv.name}</span>
                </div>
                <span className="lb-row__val">{val} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{unit}</span></span>
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '1.5rem' }}>
          * Leaderboard sẽ sync real-time với cộng đồng trong v2.0
        </p>
      </div>
    </div>
  );
}

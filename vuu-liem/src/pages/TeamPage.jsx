import { useState, useEffect } from 'react';
import { useHabitStore } from '../hooks/useHabitStore';
import '../styles/tracker.css';

const MOCK_TEAMMATE = {
  name: 'Minh Anh',
  emoji: '🧑‍💻',
  streak: 5,
  todayDone: true,
  completionPct: 71,
  lastActive: '08:12 SA',
  daysData: [true, true, false, true, true, false, true],
};

const REACTIONS = [
  { emoji: '👍', label: 'Done tốt!' },
  { emoji: '🔥', label: 'Giữ streak!' },
  { emoji: '👀', label: 'Làm đi bro' },
  { emoji: '💪', label: 'Cố lên!' },
];

function generateInviteCode() {
  const stored = localStorage.getItem('vl_invite_code');
  if (stored) return stored;
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  localStorage.setItem('vl_invite_code', code);
  return code;
}

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function TeamPage() {
  const { weekDates, data, streak, completionPct, todayDone } = useHabitStore();
  const [inviteCode] = useState(generateInviteCode);
  const [reactions, setReactions] = useState({});
  const [copied, setCopied] = useState(false);
  const [showAuthWall, setShowAuthWall] = useState(true);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReact = (emoji) => {
    setReactions(prev => ({ ...prev, [emoji]: !prev[emoji] }));
  };

  return (
    <div className="team-page">
      <div className="container">
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-label">🤝 Team Mode</div>
          <h1 className="display-2">
            Đồng Hành <span className="gradient-text">Cùng Nhau</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Ghép cặp với 1 người — trách nhiệm nhóm × 10 lần hiệu quả
          </p>
        </div>

        {/* Duo streak banner */}
        <div className="card" style={{ marginBottom: '2rem', background: 'rgba(0,255,136,0.06)', borderColor: 'rgba(0,255,136,0.2)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '2.5rem' }}>🔥</span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--green)' }}>
              Duo Streak: 3 ngày!
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Cả 2 cùng hoàn thành 3 ngày liên tiếp — tiếp tục đi! 💪
            </div>
          </div>
        </div>

        {/* Player comparison */}
        <div className="team-grid" style={{ position: 'relative' }}>
          {/* Auth wall overlay */}
          {showAuthWall && (
            <div className="auth-wall" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, background: 'rgba(8,8,15,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
              <span style={{ fontSize: '3rem' }}>🔐</span>
              <h2 className="h1" style={{ textAlign: 'center' }}>Login để dùng Team Mode</h2>
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 400 }}>
                Team Mode yêu cầu tài khoản để sync tiến độ với bạn đồng hành trong thời gian thực.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => setShowAuthWall(false)} id="team-demo-btn">
                  👀 Xem Demo (Không cần login)
                </button>
                <button className="btn btn-ghost" id="team-login-btn">
                  🔐 Login / Đăng ký
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                * Auth thật sẽ có ở v2.0 với Firebase
              </p>
            </div>
          )}

          {/* Me */}
          <div className="team-player-card card card-glow-cyan">
            <div className="team-avatar team-avatar--me">
              <span>😤</span>
              <div className={`team-status-dot team-status-dot--${todayDone ? 'done' : 'pending'}`} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
              Bạn
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <span className="badge badge-green">🔥 {streak} streak</span>
              <span className="badge badge-cyan">{completionPct}% tuần này</span>
              {todayDone && <span className="badge badge-green">✅ Done hôm nay</span>}
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Tuần này</div>
              <div className="heatmap-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {weekDates.map((d, i) => (
                  <div
                    key={i}
                    className={`heatmap-cell ${d === new Date().toISOString().split('T')[0] ? 'heatmap-cell--today' : data[d] ? 'heatmap-cell--done' : 'heatmap-cell--empty'}`}
                    title={DAY_LABELS[i]}
                  />
                ))}
              </div>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${completionPct}%` }} />
            </div>
          </div>

          {/* Teammate (mock) */}
          <div className="team-player-card card card-glow-purple">
            <div className="team-avatar team-avatar--them">
              <span>{MOCK_TEAMMATE.emoji}</span>
              <div className={`team-status-dot team-status-dot--${MOCK_TEAMMATE.todayDone ? 'done' : 'pending'}`} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
              {MOCK_TEAMMATE.name}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <span className="badge badge-green">🔥 {MOCK_TEAMMATE.streak} streak</span>
              <span className="badge badge-purple">{MOCK_TEAMMATE.completionPct}% tuần này</span>
              {MOCK_TEAMMATE.todayDone && (
                <span className="badge badge-green" title={`Lúc ${MOCK_TEAMMATE.lastActive}`}>
                  ✅ Done {MOCK_TEAMMATE.lastActive}
                </span>
              )}
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Tuần này</div>
              <div className="heatmap-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {MOCK_TEAMMATE.daysData.map((done, i) => (
                  <div
                    key={i}
                    className={`heatmap-cell ${done ? 'heatmap-cell--done' : 'heatmap-cell--empty'}`}
                    title={DAY_LABELS[i]}
                  />
                ))}
              </div>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${MOCK_TEAMMATE.completionPct}%` }} />
            </div>

            {/* Reactions */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Gửi động lực:</div>
              <div className="team-reactions">
                {REACTIONS.map(r => (
                  <button
                    key={r.emoji}
                    className={`reaction-btn${reactions[r.emoji] ? ' reacted' : ''}`}
                    onClick={() => handleReact(r.emoji)}
                    id={`react-${r.emoji}`}
                  >
                    {r.emoji} {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Invite code section */}
        <div className="invite-card card" style={{ marginTop: '2rem' }}>
          <div className="section-label" style={{ margin: '0 0 0.75rem' }}>📩 Mời bạn bè</div>
          <h3 className="h2" style={{ marginBottom: '0.5rem' }}>Mã mời của bạn</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Gửi mã này cho bạn đồng hành — họ nhập vào để ghép cặp với bạn
          </p>
          <div
            className="invite-code"
            onClick={handleCopyCode}
            title="Click để copy"
            id="invite-code-display"
          >
            {inviteCode}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            {copied
              ? <span style={{ color: 'var(--green)', fontSize: '0.9rem' }}>✅ Đã copy!</span>
              : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Click vào mã để copy 📋</span>
            }
          </div>
        </div>

        {/* Info cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
          {[
            { icon: '👀', title: 'Accountability', desc: 'Có người theo dõi → bạn không dễ bỏ cuộc' },
            { icon: '🔔', title: 'Nhắc nhở nhẹ', desc: 'Khi teammate chưa làm → thông báo nhắc' },
            { icon: '🏆', title: 'Duo Badge', desc: 'Cả 2 cùng làm đủ → nhận badge đặc biệt' },
          ].map(card => (
            <div key={card.title} className="card" style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>{card.icon}</span>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '0.25rem' }}>{card.title}</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

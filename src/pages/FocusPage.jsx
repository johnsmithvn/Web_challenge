import FocusTimer from '../components/FocusTimer';
import { useFocusTimer } from '../hooks/useFocusTimer';
import { useCustomHabits } from '../hooks/useCustomHabits';
import '../styles/focus.css';

export default function FocusPage() {
  const { sessions, todayMinutes } = useFocusTimer();
  const { activeHabits } = useCustomHabits();

  // Last 5 sessions
  const recentSessions = [...sessions].reverse().slice(0, 10);

  // Per-habit today stats
  const today = new Date().toISOString().split('T')[0];
  const todayByHabit = sessions
    .filter(s => s.date === today)
    .reduce((acc, s) => {
      const key = s.habitId || 'none';
      acc[key] = (acc[key] || 0) + s.durationMin;
      return acc;
    }, {});

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '6rem 0 4rem' }}>
      <div className="container">
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-label">⏱ Focus</div>
          <h1 className="display-2">
            Pomodoro <span className="gradient-text">Timer</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            25 phút tập trung, 5 phút nghỉ. Xây kỷ luật từng session.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
          {/* Timer card */}
          <FocusTimer />

          {/* Right side */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Today breakdown by habit */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="dash-card-title">📊 Hôm Nay</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: '0.5rem' }}>
                <span className="gradient-text">{todayMinutes}</span>
                <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>phút</span>
              </div>
              {activeHabits.map(h => {
                const min = todayByHabit[h.id] || 0;
                if (!min) return null;
                return (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>{h.icon}</span>
                    <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{h.name}</span>
                    <span style={{ fontWeight: 700, color: h.color, fontSize: '0.9rem' }}>{min}p</span>
                  </div>
                );
              })}
              {!Object.keys(todayByHabit).length && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Chưa có session nào hôm nay
                </p>
              )}
            </div>

            {/* Session history */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="dash-card-title">📝 Lịch Sử Sessions</div>
              {recentSessions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Chưa có session nào. Bắt đầu timer!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
                  {recentSessions.map((s, i) => {
                    const linked = activeHabits.find(h => h.id === s.habitId);
                    const time = new Date(s.completedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={s.id || i} style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                      }}>
                        <span style={{ color: 'var(--green)' }}>✅</span>
                        <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                          {linked ? `${linked.icon} ${linked.name}` : 'Focus'}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {s.durationMin}p · {s.date === today ? time : s.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="card" style={{ padding: '1.25rem', background: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)' }}>
              <div className="dash-card-title">💡 Pomodoro Tips</div>
              <ul style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.8', paddingLeft: '1.25rem', marginTop: '0.75rem' }}>
                <li>Tắt điện thoại/thông báo khi bắt đầu</li>
                <li>Chỉ làm <strong>1 việc</strong> trong mỗi 25 phút</li>
                <li>Nghỉ ngắn = đứng dậy, rời màn hình</li>
                <li>4 sessions = 1 longbreak 15–20 phút</li>
                <li>Gắn session với habit để track progress</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

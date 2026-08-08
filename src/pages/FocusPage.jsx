import FocusTimer from '../components/FocusTimer';
import { useFocusTimer } from '../hooks/useFocusTimer';
import AppIcon from '../components/AppIcon';
import '../styles/focus.css';

export default function FocusPage() {
  const { sessions, todaySessions, todayMinutes } = useFocusTimer();

  // v5.0.0: bỏ phần "breakdown theo habit" — Habit tracker đã gỡ hẳn, session
  // không còn cột habit_id để nhóm.
  const recentSessions = [...sessions].reverse().slice(0, 10);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '6rem 0 4rem' }}>
      <div className="container">
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-label"><AppIcon name="timer" size={15} /> Focus</div>
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

            {/* Today */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="dash-card-title"><AppIcon name="chartLine" size={16} /> Hôm Nay</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: '0.5rem' }}>
                <span className="gradient-text">{todayMinutes}</span>
                <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>phút</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                {todaySessions.length
                  ? `${todaySessions.length} session hoàn thành`
                  : 'Chưa có session nào hôm nay'}
              </p>
            </div>

            {/* Session history */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="dash-card-title"><AppIcon name="note" size={16} /> Lịch Sử Sessions</div>
              {recentSessions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Chưa có session nào. Bắt đầu timer!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
                  {recentSessions.map((s, i) => {
                    const time = new Date(s.completedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={s.id || i} style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                      }}>
                        <span style={{ color: 'var(--green)' }}><AppIcon name="checkCircle" size={15} /></span>
                        <span style={{ color: 'var(--text-secondary)', flex: 1 }}>Focus</span>
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
              <div className="dash-card-title"><AppIcon name="lightbulb" size={16} /> Pomodoro Tips</div>
              <ul style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.8', paddingLeft: '1.25rem', marginTop: '0.75rem' }}>
                <li>Tắt điện thoại/thông báo khi bắt đầu</li>
                <li>Chỉ làm <strong>1 việc</strong> trong mỗi 25 phút</li>
                <li>Nghỉ ngắn = đứng dậy, rời màn hình</li>
                <li>4 sessions = 1 longbreak 15–20 phút</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

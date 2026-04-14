import { useHabitStore } from '../hooks/useHabitStore';
import '../styles/tracker.css';

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function calcDayOfWeekStats(data) {
  const counts = Array(7).fill(0);
  const totals = Array(7).fill(0);
  Object.entries(data).forEach(([dateKey, done]) => {
    const d = new Date(dateKey);
    let dow = d.getDay(); // 0=Sun
    dow = dow === 0 ? 6 : dow - 1; // shift to Mon=0
    totals[dow]++;
    if (done) counts[dow]++;
  });
  return DAY_LABELS.map((label, i) => ({
    label,
    rate: totals[i] > 0 ? Math.round((counts[i] / totals[i]) * 100) : 0,
    total: totals[i],
  }));
}

export default function DashboardPage() {
  const { data, streak, totalDone, completionPct, badge, weekDates } = useHabitStore();

  const dowStats = calcDayOfWeekStats(data);
  const worstDay = dowStats.reduce((a, b) => (a.rate <= b.rate && a.total > 0 ? a : b), dowStats[0]);
  const bestDay  = dowStats.reduce((a, b) => (a.rate >= b.rate ? a : b), dowStats[0]);

  // Last 28 days heatmap
  const heatmap = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    const key = d.toISOString().split('T')[0];
    return { key, done: !!data[key], isToday: key === new Date().toISOString().split('T')[0] };
  });

  return (
    <div className="dashboard-page">
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-label">📈 Tổng Quan</div>
          <h1 className="display-2">
            Dashboard <span className="gradient-text">Của Bạn</span>
          </h1>
        </div>

        {/* Top stats */}
        <div className="dash-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="card dash-card">
            <div className="dash-card-title">🔥 Streak hiện tại</div>
            <div className="dash-big-num gradient-text">{streak}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>ngày liên tiếp</p>
            {badge && (
              <div className={`badge badge-${badge.color === 'gold' ? 'gold' : 'green'}`} style={{ marginTop: '0.75rem' }}>
                {badge.emoji} {badge.label}
              </div>
            )}
          </div>

          <div className="card dash-card">
            <div className="dash-card-title">✅ Tổng ngày done</div>
            <div className="dash-big-num gradient-text-green">{totalDone}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>kể từ khi bắt đầu</p>
          </div>

          <div className="card dash-card">
            <div className="dash-card-title">⚡ Tuần này</div>
            <div className="dash-big-num gradient-text-gold">{completionPct}%</div>
            <div className="progress-bar-track" style={{ marginTop: '0.75rem' }}>
              <div className="progress-bar-fill" style={{ width: `${completionPct}%` }} />
            </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="dash-card-title">📅 28 Ngày Gần Đây</div>
          <div className="heatmap-labels">
            {DAY_LABELS.map(l => <span key={l} className="heatmap-label">{l}</span>)}
          </div>
          <div className="heatmap-grid">
            {heatmap.map((day, i) => (
              <div
                key={i}
                className={`heatmap-cell ${day.isToday ? 'heatmap-cell--today' : day.done ? 'heatmap-cell--done' : 'heatmap-cell--empty'}`}
                title={day.key + (day.done ? ' ✓' : '')}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>⬜ Chưa làm</span>
            <span style={{ color: 'var(--green)' }}>🟩 Đã làm</span>
            <span style={{ color: 'var(--cyan)' }}>🟦 Hôm nay</span>
          </div>
        </div>

        {/* Day-of-week bar chart */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="dash-card-title">📊 Tỷ Lệ Theo Ngày Trong Tuần</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', height: '100px', marginTop: '1rem' }}>
            {dowStats.map(day => (
              <div key={day.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <div style={{ fontSize: '0.7rem', color: day.rate > 0 ? 'var(--green)' : 'var(--text-muted)' }}>{day.rate > 0 ? day.rate + '%' : ''}</div>
                <div style={{
                  width: '100%',
                  height: `${Math.max(day.rate, 6)}px`,
                  background: day.rate > 0 ? 'var(--grad-text)' : 'rgba(255,255,255,0.06)',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.8s cubic-bezier(0.34,1.56,0.64,1)',
                  maxHeight: '80px',
                  minHeight: '6px',
                }} />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{day.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div className="card">
          <div className="dash-card-title">💡 Insights Của Bạn</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
            {worstDay.total > 0 && (
              <div className="dash-insight">
                😬 Bạn hay bỏ nhất vào <strong>{worstDay.label}</strong> ({worstDay.rate}% hoàn thành) — hãy set reminder đặc biệt cho ngày này.
              </div>
            )}
            {bestDay.total > 0 && bestDay.rate > 0 && (
              <div className="dash-insight" style={{ borderColor: 'var(--green)' }}>
                ⭐ Ngày tốt nhất của bạn: <strong>{bestDay.label}</strong> ({bestDay.rate}%) — nhân đôi momentum vào ngày này.
              </div>
            )}
            {streak >= 3 && (
              <div className="dash-insight" style={{ borderColor: 'var(--gold)' }}>
                🔥 Streak {streak} ngày — bạn đang trong vùng <strong>quán tính</strong>. Não bộ đã bắt đầu tự động hoá thói quen này.
              </div>
            )}
            {totalDone === 0 && (
              <div className="dash-insight">
                👋 Chưa có data. Tick checkbox đầu tiên để bắt đầu hành trình!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useHabitStore } from '../hooks/useHabitStore';
import { useXpStore, XP_REWARDS } from '../hooks/useXpStore';
import '../styles/sections.css';
import '../styles/tracker.css';


const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const WEEKS_CONFIG = [
  {
    id: 1,
    label: 'Tuần 1',
    task: 'Thử thách Cá nhân: Hành động nhỏ',
    color: 'blue',
    badge: { label: 'Lấy Đà', emoji: '✅', cls: 'badge-green' },
  },
  {
    id: 2,
    label: 'Tuần 2',
    task: 'Thử thách Đồng đội: Báo cáo chéo',
    color: 'purple',
    badge: { label: 'Bứt Phá', emoji: '✅', cls: 'badge-gold' },
  },
  {
    id: 3,
    label: 'Tuần 3',
    task: 'Học lý thuyết: Giải mã cơ chế não bộ',
    color: 'cyan',
    badge: { label: 'Hoàn Thành', emoji: '🏆', cls: 'badge-cyan' },
  },
];

export default function TrackerSection({ compact = false, week2Locked = false }) {
  const { data, toggle, weekDates, streak, weekDone, completionPct, badge } = useHabitStore();
  const { addXp, hasMilestone } = useXpStore();

  const handleToggle = (dateKey) => {
    const wasUnchecked = !data[dateKey];
    toggle(dateKey);
    // Award XP only when checking (not unchecking) and only first time
    if (wasUnchecked && !hasMilestone('daily_check', { date: dateKey })) {
      addXp(XP_REWARDS.daily_check, 'daily_check', { date: dateKey });
    }
  };

  return (
    <section className={compact ? '' : 'section tracker-section'} id={compact ? undefined : 'tracker'}>
      <div className={compact ? '' : 'container'}>
        {!compact && (
          <>
            <div className="section-label">📊 Theo Dõi</div>
            <h2 className="display-2" style={{ marginBottom: '0.75rem' }}>
              Bảng Tiến Độ <span className="gradient-text">Kỷ Luật</span>
            </h2>
            <p className="section-desc">Tick mỗi ngày để giữ streak 🔥</p>
          </>
        )}

        {/* Stats row */}
        <div className="tracker-stats">
          <div className="tracker-stat-card card">
            <span className="tracker-stat-icon" style={{ animationName: 'fire-flicker' }}>🔥</span>
            <span className="tracker-stat-val gradient-text">{streak}</span>
            <span className="tracker-stat-label">Ngày streak</span>
          </div>
          <div className="tracker-stat-card card">
            <span className="tracker-stat-icon">📅</span>
            <span className="tracker-stat-val gradient-text-green">{weekDone}/7</span>
            <span className="tracker-stat-label">Tuần này</span>
          </div>
          <div className="tracker-stat-card card">
            <span className="tracker-stat-icon">⚡</span>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="tracker-stat-label">Hoàn thành</span>
                <span className="tracker-stat-val" style={{ fontSize: '1rem' }}>{completionPct}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
          </div>
          {badge && (
            <div className="tracker-stat-card card card-glow-green">
              <span className="tracker-stat-icon" style={{ fontSize: '2rem' }}>{badge.emoji}</span>
              <span className={`badge ${badge.color === 'gold' ? 'badge-gold' : 'badge-green'}`}>{badge.label}</span>
            </div>
          )}
        </div>

        {/* Main tracker table */}
        <div className="tracker-table-wrap">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>GIAI ĐOẠN</th>
                <th>NHIỆM VỤ TRỌNG TÂM</th>
                {DAY_LABELS.map(d => <th key={d}>{d}</th>)}
                <th>ĐÁNH GIÁ</th>
              </tr>
            </thead>
            <tbody>
              {WEEKS_CONFIG.map((wk, wi) => {
                const weekDatesSlice = weekDates.slice(0, 7).map((_, di) => {
                  const base = new Date(weekDates[0]);
                  base.setDate(base.getDate() + wi * 7 + di);
                  return base.toISOString().split('T')[0];
                });
                const doneDays  = weekDatesSlice.filter(d => data[d]).length;
                const isLocked  = wk.id === 2 && week2Locked;

                return (
                  <tr key={wk.id} className={isLocked ? 'tracker-row--locked' : ''}>
                    <td>
                      <span className={`week-label week-label--${wk.color}`}>
                        {isLocked ? '🔒' : ''} {wk.label}
                      </span>
                    </td>
                    <td>
                      {wk.task}
                      {isLocked && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--purple-light)', marginTop: '0.2rem' }}>
                          🤝 Cần teammate xác nhận trên trang Đồng Đội
                        </div>
                      )}
                    </td>
                    {weekDatesSlice.map((dateKey, di) => (
                      <td key={di}>
                        <input
                          type="checkbox"
                          className={`habit-checkbox ${isLocked ? 'habit-checkbox--locked' : ''}`}
                          checked={!!data[dateKey]}
                          onChange={() => !isLocked && handleToggle(dateKey)}
                          disabled={isLocked}
                          id={`check-w${wk.id}-d${di + 1}`}
                          aria-label={`${wk.label} ${DAY_LABELS[di]}${isLocked ? ' (bị khóa)' : ''}`}
                          title={isLocked ? 'Tuần 2: teammate phải xác nhận cho bạn' : ''}
                        />
                      </td>
                    ))}
                    <td>
                      <div className="tracker-score">
                        <span style={{ color: doneDays === 7 ? 'var(--green)' : 'var(--text-secondary)' }}>
                          {doneDays}/7
                        </span>
                        {' '}
                        <span className={`badge ${wk.badge.cls}`} style={{ fontSize: '0.7rem' }}>
                          {wk.badge.emoji} {wk.badge.label}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="tracker-legend">
          <span>💡 Tip: Tick trước 23:59 để giữ streak</span>
          <span className="badge badge-green">🔥 3 ngày = Lấy Đà</span>
          <span className="badge badge-gold">🟡 10 ngày = Bứt Phá</span>
          <span className="badge badge-purple">🏆 21 ngày = Hoàn Thành</span>
        </div>
      </div>
    </section>
  );
}

/**
 * JourneyHistory
 * Displays list of past (non-active) user journeys.
 *
 * Props:
 *   history — user_journeys[] (status: completed | archived | extended)
 */

import { useNavigate } from 'react-router-dom';

const STATUS_LABEL = {
  completed: '✅ Hoàn Thành',
  archived:  '🏳 Bỏ Cuộc',
  extended:  '⏩ Mở Rộng',
};

export default function JourneyHistory({ history = [] }) {
  const navigate = useNavigate();
  if (!history.length) {
    return (
      <div className="journey-history-empty">
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📜</div>
        <div>Chưa có lộ trình nào đã hoàn thành.</div>
        <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: '#6b7280' }}>
          Hãy bắt đầu một lộ trình từ tab Khám Phá!
        </div>
      </div>
    );
  }

  return (
    <div className="journey-history">
      {history.map(j => {
        const startLabel = new Date(j.started_at).toLocaleDateString('vi-VN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        });
        const endLabel = j.ended_at
          ? new Date(j.ended_at).toLocaleDateString('vi-VN', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })
          : '—';

        // Compute duration completed
        const start   = new Date(j.started_at);
        const end     = j.ended_at ? new Date(j.ended_at) : new Date();
        const daysRan = Math.max(1, Math.floor((end - start) / 86400000) + 1);
        const daysMax = j.target_days || 21;

        // 0-10 simple XP feel: percentage done
        const completionPct = Math.min(100, Math.round((daysRan / daysMax) * 100));

        const statusKey = j.status || 'archived';
        const icon = statusKey === 'completed' ? '🏆' : statusKey === 'archived' ? '📁' : '📈';

        return (
          <div
            key={j.id}
            className="journey-history-card"
            onClick={() => navigate(`/journey/${j.id}`)}
            style={{ cursor: 'pointer' }}
            title="Xem chi tiết lộ trình"
          >
            <span className="journey-history-icon">{icon}</span>

            <div className="journey-history-info">
              <h4>{j.title}</h4>
              <div className="journey-history-dates">
                {startLabel} → {endLabel}
                {j.cycle > 1 && ` · Chu kỳ ${j.cycle}`}
                {' · '}
                <strong>{daysRan}/{daysMax} ngày</strong>
                {' · '}
                <span style={{ color: '#a78bfa' }}>{completionPct}%</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className={`journey-status-badge ${statusKey}`}>
                {STATUS_LABEL[statusKey] || statusKey}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>›</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

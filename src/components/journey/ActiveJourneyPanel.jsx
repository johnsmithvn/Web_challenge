import { useMemo, useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

/**
 * ActiveJourneyPanel
 * Displays the currently running journey: progress ring, habit snapshot,
 * and action buttons (renew, extend, quit).
 *
 * Props:
 *   journey       — user_journeys row (active)
 *   onRenew       — () => void
 *   onExtend      — (days: number) => void
 *   onQuit        — () => void  (archives journey)
 */
export default function ActiveJourneyPanel({ journey, onRenew, onExtend, onQuit }) {
  const { user } = useAuth();
  const [journeyHabits, setJourneyHabits] = useState([]);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  // ── Compute progress ──────────────────────────────────────
  const { currentDay, targetDays, pct } = useMemo(() => {
    if (!journey) return { currentDay: 0, targetDays: 21, pct: 0 };
    const start  = new Date(journey.started_at);
    const today  = new Date();
    const diff   = Math.floor((today - start) / 86400000) + 1;
    const target = journey.target_days || 21;
    const day    = Math.min(diff, target);
    return { currentDay: day, targetDays: target, pct: Math.round((day / target) * 100) };
  }, [journey]);

  // ── SVG ring params ───────────────────────────────────────
  const radius       = 46;
  const circumference = 2 * Math.PI * radius;
  const offset       = circumference - (pct / 100) * circumference;

  // ── Load journey habits snapshot ──────────────────────────
  useEffect(() => {
    if (!journey?.id || !isSupabaseEnabled) return;
    supabase
      .from('journey_habits')
      .select('id, name, icon, color')
      .eq('journey_id', journey.id)
      .order('sort_order')
      .then(({ data }) => setJourneyHabits(data || []));
  }, [journey?.id]);

  if (!journey) return null;

  const statusLabel = journey.status === 'extended' ? '(Đã Mở Rộng)' : '';

  return (
    <div className="active-journey-panel">
      {/* Progress card */}
      <div className="journey-progress-card">
        {/* Ring */}
        <div className="journey-ring-wrap">
          <svg className="journey-ring-svg" width="110" height="110" viewBox="0 0 110 110">
            <defs>
              <linearGradient id="journeyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <circle className="journey-ring-bg" cx="55" cy="55" r={radius} />
            <circle
              className="journey-ring-fill"
              cx="55" cy="55" r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="journey-ring-label">
            <span className="journey-ring-day">{currentDay}</span>
            <span className="journey-ring-total">/{targetDays}</span>
          </div>
        </div>

        {/* Info */}
        <div className="journey-info">
          <h2>{journey.title} {statusLabel}</h2>
          <p className="journey-meta">
            Bắt đầu {new Date(journey.started_at).toLocaleDateString('vi-VN')}
            {journey.cycle > 1 && ` · Chu kỳ ${journey.cycle}`}
          </p>

          <div className="journey-progress-bar-wrap">
            <div className="journey-progress-bar" style={{ width: `${pct}%` }} />
          </div>
          <div className="journey-progress-pct">{pct}% hoàn thành</div>

          {/* Actions */}
          <div className="journey-actions" style={{ marginTop: '1rem' }}>
            <button className="btn-journey-renew" onClick={onRenew} title="Gia hạn 21 ngày mới">
              🔄 Gia Hạn 21 Ngày
            </button>
            <button className="btn-journey-extend" onClick={() => onExtend(30)} title="Mở rộng thêm 30 ngày">
              ⏩ +30 Ngày
            </button>
            <button className="btn-journey-quit" onClick={() => setShowQuitConfirm(true)}>
              🏳 Bỏ Cuộc
            </button>
          </div>
        </div>
      </div>

      {/* Habits snapshot */}
      {journeyHabits.length > 0 && (
        <div className="journey-habits-section">
          <h3>Habits trong lộ trình này</h3>
          <div className="journey-habit-chips">
            {journeyHabits.map(h => (
              <span key={h.id} className="journey-habit-chip">
                <span>{h.icon || '✅'}</span>
                {h.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quit confirm */}
      {showQuitConfirm && (
        <div className="quit-confirm-overlay" onClick={() => setShowQuitConfirm(false)}>
          <div className="quit-confirm-box" onClick={e => e.stopPropagation()}>
            <span className="quit-icon">🏳</span>
            <h3>Bỏ Cuộc?</h3>
            <p>
              Lộ trình "<strong>{journey.title}</strong>" sẽ được lưu vào Lịch Sử.
              Bạn có thể bắt đầu lộ trình khác bất cứ lúc nào.
            </p>
            <div className="quit-confirm-actions">
              <button className="btn-cancel-quit" onClick={() => setShowQuitConfirm(false)}>
                Tiếp Tục
              </button>
              <button
                className="btn-confirm-quit"
                onClick={() => { setShowQuitConfirm(false); onQuit(); }}
              >
                Bỏ Cuộc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

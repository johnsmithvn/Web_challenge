import { useMemo, useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

/**
 * ActiveJourneyPanel
 * Displays the currently running journey: progress ring, habit snapshot,
 * and action buttons (renew, extend, quit).
 *
 * Progress = số ngày user đã tick ĐỦ tất cả habit của lộ trình
 * (không phải số ngày calendar đã trôi qua)
 *
 * Props:
 *   journey   — user_journeys row (active)
 *   onRenew   — () => void
 *   onExtend  — (days: number) => void
 *   onComplete — () => void  (completes journey + closes habits)
 *   onQuit    — () => void  (archives journey)
 */
export default function ActiveJourneyPanel({ journey, onRenew, onExtend, onComplete, onQuit }) {
  const { user } = useAuth();
  const [journeyHabits, setJourneyHabits] = useState([]);
  const [completedDays, setCompletedDays]  = useState(0);
  const [todayAllDone, setTodayAllDone]    = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  // ── Load journey habits + compute REAL progress ──────────────
  useEffect(() => {
    if (!journey?.id || !isSupabaseEnabled || !user) return;

    supabase
      .from('journey_habits')
      .select('id, name, icon, color, habit_id')
      .eq('journey_id', journey.id)
      .order('sort_order')
      .then(async ({ data: hSnaps }) => {
        if (!hSnaps?.length) {
          setJourneyHabits([]);
          return;
        }
        setJourneyHabits(hSnaps);

        // Only compute real progress if habits have real habit_ids
        const habitIds = hSnaps.map(h => h.habit_id).filter(Boolean);
        if (!habitIds.length) return;

        // Fetch all habit_logs since journey start for these habits
        const { data: logs } = await supabase
          .from('habit_logs')
          .select('habit_id, log_date')
          .eq('user_id', user.id)
          .in('habit_id', habitIds)
          .gte('log_date', journey.started_at)
          .eq('status', 'completed');

        if (!logs) return;

        // Group by date: map { "YYYY-MM-DD": Set<habitId> }
        const byDate = {};
        logs.forEach(({ habit_id, log_date }) => {
          if (!byDate[log_date]) byDate[log_date] = new Set();
          byDate[log_date].add(habit_id);
        });

        // Count days where ALL habits were done
        const totalHabits = habitIds.length;
        const doneDays = Object.values(byDate).filter(s => s.size >= totalHabits).length;
        setCompletedDays(doneDays);

        // Check today
        const today = new Date().toISOString().split('T')[0];
        const todaySet = byDate[today];
        setTodayAllDone(!!(todaySet && todaySet.size >= totalHabits));
      });
  }, [journey?.id, user?.id]);

  // ── Progress calculation ──────────────────────────────────────
  const { targetDays, pct, calendarDay } = useMemo(() => {
    if (!journey) return { targetDays: 21, pct: 0, calendarDay: 0 };
    const target = journey.target_days || 21;
    const start  = new Date(journey.started_at);
    const today  = new Date();
    const elapsed = Math.min(Math.floor((today - start) / 86400000) + 1, target);
    return {
      targetDays:  target,
      pct:         Math.round((completedDays / target) * 100),
      calendarDay: elapsed,
    };
  }, [journey, completedDays]);

  // ── SVG ring ─────────────────────────────────────────────────
  const radius       = 46;
  const circumference = 2 * Math.PI * radius;
  const offset       = circumference - (Math.min(pct, 100) / 100) * circumference;

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
            <span className="journey-ring-day">{completedDays}</span>
            <span className="journey-ring-total">/{targetDays}</span>
          </div>
        </div>

        {/* Info */}
        <div className="journey-info">
          <h2>{journey.title} {statusLabel}</h2>
          <p className="journey-meta">
            Bắt đầu {new Date(journey.started_at).toLocaleDateString('vi-VN')}
            {journey.cycle > 1 && ` · Chu kỳ ${journey.cycle}`}
            {' · '}Ngày calendar thứ {calendarDay}
          </p>

          {/* Today status */}
          <div style={{
            fontSize: '0.85rem',
            color: todayAllDone ? 'var(--green)' : 'var(--text-muted)',
            marginBottom: '0.5rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            {todayAllDone
              ? <><span>✅</span> Hôm nay đã hoàn thành tất cả habits!</>
              : <><span>⭕</span> Hôm nay chưa tick đủ habits</>}
          </div>

          <div className="journey-progress-bar-wrap">
            <div className="journey-progress-bar" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <div className="journey-progress-pct">
            {completedDays}/{targetDays} ngày hoàn thành ({pct}%)
          </div>

          {/* Actions */}
          <div className="journey-actions" style={{ marginTop: '1rem' }}>
            {completedDays >= targetDays ? (
              /* ── Journey Goal Reached! ─────────────── */
              <>
                <div style={{
                  width: '100%',
                  padding: '0.85rem 1rem',
                  background: 'linear-gradient(135deg, rgba(0,255,136,0.1), rgba(139,92,246,0.1))',
                  border: '1px solid rgba(0,255,136,0.25)',
                  borderRadius: '10px',
                  textAlign: 'center',
                  marginBottom: '0.75rem',
                  color: 'var(--green)',
                  fontWeight: 700,
                  fontSize: '1rem',
                }}>
                  🎉 Chúc mừng! Bạn đã hoàn thành {targetDays} ngày!
                </div>
                <button className="btn-journey-renew" onClick={onRenew} title="Tiếp tục với cùng habits, reset ngày">
                  🔄 Tiếp Tục Cycle {(journey.cycle || 1) + 1}
                </button>
                <button className="btn-journey-extend" onClick={() => onExtend(21)} title="Thêm 21 ngày nữa">
                  ⏩ +21 Ngày
                </button>
                <button className="btn-journey-quit" onClick={onComplete} title="Đóng lộ trình, lưu vào lịch sử">
                  ✅ Hoàn Thành
                </button>
              </>
            ) : (
              /* ── Normal (In Progress) ─────────────── */
              <>
                <button className="btn-journey-renew" onClick={onRenew} title="Gia hạn 21 ngày mới">
                  🔄 Gia Hạn 21 Ngày
                </button>
                <button className="btn-journey-extend" onClick={() => onExtend(30)} title="Mở rộng thêm 30 ngày">
                  ⏩ +30 Ngày
                </button>
                <button className="btn-journey-quit" onClick={() => setShowQuitConfirm(true)}>
                  🏳 Bỏ Cuộc
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Habits snapshot */}
      {journeyHabits.length > 0 && (
        <div className="journey-habits-section">
          <h3>Habits trong lộ trình này</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Tick đủ tất cả habits dưới đây mỗi ngày để tính 1 ngày hoàn thành
          </p>
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

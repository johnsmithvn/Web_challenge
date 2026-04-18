import { useEffect, useRef } from 'react';
import { useCustomHabits } from '../hooks/useCustomHabits';
import '../styles/completion.css';

const CONFETTI_COLORS = ['#ffd700', '#f97316', '#00ff88', '#8b5cf6', '#06b6d4', '#ec4899'];
const ROUND_KEY = 'vl_program_round'; // which round (1, 2, 3...)

function Confetti() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 24, pointerEvents: 'none' }}>
      {Array.from({ length: 18 }).map((_, i) => (
        <div
          key={i}
          className="confetti-dot"
          style={{
            left: `${Math.random() * 100}%`,
            top:  `${Math.random() * 40}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${Math.random() * 0.8}s`,
            animationDuration: `${1.2 + Math.random() * 0.8}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * CompletionModal — shown once when streak reaches 21.
 * onStartNewRound: callback to reset habit store for a new 21-day cycle.
 * onClose: dismiss without resetting.
 */
export default function CompletionModal({ streak, totalXp, onStartNewRound, onClose }) {
  const { activeHabits } = useCustomHabits();
  const round = parseInt(localStorage.getItem(ROUND_KEY) || '1', 10);
  const closeRef = useRef(null);

  // Trap focus on mount
  useEffect(() => {
    closeRef.current?.focus();
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleNewRound = () => {
    localStorage.setItem(ROUND_KEY, String(round + 1));
    onStartNewRound();
  };

  return (
    <div className="completion-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Hoàn thành 21 ngày">
      <div className="completion-modal" onClick={e => e.stopPropagation()}>
        <Confetti />

        <div className="completion-burst">🏆</div>

        <h2 className="completion-title">
          {round === 1 ? '21 Ngày Hoàn Thành!' : `Vòng ${round} Hoàn Thành!`}
        </h2>
        <p className="completion-subtitle">
          Kỷ luật đã trở thành bản năng. Não bộ bạn đã định hình lại.<br />
          <strong style={{ color: 'var(--gold)' }}>Bạn không còn cần ý chí nữa.</strong>
        </p>

        {/* Stats */}
        <div className="completion-stats">
          <div className="completion-stat">
            <span className="completion-stat__num">{streak}</span>
            <span className="completion-stat__label">Ngày Streak</span>
          </div>
          <div className="completion-stat">
            <span className="completion-stat__num">{activeHabits.length}</span>
            <span className="completion-stat__label">Habits Duy Trì</span>
          </div>
          <div className="completion-stat">
            <span className="completion-stat__num">+{totalXp}</span>
            <span className="completion-stat__label">Tổng XP</span>
          </div>
          <div className="completion-stat">
            <span className="completion-stat__num">{round}</span>
            <span className="completion-stat__label">Vòng</span>
          </div>
        </div>

        {/* Habit chips */}
        {activeHabits.length > 0 && (
          <div className="completion-habits">
            {activeHabits.map(h => (
              <span key={h.id} className="completion-habit-chip">
                {h.icon} {h.name}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="completion-actions">
          <button
            ref={closeRef}
            className="btn btn-gold"
            onClick={handleNewRound}
            id="completion-new-round"
          >
            🔄 Bắt Đầu Vòng {round + 1}
          </button>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            id="completion-close"
          >
            Xem Kết Quả
          </button>
        </div>
      </div>
    </div>
  );
}

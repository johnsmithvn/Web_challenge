import { useEffect, useRef } from 'react';
import { useCustomHabits } from '../hooks/useCustomHabits';
import '../styles/completion.css';

const CONFETTI_COLORS = ['#ffd700', '#f97316', '#00ff88', '#8b5cf6', '#06b6d4', '#ec4899'];
const ROUND_KEY = 'vl_program_round';

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
 * CompletionModal — Certificate redesign.
 * Shown once when streak reaches 21.
 *
 * Props:
 *   streak        — current streak count
 *   totalXp       — total XP earned
 *   onRenew       — user chooses "Gia Hạn" (harder round, keep habits)
 *   onNewChallenge — user chooses "Thử Thách Mới" (conquer habits, start fresh)
 *   onClose       — dismiss without action
 */
export default function CompletionModal({ streak, totalXp, onRenew, onNewChallenge, onClose }) {
  const { activeHabits } = useCustomHabits();
  const round     = parseInt(localStorage.getItem(ROUND_KEY) || '1', 10);
  const closeRef  = useRef(null);
  const issuedAt  = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Focus trap + ESC close
  useEffect(() => {
    closeRef.current?.focus();
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleRenew = () => {
    localStorage.setItem(ROUND_KEY, String(round + 1));
    onRenew?.();
  };

  const handleNewChallenge = () => {
    localStorage.setItem(ROUND_KEY, String(round + 1));
    onNewChallenge?.();
  };

  return (
    <div className="completion-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Chứng nhận hoàn thành">
      <div className="completion-modal" onClick={e => e.stopPropagation()}>
        <Confetti />

        {/* ── Certificate header ── */}
        <div className="cert-header">
          <div className="cert-seal">🏅</div>
          <div className="cert-label">CHỨNG NHẬN CHINH PHỤC</div>
          <h2 className="completion-title" style={{ marginTop: '0.25rem' }}>
            {round === 1 ? '21 Ngày Hoàn Thành!' : `Vòng ${round} Hoàn Thành!`}
          </h2>
          <p className="cert-issued">Cấp ngày {issuedAt} · Vòng {round}</p>
        </div>

        {/* ── Subtitle ── */}
        <p className="completion-subtitle">
          Kỷ luật đã trở thành bản năng. Não bộ bạn đã định hình lại.<br />
          <strong style={{ color: 'var(--gold)' }}>Bạn không còn cần ý chí nữa.</strong>
        </p>

        {/* ── Stats ── */}
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

        {/* ── Conquered habits chips ── */}
        {activeHabits.length > 0 && (
          <div className="completion-habits">
            {activeHabits.map(h => (
              <span key={h.id} className="completion-habit-chip">
                {h.icon} {h.name}
              </span>
            ))}
          </div>
        )}

        {/* ── Divider ── */}
        <div className="cert-divider">
          <span>Bạn muốn làm gì tiếp theo?</span>
        </div>

        {/* ── 2 CTA options ── */}
        <div className="cert-options">
          {/* Option A: Renew — harder round */}
          <button
            ref={closeRef}
            className="cert-option cert-option--renew"
            onClick={handleRenew}
            id="completion-renew"
          >
            <div className="cert-option__icon">🔄</div>
            <div className="cert-option__text">
              <strong>Gia Hạn — Vòng {round + 1}</strong>
              <span>Tiếp tục với thói quen hiện tại<br />Vòng mới, thử thách cao hơn</span>
            </div>
          </button>

          {/* Option B: Start over with new challenge */}
          <button
            className="cert-option cert-option--new"
            onClick={handleNewChallenge}
            id="completion-new-challenge"
          >
            <div className="cert-option__icon">🌱</div>
            <div className="cert-option__text">
              <strong>Thử Thách Mới</strong>
              <span>Lưu thói quen vào "Đã Chinh Phục"<br />Bắt đầu hành trình hoàn toàn mới</span>
            </div>
          </button>
        </div>

        {/* Dismiss */}
        <button className="btn btn-ghost" onClick={onClose} id="completion-close"
          style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Xem lại sau
        </button>
      </div>
    </div>
  );
}

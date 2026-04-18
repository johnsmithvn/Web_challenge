import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { useState } from 'react';

const NUDGE_KEY = 'vl_login_nudge_shown';

/**
 * LoginNudgeModal — shown once after guest user completes day 1.
 * Encourages sign-up to save progress. Non-blocking.
 */
export default function LoginNudgeModal({ onClose }) {
  const { isAuthenticated } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const dismissRef = useRef(null);

  useEffect(() => {
    dismissRef.current?.focus();
    const handler = (e) => { if (e.key === 'Escape') handleDismiss(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(NUDGE_KEY, '1');
    onClose();
  };

  const handleSignUp = () => {
    setShowAuth(true);
  };

  // Auto-close if user logged in via modal
  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem(NUDGE_KEY, '1');
      onClose();
    }
  }, [isAuthenticated]);

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 1800, padding: '1.5rem',
          animation: 'fadeIn 0.3s ease',
        }}
        onClick={handleDismiss}
        role="dialog"
        aria-modal="true"
        aria-label="Lưu tiến độ"
      >
        <div
          style={{
            background: 'linear-gradient(145deg, #0d0d1a, #111130)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: '20px 20px 20px 20px',
            padding: '1.75rem',
            maxWidth: 440, width: '100%',
            animation: 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            boxShadow: '0 -8px 40px rgba(139,92,246,0.15)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '2rem' }}>💾</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-display)' }}>
                Lưu tiến độ Ngày 1 của bạn
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Đăng ký miễn phí — không mất data, không cần thẻ
              </div>
            </div>
          </div>

          {/* Value props */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
            {[
              ['✅', 'Streak của bạn được lưu vĩnh viễn'],
              ['👥', 'Tham gia Team Mode với đồng đội'],
              ['🏆', 'Xuất hiện trên Leaderboard'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleSignUp}
              id="nudge-signup"
            >
              🔑 Đăng Ký Ngay
            </button>
            <button
              ref={dismissRef}
              className="btn btn-ghost"
              style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}
              onClick={handleDismiss}
              id="nudge-dismiss"
            >
              Để sau
            </button>
          </div>
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useJourney } from '../hooks/useJourney';
import { useAuth } from '../contexts/AuthContext';
import ActiveJourneyPanel from '../components/journey/ActiveJourneyPanel';
import ProgramBrowser from '../components/journey/ProgramBrowser';
import JourneyHistory from '../components/journey/JourneyHistory';
import MyJourneys from '../components/journey/MyJourneys';
import CustomJourneyModal from '../components/journey/CustomJourneyModal';
import AuthModal from '../components/AuthModal';
import '../styles/journey.css';
import '../styles/auth.css';

const TABS = [
  { key: 'active',  label: '🗺 Đang Chạy' },
  { key: 'explore', label: '✨ Khám Phá'  },
  { key: 'mine',    label: '📂 Của Tôi'   },
  { key: 'history', label: '📜 Lịch Sử'  },
];

export default function JourneyPage() {
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const isFirstTime   = searchParams.get('firstTime') === 'true';
  const { isAuthenticated } = useAuth();
  const {
    activeJourney,
    journeyHistory,
    isLoading,
    startJourney,
    renewJourney,
    extendJourney,
    completeJourney,  // archived on quit
  } = useJourney();

  // default tab: "Đang Chạy" if active, else "Khám Phá"
  const [tab, setTab]                   = useState(activeJourney ? 'active' : 'explore');
  const [showCustomModal, setCustom]    = useState(false);
  const [starting, setStarting]         = useState(false);
  const [showAuth,  setShowAuth]        = useState(false);
  const [startSuccessMsg, setStartSuccessMsg] = useState('');

  // ── Handlers ───────────────────────────────────────────────
  const handleStart = async ({ title, programId, targetDays, description, habits }) => {
    if (!isAuthenticated) {
      setShowAuth(true);
      return;
    }
    setStarting(true);
    const j = await startJourney({ title, programId, targetDays, description, habits });
    setStarting(false);
    if (j) {
      setTab('active');
      // Brief nudge to visit Habits page
      setStartSuccessMsg(habits?.length
        ? `✅ Đã tạo lộ trình! ${habits.length} habits mới được thêm vào danh sách của bạn.`
        : '✅ Đã tạo lộ trình!');
      setTimeout(() => setStartSuccessMsg(''), 5000);
    }
  };

  const handleRenew = async () => {
    await renewJourney();
    setTab('active');
  };

  const handleComplete = async () => {
    await completeJourney();   // completes journey + closes habits
    setTab('explore');
  };

  const handleQuit = async () => {
    await completeJourney();   // archives with status=completed
    setTab('explore');
  };

  const handleExtend = async (days) => {
    await extendJourney(days);
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="journey-page">
      <div className="container">
        <div className="journey-page-inner">

          <div className="journey-page-header">
            <h1>🗺 Lộ Trình</h1>
            <p>Chọn và theo dõi hành trình chuyển đổi thói quen của bạn</p>
          </div>

          {/* First-time welcome banner (redirected here because no journey yet) */}
          {isFirstTime && (
            <div style={{
              padding: '1rem 1.25rem',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(6,182,212,0.08))',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '12px',
              marginBottom: '1.25rem',
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
            }}>
              <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🗺</span>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  Chào mừng! Hãy chọn lộ trình đầu tiên
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Mọi habit tick, focus session và tiến độ của bạn sẽ được gắn với lộ trình này.
                  Bạn có thể tự tạo hoặc chọn từ các template có sẵn bên dưới.
                </div>
              </div>
            </div>
          )}

          {/* Success toast */}
          {startSuccessMsg && (
            <div style={{
              padding: '0.85rem 1.1rem',
              background: 'rgba(0, 255, 136, 0.08)',
              border: '1px solid rgba(0, 255, 136, 0.25)',
              borderRadius: '10px',
              color: 'var(--green)',
              fontSize: '0.9rem',
              marginBottom: '1rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              {startSuccessMsg}
              <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '0.75rem' }}>
                → Vào <a href="/habits" style={{ color: 'var(--green)' }}>Habits</a> để bắt đầu tick
              </span>
            </div>
          )}

      {/* Tabs */}
      <div className="journey-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`journey-tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'active' && activeJourney && (
              <span style={{
                marginLeft: '0.4rem',
                background: 'rgba(139,92,246,0.35)',
                color: '#c4b5fd',
                fontSize: '0.7rem',
                padding: '0.1rem 0.4rem',
                borderRadius: '99px',
                fontWeight: 700,
              }}>
                LIVE
              </span>
            )}
            {t.key === 'history' && journeyHistory.length > 0 && (
              <span style={{
                marginLeft: '0.4rem',
                background: 'rgba(107,114,128,0.3)',
                color: '#9ca3af',
                fontSize: '0.7rem',
                padding: '0.1rem 0.4rem',
                borderRadius: '99px',
              }}>
                {journeyHistory.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          Đang tải...
        </div>
      )}

      {/* Tab: Đang Chạy */}
      {!isLoading && tab === 'active' && (
        activeJourney
          ? <ActiveJourneyPanel
              journey={activeJourney}
              onRenew={handleRenew}
              onExtend={handleExtend}
              onComplete={handleComplete}
              onQuit={handleQuit}
            />
          : <div className="journey-empty">
              <span className="journey-empty-icon">🗺</span>
              <h3>Bạn chưa có lộ trình nào đang chạy</h3>
              <p>Khám phá các lộ trình có sẵn hoặc tự tạo lộ trình riêng của bạn.</p>
              <button className="btn-journey-primary" onClick={() => setTab('explore')}>
                ✨ Khám Phá Lộ Trình
              </button>
            </div>
      )}

      {/* Tab: Khám Phá */}
      {!isLoading && tab === 'explore' && (
        <ProgramBrowser
          onStart={handleStart}
          onCustom={() => setCustom(true)}
          hasActiveJourney={!!activeJourney}
          starting={starting}
        />
      )}

      {/* Tab: Của Tôi */}
      {!isLoading && tab === 'mine' && (
        <MyJourneys
          history={journeyHistory}
          onRestart={handleStart}
          restarting={starting}
        />
      )}

      {/* Tab: Lịch Sử */}
      {!isLoading && tab === 'history' && (
        <JourneyHistory history={journeyHistory} />
      )}

      {/* Custom journey modal */}
      {showCustomModal && (
        <CustomJourneyModal
          onClose={() => setCustom(false)}
          onConfirm={async (data) => {
            setCustom(false);
            await handleStart({ ...data, programId: null });
          }}
          loading={starting}
        />
      )}

      {/* Auth modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

        </div> {/* end journey-page-inner */}
      </div> {/* end container */}
    </div>
  );
}

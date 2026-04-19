import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJourney } from '../hooks/useJourney';
import { useAuth } from '../contexts/AuthContext';
import ActiveJourneyPanel from '../components/journey/ActiveJourneyPanel';
import ProgramBrowser from '../components/journey/ProgramBrowser';
import JourneyHistory from '../components/journey/JourneyHistory';
import CustomJourneyModal from '../components/journey/CustomJourneyModal';
import AuthModal from '../components/AuthModal';
import '../styles/journey.css';
import '../styles/auth.css';

const TABS = [
  { key: 'active',  label: '🗺 Đang Chạy' },
  { key: 'explore', label: '✨ Khám Phá'  },
  { key: 'history', label: '📜 Lịch Sử'  },
];

export default function JourneyPage() {
  const navigate = useNavigate();
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

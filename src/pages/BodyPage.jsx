import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import { useWorkouts } from '../hooks/useWorkouts';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import OverviewScreen from '../components/body/OverviewScreen';
import RoutineScreen from '../components/body/RoutineScreen';
import LiveSessionScreen from '../components/body/LiveSessionScreen';
import WorkoutHistoryScreen from '../components/body/WorkoutHistoryScreen';
import BiometricsScreen from '../components/body/BiometricsScreen';
import NutritionScreen from '../components/body/NutritionScreen';
import MuscleMapScreen from '../components/body/MuscleMapScreen';
import ExerciseLibraryScreen from '../components/body/ExerciseLibraryScreen';
import '../styles/body.css';

const SCREENS = [
  { key: 'overview', label: 'Tổng quan', icon: 'chartDonut' },
  { key: 'routine', label: 'Lộ trình', icon: 'listChecks' },
  { key: 'session', label: 'Buổi tập', icon: 'barbell' },
  { key: 'history', label: 'Tiến bộ', icon: 'calendar' },
  { key: 'biometrics', label: 'Cơ thể', icon: 'user' },
  { key: 'nutrition', label: 'Dinh dưỡng', icon: 'bowlFood' },
  { key: 'muscles', label: 'Bản đồ cơ', icon: 'trophy' },
  { key: 'library', label: 'Thư viện bài', icon: 'book' }
];

export default function BodyPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { screen: routeScreen } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const {
    routines,
    activeRoutine,
    routineItems,
    sessions,
    recentSets,
    exerciseMap,
    routineTemplates,
    createRoutineFromTemplate,
    createCustomRoutine,
    switchRoutine,
    updateRoutineDetails,
    deleteRoutine,
    updateRoutineTarget,
    updateRoutineSets,
    addRoutineItem,
    deleteRoutineItem,
    toggleAutoProgress,
    applyProgression,
    startSession,
    logSet,
    finishSession,
    abandonSession
  } = useWorkouts();

  // Active sub-screen (default to overview)
  const currentScreen = SCREENS.some(s => s.key === routeScreen) ? routeScreen : 'overview';
  const setScreen = useCallback((target) => {
    navigate(`/body/${target}`);
  }, [navigate]);

  // Selected session to run
  const [activeSessionDay, setActiveSessionDay] = useState(null);
  const [currentSessionObj, setCurrentSessionObj] = useState(null);

  // Check for existing in-progress session in database
  const inProgressSession = sessions.find(s => s.status === 'in_progress');

  // Lock document body scroll on desktop (Workspace Pattern)
  useEffect(() => {
    document.body.classList.add('in-body-workspace');
    return () => {
      document.body.classList.remove('in-body-workspace');
    };
  }, []);

  const handleStartSession = useCallback(async (dayInfo) => {
    setActiveSessionDay(dayInfo);
    try {
      const sess = await startSession({
        plannedWeekday: dayInfo?.weekday || dayInfo?.day || 1,
        dayName: dayInfo?.name || 'Tập luyện',
        routineId: activeRoutine?.id,
        mode: 'straight'
      });
      setCurrentSessionObj({ ...sess, isResume: false });
      setScreen('session');
    } catch (err) {
      showToast?.('Không thể tạo buổi tập: ' + (err.message || 'Thử lại sau'), 'error');
    }
  }, [startSession, activeRoutine, showToast, setScreen]);

  const handleResumeSession = useCallback((session) => {
    setCurrentSessionObj({ ...session, isResume: true });
    setActiveSessionDay({
      day: session.planned_weekday || 1,
      weekday: session.planned_weekday || 1,
      name: session.day_type || session.title?.replace('Buổi ', '') || 'Tập luyện',
      isResume: true
    });
    setScreen('session');
  }, [setScreen]);

  const handleFinishSession = useCallback(async (results) => {
    try {
      if (currentSessionObj?.id) {
        await finishSession({
          sessionId: currentSessionObj.id,
          durationSeconds: results.elapsed,
          notes: ''
        });
      }
      if (results.approvedProgressions && results.approvedProgressions.length > 0) {
        await applyProgression(results.approvedProgressions);
      }
      if (results?.hasSaveError) {
        showToast?.('Buổi tập đã hoàn thành, nhưng có set chưa lưu được lên máy chủ.', 'warning');
      } else if (user) {
        showToast?.('Đã lưu buổi tập thành công vào cơ sở dữ liệu!', 'success');
      } else {
        showToast?.('Đã lưu vào bộ nhớ tạm (Đăng nhập để đồng bộ đám mây)', 'info');
      }
      setCurrentSessionObj(null);
      setScreen('history');
    } catch (err) {
      showToast?.('Lỗi khi lưu buổi tập: ' + (err.message || 'Thử lại sau'), 'error');
    }
  }, [currentSessionObj, finishSession, applyProgression, user, showToast, setScreen]);

  const handleCancelSession = useCallback(async () => {
    if (currentSessionObj?.id) {
      try {
        await abandonSession(currentSessionObj.id);
        showToast?.('Đã hủy buổi tập.', 'info');
      } catch (err) {
        showToast?.('Lỗi khi hủy buổi tập: ' + (err.message || 'Thử lại sau'), 'error');
      }
    }
    setCurrentSessionObj(null);
    setScreen('routine');
  }, [currentSessionObj, abandonSession, showToast, setScreen]);

  const [now] = useState(() => Date.now());
  const today = useMemo(() => new Date(now), [now]);
  const todayStr = useMemo(() => {
    return today.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
  }, [today]);

  const timeGreeting = useMemo(() => {
    const hr = today.getHours();
    if (hr < 12) return 'Sáng nay';
    if (hr < 18) return 'Chiều nay';
    return 'Tối nay';
  }, [today]);

  const isoWeek = useMemo(() => {
    const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }, [today]);

  const displayName = user?.user_metadata?.full_name?.split(' ').pop() || user?.email?.split('@')[0] || 'bạn';

  return (
    <div className="body-workspace">
      {/* ── HEADER GHIM TĨNH (CHỈ 1 HEADER DUY NHẤT CHUẨN PROTOTYPE 2A) ── */}
      <header className="body-header">
        <div className="body-header-left">
          {currentScreen === 'overview' ? (
            <div>
              <h1 className="body-header-title">{timeGreeting}, {displayName}</h1>
              <div className="body-header-sub">
                {todayStr} · tuần {isoWeek}
              </div>
            </div>
          ) : (
            <div>
              <h1 className="body-header-title">
                {SCREENS.find(s => s.key === currentScreen)?.label || 'Body'} · Sức Khỏe & Thể Hình
              </h1>
              <div className="body-header-sub">
                Kế hoạch · Tập luyện · Nhật ký · So sánh tiến bộ
              </div>
            </div>
          )}
        </div>

        {/* Sub-nav Tab Strip + Nút Ghi nhanh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="body-subnav">
            {SCREENS.map(s => {
              const isActive = currentScreen === s.key;
              return (
                <button
                  key={s.key}
                  className={`body-subnav-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setScreen(s.key)}
                >
                  <AppIcon name={s.icon} size={15} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {currentScreen === 'overview' && (
            <button
              type="button"
              className="body-header-quick-btn"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('body:open-quick-capture'));
              }}
              title="Ghi nhanh cân nặng hoặc dinh dưỡng"
            >
              <AppIcon name="plus" size={14} />
              <span>Ghi nhanh</span>
            </button>
          )}
        </div>
      </header>

      {/* ── MOBILE TOPBAR (52px CHUẨN PROTOTYPE) ────────────────────── */}
      <div className="body-mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="body-mobile-back-hub"
            onClick={() => navigate('/')}
            title="Về Life Hub"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--body-text-muted)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              padding: '4px',
              borderRadius: '8px'
            }}
          >
            <AppIcon name="sparkle" size={18} weight="fill" />
          </button>
          <AppIcon name="barbell" size={20} style={{ color: 'var(--body-accent)' }} />
          <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--body-text-main)', letterSpacing: '-0.02em' }}>
            Body
          </span>
          <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
            · {SCREENS.find(s => s.key === currentScreen)?.label || 'Tổng quan'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              background: 'none',
              border: '1px solid var(--body-card-border)',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--body-text-sub)',
              cursor: 'pointer'
            }}
            title="Đổi giao diện Sáng / Tối"
          >
            <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={15} weight="fill" />
          </button>
          <span style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--body-accent), #22D3EE)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 700
          }}>
            {(user?.user_metadata?.full_name || user?.email || 'M')[0].toUpperCase()}
          </span>
        </div>
      </div>

      {/* ── CONTENT SCROLL NỘI BỘ ────────────────────────────────── */}
      <main className={`body-content ${currentScreen === 'muscles' ? 'body-content-atlas' : ''}`}>
        {/* Mobile Pills cho nhóm màn Tập luyện */}
        {['routine', 'session', 'history', 'library'].includes(currentScreen) && (
          <div className="body-subnav-mobile-pills">
            {[
              { key: 'routine', label: 'Lộ trình' },
              { key: 'session', label: 'Buổi tập' },
              { key: 'history', label: 'Tiến bộ' },
              { key: 'library', label: 'Thư viện bài' }
            ].map(p => (
              <button
                key={p.key}
                className={`body-subnav-mobile-pill ${currentScreen === p.key ? 'active' : ''}`}
                onClick={() => setScreen(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        {currentScreen === 'overview' && (
          <OverviewScreen
            onNavigateTab={setScreen}
            onStartSession={handleStartSession}
          />
        )}

        {currentScreen === 'routine' && (
          <RoutineScreen
            routine={activeRoutine}
            routineItems={routineItems}
            routines={routines}
            routineTemplates={routineTemplates}
            sessions={sessions}
            recentSets={recentSets}
            onCreateRoutineFromTemplate={createRoutineFromTemplate}
            onCreateCustomRoutine={createCustomRoutine}
            onSwitchRoutine={switchRoutine}
            onUpdateRoutineDetails={updateRoutineDetails}
            onDeleteRoutine={deleteRoutine}
            onStartSession={handleStartSession}
            onUpdateTarget={updateRoutineTarget}
            onUpdateSets={updateRoutineSets}
            onAddExercise={addRoutineItem}
            onDeleteExercise={deleteRoutineItem}
            onToggleAutoProgress={toggleAutoProgress}
          />
        )}

        {currentScreen === 'session' && (
          currentSessionObj ? (
            <LiveSessionScreen
              dayInfo={activeSessionDay}
              routineItems={routineItems}
              recentSets={recentSets}
              exerciseMap={exerciseMap}
              sessionId={currentSessionObj.id}
              isResume={Boolean(currentSessionObj?.isResume || activeSessionDay?.isResume)}
              onLogSet={logSet}
              onFinishSession={handleFinishSession}
              onCancel={handleCancelSession}
            />
          ) : inProgressSession ? (
            <div className="body-card" style={{ maxWidth: '500px', margin: '40px auto', padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--body-accent-soft)', color: 'var(--body-accent)', display: 'grid', placeItems: 'center' }}>
                <AppIcon name="barbell" size={28} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Buổi tập chưa hoàn tất</h2>
              <p style={{ fontSize: '13.5px', color: 'var(--body-text-muted)', lineHeight: 1.5, margin: 0 }}>
                Bạn có một buổi <strong>{inProgressSession.title || inProgressSession.day_type || 'Tập luyện'}</strong> ({inProgressSession.local_date}) đang diễn ra dở dang.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  className="body-btn body-btn-danger"
                  onClick={async () => {
                    try {
                      await abandonSession(inProgressSession.id);
                      showToast?.('Đã hủy buổi tập cũ.', 'info');
                    } catch (err) {
                      showToast?.('Lỗi: ' + (err.message || 'Thử lại sau'), 'error');
                    }
                  }}
                >
                  Hủy buổi cũ
                </button>
                <button
                  className="body-btn body-btn-primary"
                  onClick={() => handleResumeSession(inProgressSession)}
                >
                  Tiếp tục tập
                </button>
              </div>
            </div>
          ) : (
            <div className="body-card" style={{ maxWidth: '480px', margin: '40px auto', padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--body-shell-bg)', color: 'var(--body-text-muted)', display: 'grid', placeItems: 'center' }}>
                <AppIcon name="barbell" size={28} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Chưa có buổi tập nào</h2>
              <p style={{ fontSize: '13.5px', color: 'var(--body-text-muted)', lineHeight: 1.5, margin: 0 }}>
                Hãy chọn một ngày trong Lộ trình để bắt đầu hoặc mở Tổng quan để xem buổi tập hôm nay.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button className="body-btn" onClick={() => setScreen('overview')}>
                  Về Tổng quan
                </button>
                <button className="body-btn body-btn-primary" onClick={() => setScreen('routine')}>
                  Mở Lộ trình
                </button>
              </div>
            </div>
          )
        )}

        {currentScreen === 'history' && (
          <WorkoutHistoryScreen
            sessions={sessions}
            recentSets={recentSets}
          />
        )}

        {currentScreen === 'biometrics' && (
          <BiometricsScreen />
        )}

        {currentScreen === 'nutrition' && (
          <NutritionScreen />
        )}

        {currentScreen === 'muscles' && (
          <MuscleMapScreen
            onSelectExercise={(ex) => {
              handleStartSession({ name: ex.name, singleExercise: ex, focus: ex.primary });
            }}
          />
        )}

        {currentScreen === 'library' && (
          <ExerciseLibraryScreen
            activeRoutine={activeRoutine}
            onStartExercise={(ex) => {
              handleStartSession({ name: ex.name, singleExercise: ex, focus: ex.primary });
            }}
            onAddToRoutine={async (payload) => {
              try {
                await addRoutineItem(payload);
                showToast?.('Đã thêm bài tập vào lộ trình thành công!', 'success');
              } catch (err) {
                showToast?.('Lỗi khi thêm bài tập: ' + (err.message || 'Thử lại sau'), 'error');
              }
            }}
          />
        )}
      </main>

      {/* ── MOBILE BOTTOM NAVIGATION (64px — 5 TABS CHUẨN DESIGN) ──── */}
      <nav className="body-mobile-bottom-nav">
        {[
          { key: 'overview', label: 'Tổng quan', icon: 'chartDonut', match: ['overview'] },
          { key: 'biometrics', label: 'Cơ thể', icon: 'user', match: ['biometrics'] },
          { key: 'muscles', label: 'Bản đồ cơ', icon: 'trophy', match: ['muscles'] },
          { key: 'routine', label: 'Tập', icon: 'barbell', match: ['routine', 'session', 'history', 'library'] },
          { key: 'nutrition', label: 'Ăn', icon: 'bowlFood', match: ['nutrition'] }
        ].map(tab => {
          const isActive = tab.match.includes(currentScreen);
          return (
            <button
              key={tab.key}
              className={`body-mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setScreen(tab.key)}
            >
              <AppIcon name={tab.icon} size={20} weight={isActive ? 'fill' : 'regular'} />
              <span className="body-mobile-nav-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

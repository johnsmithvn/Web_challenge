import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import { useWorkouts } from '../hooks/useWorkouts';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ConfirmModal } from '../components/ConfirmModal';
import SkeletonList from '../components/SkeletonList';
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
    hasLoaded,
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
    updateSetValue,
    finishSession,
    updateSession,
    abandonSession
  } = useWorkouts();

  // Active sub-screen: nếu routeScreen === 'session' thì giữ 'session', còn lại map theo SCREENS (mặc định 'overview')
  const isSessionRoute = routeScreen === 'session';
  const currentScreen = isSessionRoute
    ? 'session'
    : (SCREENS.some(s => s.key === routeScreen) ? routeScreen : 'overview');

  const setScreen = useCallback((target) => {
    navigate(`/body/${target}`);
  }, [navigate]);

  // Buổi đang dở (đang tập hoặc tạm dừng) — nguồn sự thật duy nhất là danh sách sessions của useWorkouts
  // (startSession/finish/abandon cập nhật optimistic nên đổi màn không phải chờ mạng)
  const liveSession = sessions.find(s => s.status === 'in_progress');
  // Thông tin ngày của buổi vừa bấm bắt đầu (có bài lẻ của buổi tự do), gắn với id buổi để không dùng nhầm cho buổi khác
  const [startedDay, setStartedDay] = useState(null);
  // Buổi mới đang chờ xác nhận vì còn 1 buổi dở (bắt đầu buổi mới sẽ hủy buổi đó)
  const [pendingStart, setPendingStart] = useState(null);

  // Dựng lại dayInfo cho buổi đang dở: buổi theo lịch dùng planned_weekday,
  // buổi tự do (tập lẻ 1 bài) lấy bài từ set đã ghi hoặc từ tên buổi.
  const buildResumeDayInfo = useCallback((session) => {
    const name = session.day_type || session.title?.replace('Buổi ', '') || 'Tập luyện';
    if (session.planned_weekday) {
      return { day: session.planned_weekday, weekday: session.planned_weekday, name };
    }
    const firstSet = recentSets.find(s => s.session_id === session.id);
    const ex = (firstSet && exerciseMap.get(firstSet.exercise_key))
      || Array.from(exerciseMap.values()).find(e => e.name === name);
    return ex ? { name: ex.name, singleExercise: ex, focus: ex.primary } : { name };
  }, [recentSets, exerciseMap]);

  const liveDayInfo = useMemo(() => {
    if (!liveSession) return null;
    return startedDay?.sessionId === liveSession.id ? startedDay.dayInfo : buildResumeDayInfo(liveSession);
  }, [liveSession, startedDay, buildResumeDayInfo]);

  // Bọc các thao tác ghi dữ liệu để lỗi luôn hiện toast (hook đã tự rollback state)
  const withToast = useCallback((fn, successMsg) => async (...args) => {
    try {
      const res = await fn(...args);
      if (successMsg) showToast?.(successMsg, 'success');
      return res;
    } catch (err) {
      showToast?.('Lỗi: ' + (err?.message || 'Không lưu được, thử lại sau'), 'error');
      return undefined;
    }
  }, [showToast]);

  // /body/session mà không còn buổi dở → về Lộ trình. Ngược lại, đang có buổi dở thì tab Lộ trình bị khóa và
  // chuyển hẳn sang màn tập: sửa/đổi lộ trình giữa buổi làm hàng đợi set lệch với các set đã ghi.
  useEffect(() => {
    if (!hasLoaded) return;
    if (routeScreen === 'session' && !liveSession) navigate('/body/routine', { replace: true });
    else if (routeScreen === 'routine' && liveSession) navigate('/body/session', { replace: true });
  }, [hasLoaded, routeScreen, liveSession, navigate]);

  // Lock document body scroll on desktop (Workspace Pattern)
  useEffect(() => {
    document.body.classList.add('in-body-workspace');
    return () => {
      document.body.classList.remove('in-body-workspace');
    };
  }, []);

  const doStartSession = useCallback(async (dayInfo) => {
    const isFree = Boolean(dayInfo?.singleExercise);
    try {
      const sess = await startSession({
        plannedWeekday: isFree ? null : (dayInfo?.weekday || dayInfo?.day || null),
        dayName: dayInfo?.name || 'Tập luyện',
        routineId: isFree ? null : (activeRoutine?.id || null),
        mode: 'straight'
      });
      setStartedDay({ sessionId: sess.id, dayInfo });
      setScreen('session');
    } catch (err) {
      showToast?.('Không thể tạo buổi tập: ' + (err.message || 'Thử lại sau'), 'error');
    }
  }, [startSession, activeRoutine, showToast, setScreen]);

  // Còn buổi dở (kể cả buổi đang tập ở tab khác) thì bắt đầu buổi mới sẽ hủy buổi đó → luôn hỏi trước
  const handleStartSession = useCallback((dayInfo) => {
    if (liveSession) {
      setPendingStart(dayInfo);
      return;
    }
    doStartSession(dayInfo);
  }, [liveSession, doStartSession]);

  const goToLive = useCallback(() => setScreen('session'), [setScreen]);

  const handleFinishSession = useCallback(async (results) => {
    try {
      const sId = liveSession?.id;
      if (sId) {
        await finishSession({
          sessionId: sId,
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
      setStartedDay(null);
      setScreen('history');
    } catch (err) {
      showToast?.('Lỗi khi lưu buổi tập: ' + (err.message || 'Thử lại sau'), 'error');
    }
  }, [liveSession, finishSession, applyProgression, user, showToast, setScreen]);

  const handleCancelSession = useCallback(async () => {
    const sId = liveSession?.id;
    if (sId) {
      try {
        await abandonSession(sId);
        showToast?.('Đã hủy buổi tập.', 'info');
      } catch (err) {
        showToast?.('Lỗi khi hủy buổi tập: ' + (err.message || 'Thử lại sau'), 'error');
      }
    }
    setStartedDay(null);
    setScreen('routine');
  }, [liveSession, abandonSession, showToast, setScreen]);

  // Tạm dừng = rời màn tập và chốt thời lượng; buổi vẫn dở nên tab Tập vẫn mở lại đúng buổi này
  const handlePauseSession = useCallback(async (elapsedSeconds) => {
    const sId = liveSession?.id;
    if (sId && elapsedSeconds != null) {
      try {
        await updateSession(sId, { duration_seconds: elapsedSeconds });
      } catch {
        // Không lưu được thời lượng thì vẫn cho tạm dừng; set đã ghi vẫn còn
      }
    }
    showToast?.('Đã tạm dừng. Mở tab Tập để tập tiếp.', 'info');
    setScreen('overview');
  }, [liveSession, updateSession, setScreen, showToast]);

  const handleModeLocked = useCallback((mode) => {
    const sId = liveSession?.id;
    if (sId) updateSession(sId, { mode }).catch(() => {});
  }, [liveSession, updateSession]);

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
          {/* Tiêu đề 1 dòng, cắt "…" khi hẹp — trước đây chữ dài xuống 3–4 dòng tràn khỏi header 68px */}
          {currentScreen === 'overview' ? (
            <div style={{ minWidth: 0 }}>
              <h1 className="body-header-title">{timeGreeting}, {displayName}</h1>
              <div className="body-header-sub">
                {todayStr} · tuần {isoWeek}
              </div>
            </div>
          ) : currentScreen === 'session' ? (
            <div style={{ minWidth: 0 }}>
              <h1 className="body-header-title">{liveSession?.title || 'Buổi tập'}</h1>
              <div className="body-header-sub">Đang tập</div>
            </div>
          ) : (
            <div style={{ minWidth: 0 }}>
              <h1 className="body-header-title">{SCREENS.find(s => s.key === currentScreen)?.label || 'Body'}</h1>
              <div className="body-header-sub">Sức khỏe & thể hình</div>
            </div>
          )}
        </div>

        {/* Sub-nav Tab Strip (tab Lộ trình thành "Đang tập" khi có buổi dở) + Nút Ghi nhanh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div className="body-subnav">
            {SCREENS.map(s => {
              // Đang có buổi dở: tab Lộ trình khóa lại, thay bằng lối vào màn tập
              const isLiveTab = s.key === 'routine' && liveSession;
              const isActive = currentScreen === s.key || (isLiveTab && currentScreen === 'session');
              return (
                <button
                  key={s.key}
                  className={`body-subnav-btn ${isActive ? 'active' : ''} ${isLiveTab ? 'is-live' : ''}`}
                  onClick={() => setScreen(isLiveTab ? 'session' : s.key)}
                  title={isLiveTab ? 'Quay lại buổi tập đang dở' : undefined}
                >
                  <AppIcon name={isLiveTab ? 'barbell' : s.icon} size={15} />
                  <span>{isLiveTab ? 'Đang tập' : s.label}</span>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
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
          <span style={{ fontSize: '12px', color: 'var(--body-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
            · {currentScreen === 'session' ? 'Chế độ tập' : (SCREENS.find(s => s.key === currentScreen)?.label || 'Tổng quan')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 'none' }}>
          {liveSession && currentScreen !== 'session' && (
            <button
              type="button"
              onClick={goToLive}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                height: '30px',
                padding: '0 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: '#DC2626',
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              <AppIcon name="barbell" size={13} />
              <span>Đang tập</span>
            </button>
          )}

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
        {['routine', 'history', 'library'].includes(currentScreen) && (
          <div className="body-subnav-mobile-pills">
            {[
              liveSession ? { key: 'session', label: 'Đang tập' } : { key: 'routine', label: 'Lộ trình' },
              { key: 'history', label: 'Tiến bộ' },
              { key: 'library', label: 'Thư viện' }
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
            activeRoutine={activeRoutine}
            routineItems={routineItems}
            sessions={sessions}
            recentSets={recentSets}
            exerciseMap={exerciseMap}
            workoutsLoaded={hasLoaded}
            onNavigateTab={setScreen}
            onStartSession={handleStartSession}
          />
        )}

        {/* Lộ trình & Tiến bộ đọc thẳng dữ liệu của useWorkouts — chưa tải xong thì chưa biết có gì. */}
        {['routine', 'history', 'session'].includes(currentScreen) && !hasLoaded && (
          <SkeletonList heading rows={4} gap="10px" label="Đang tải buổi tập" />
        )}

        {/* Có buổi dở thì không vẽ Lộ trình (effect phía trên chuyển sang màn tập) */}
        {currentScreen === 'routine' && hasLoaded && !liveSession && (
          <RoutineScreen
            routine={activeRoutine}
            routineItems={routineItems}
            routines={routines}
            routineTemplates={routineTemplates}
            sessions={sessions}
            onResumeSession={goToLive}
            recentSets={recentSets}
            onCreateRoutineFromTemplate={withToast(createRoutineFromTemplate, 'Đã tạo lộ trình mới.')}
            onCreateCustomRoutine={withToast(createCustomRoutine, 'Đã tạo lộ trình mới.')}
            onSwitchRoutine={withToast(switchRoutine)}
            onUpdateRoutineDetails={withToast(updateRoutineDetails, 'Đã lưu lộ trình.')}
            onDeleteRoutine={withToast(deleteRoutine, 'Đã xóa lộ trình.')}
            onStartSession={handleStartSession}
            onUpdateTarget={withToast(updateRoutineTarget)}
            onUpdateSets={withToast(updateRoutineSets)}
            onAddExercise={withToast(addRoutineItem)}
            onDeleteExercise={withToast(deleteRoutineItem)}
            onToggleAutoProgress={withToast(toggleAutoProgress)}
          />
        )}

        {/* Màn tập luôn mount lại từ dữ liệu (set đã ghi, mốc giờ) nên rời đi rồi quay lại vẫn đúng chỗ đang tập */}
        {currentScreen === 'session' && hasLoaded && liveSession && (
          <LiveSessionScreen
            key={liveSession.id}
            dayInfo={liveDayInfo}
            routineItems={routineItems}
            recentSets={recentSets}
            exerciseMap={exerciseMap}
            sessionId={liveSession.id}
            initialMode={liveSession.mode}
            initialElapsed={liveSession.duration_seconds || 0}
            startedAt={liveSession.started_at}
            onLogSet={logSet}
            onUpdateSet={updateSetValue}
            onModeLocked={handleModeLocked}
            onFinishSession={handleFinishSession}
            onCancel={handleCancelSession}
            onPause={handlePauseSession}
          />
        )}

        {currentScreen === 'history' && hasLoaded && (
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
            routineLocked={Boolean(liveSession)}
            onStartExercise={(ex) => {
              handleStartSession({ name: ex.name, singleExercise: ex, focus: ex.primary });
            }}
            onAddToRoutine={async (payload) => {
              if (liveSession) {
                showToast?.('Đang có buổi tập dở — kết thúc buổi rồi hãy sửa lộ trình.', 'warning');
                return;
              }
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

      <ConfirmModal
        open={Boolean(pendingStart)}
        title="Bắt đầu buổi tập mới?"
        message={`Bạn đang có buổi "${liveSession?.title || liveSession?.day_type || 'tập'}" chưa xong. Bắt đầu buổi mới sẽ hủy buổi đó (các set đã ghi vẫn được giữ trong lịch sử).`}
        confirmLabel="Hủy buổi cũ & bắt đầu"
        cancelLabel="Giữ buổi cũ"
        danger
        onConfirm={() => {
          const next = pendingStart;
          setPendingStart(null);
          doStartSession(next);
        }}
        onCancel={() => setPendingStart(null)}
      />

      {/* ── MOBILE BOTTOM NAVIGATION (64px — 5 TABS CHUẨN DESIGN) ──── */}
      <nav className="body-mobile-bottom-nav">
        {[
          { key: 'overview', label: 'Tổng quan', icon: 'chartDonut', match: ['overview'] },
          { key: 'biometrics', label: 'Cơ thể', icon: 'user', match: ['biometrics'] },
          { key: 'muscles', label: 'Bản đồ cơ', icon: 'trophy', match: ['muscles'] },
          // Có buổi dở: tab Tập mở thẳng màn tập (lộ trình bị khóa tới khi xong/hủy buổi)
          liveSession
            ? { key: 'session', label: 'Đang tập', icon: 'barbell', match: ['routine', 'session', 'history', 'library'], live: true }
            : { key: 'routine', label: 'Tập', icon: 'barbell', match: ['routine', 'session', 'history', 'library'] },
          { key: 'nutrition', label: 'Ăn', icon: 'bowlFood', match: ['nutrition'] }
        ].map(tab => {
          const isActive = tab.match.includes(currentScreen);
          return (
            <button
              key={tab.key}
              className={`body-mobile-nav-item ${isActive ? 'active' : ''} ${tab.live ? 'is-live' : ''}`}
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

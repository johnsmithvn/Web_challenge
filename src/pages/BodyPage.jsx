import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import { useWorkouts } from '../hooks/useWorkouts';
import { splitDayName, deloadTarget } from '../utils/workoutLogic';
import { toDateStr } from '../utils/dateUtils';
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
  { key: 'overview', label: 'Tổng quan', icon: 'gauge' },
  { key: 'routine', label: 'Lộ trình', icon: 'listChecks' },
  { key: 'history', label: 'Tiến bộ', icon: 'chartBar' },
  { key: 'biometrics', label: 'Cơ thể', icon: 'user' },
  { key: 'nutrition', label: 'Dinh dưỡng', icon: 'bowlFood' },
  { key: 'muscles', label: 'Bản đồ cơ', icon: 'personSimple' },
  { key: 'library', label: 'Thư viện bài', icon: 'books' }
];

const mmss = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

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
    createCustomRoutine,
    switchRoutine,
    updateRoutineDetails,
    deleteRoutine,
    updateRoutineTarget,
    updateRoutineSets,
    updateRoutineRest,
    updateRoutineUnit,
    reorderRoutineItems,
    addRoutineItem,
    deleteRoutineItem,
    toggleAutoProgress,
    applyProgression,
    loadSessionSets,
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

  // Selected session to run
  const [activeSessionDay, setActiveSessionDay] = useState(null);
  const [currentSessionObj, setCurrentSessionObj] = useState(null);
  // Buổi mới đang chờ xác nhận vì còn 1 buổi tạm dừng (bắt đầu buổi mới sẽ hủy buổi đó)
  const [pendingStart, setPendingStart] = useState(null);

  // Check for existing in-progress session in database
  const inProgressSession = sessions.find(s => s.status === 'in_progress');

  // Dựng lại dayInfo cho buổi đang dở: buổi theo lịch dùng planned_weekday,
  // buổi tự do (tập lẻ 1 bài) lấy bài từ set đã ghi hoặc từ tên buổi.
  const buildResumeDayInfo = useCallback((session) => {
    const name = session.day_type || session.title?.replace('Buổi ', '') || 'Tập luyện';
    if (session.planned_weekday) {
      return { day: session.planned_weekday, weekday: session.planned_weekday, name, isResume: true };
    }
    const firstSet = recentSets.find(s => s.session_id === session.id);
    const ex = (firstSet && exerciseMap.get(firstSet.exercise_key))
      || Array.from(exerciseMap.values()).find(e => e.name === name);
    return ex ? { name: ex.name, singleExercise: ex, focus: ex.primary, isResume: true } : { name, isResume: true };
  }, [recentSets, exerciseMap]);

  // Effective session & dayInfo (tự động fallback về inProgressSession nếu có)
  const effectiveSession = currentSessionObj || inProgressSession;
  const effectiveDayInfo = useMemo(
    () => activeSessionDay || (inProgressSession ? buildResumeDayInfo(inProgressSession) : null),
    [activeSessionDay, inProgressSession, buildResumeDayInfo]
  );

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

  // Bắt đầu chu kỳ mới cho lộ trình đang theo (hết N tuần); deload thì hạ mục tiêu mọi bài ~20% trước
  const handleRestartCycle = useCallback(async ({ deload = false } = {}) => {
    if (!activeRoutine?.id) return;
    if (deload) {
      await applyProgression(routineItems.map(it => ({
        routineItemId: it.id,
        nextTargetVal: deloadTarget(it.target_val, it.unit)
      })));
    }
    await updateRoutineDetails(activeRoutine.id, { start_date: toDateStr(new Date()) });
  }, [activeRoutine, routineItems, applyProgression, updateRoutineDetails]);

  // Tự động chuyển về Lộ trình nếu người dùng truy cập /body/session mà không có phiên tập nào đang diễn ra (chỉ sau khi dữ liệu đã tải).
  // Khi chủ động rời màn tập (lưu / hủy / tạm dừng) thì bỏ qua: React Router 7 chạy điều hướng như transition,
  // state buổi tập bị xóa trước khi route đổi → nếu không chặn, lệnh này ghi đè lên trang đích (vd Tiến bộ).
  const leavingSessionRef = useRef(false);
  useEffect(() => {
    if (routeScreen !== 'session') {
      leavingSessionRef.current = false;
      return;
    }
    if (hasLoaded && !effectiveSession && !leavingSessionRef.current) {
      navigate('/body/routine', { replace: true });
    }
  }, [hasLoaded, routeScreen, effectiveSession, navigate]);

  // Lock document body scroll on desktop (Workspace Pattern)
  useEffect(() => {
    document.body.classList.add('in-body-workspace');
    return () => {
      document.body.classList.remove('in-body-workspace');
    };
  }, []);

  const doStartSession = useCallback(async (dayInfo) => {
    const isFree = Boolean(dayInfo?.singleExercise);
    setActiveSessionDay(dayInfo);
    try {
      const sess = await startSession({
        plannedWeekday: isFree ? null : (dayInfo?.weekday || dayInfo?.day || null),
        dayName: dayInfo?.name || 'Tập luyện',
        routineId: isFree ? null : (activeRoutine?.id || null),
        mode: 'straight'
      });
      setCurrentSessionObj({ ...sess, isResume: false });
      setScreen('session');
    } catch (err) {
      showToast?.('Không thể tạo buổi tập: ' + (err.message || 'Thử lại sau'), 'error');
    }
  }, [startSession, activeRoutine, showToast, setScreen]);

  // Bắt đầu buổi mới khi còn buổi đang tạm dừng sẽ hủy buổi đó → hỏi trước
  const handleStartSession = useCallback((dayInfo) => {
    if (inProgressSession && inProgressSession.id !== currentSessionObj?.id) {
      setPendingStart(dayInfo);
      return;
    }
    doStartSession(dayInfo);
  }, [inProgressSession, currentSessionObj, doStartSession]);

  const handleResumeSession = useCallback((session) => {
    setCurrentSessionObj({ ...session, isResume: true });
    setActiveSessionDay(buildResumeDayInfo(session));
    setScreen('session');
  }, [setScreen, buildResumeDayInfo]);

  // Tải lại trang giữa buổi thì chưa có currentSessionObj (màn tập lấy inProgressSession). Lưu / hủy đổi status
  // optimistic → inProgressSession biến mất giữa lúc chờ mạng → màn tập bị gỡ và effect đẩy về Lộ trình.
  // Ghim buổi + dayInfo lại trước khi ghi để màn tập (kể cả danh sách bài ở màn kết quả) giữ nguyên tới khi chủ động rời.
  const pinSession = useCallback(() => {
    if (currentSessionObj || !inProgressSession) return;
    setCurrentSessionObj({ ...inProgressSession, isResume: true });
    setActiveSessionDay(effectiveDayInfo);
  }, [currentSessionObj, inProgressSession, effectiveDayInfo]);

  const handleFinishSession = useCallback(async (results) => {
    pinSession();
    try {
      const sId = currentSessionObj?.id || inProgressSession?.id;
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
      leavingSessionRef.current = true;
      setCurrentSessionObj(null);
      setActiveSessionDay(null);
      setScreen('history');
    } catch (err) {
      showToast?.('Lỗi khi lưu buổi tập: ' + (err.message || 'Thử lại sau'), 'error');
    }
  }, [pinSession, currentSessionObj, inProgressSession, finishSession, applyProgression, user, showToast, setScreen]);

  const handleCancelSession = useCallback(async () => {
    pinSession();
    const sId = currentSessionObj?.id || inProgressSession?.id;
    if (sId) {
      try {
        await abandonSession(sId);
        showToast?.('Đã hủy buổi tập.', 'info');
      } catch (err) {
        showToast?.('Lỗi khi hủy buổi tập: ' + (err.message || 'Thử lại sau'), 'error');
      }
    }
    leavingSessionRef.current = true;
    setCurrentSessionObj(null);
    setActiveSessionDay(null);
    setScreen('routine');
  }, [pinSession, currentSessionObj, inProgressSession, abandonSession, showToast, setScreen]);

  const handlePauseSession = useCallback(async (elapsedSeconds) => {
    const sId = currentSessionObj?.id || inProgressSession?.id;
    if (sId && elapsedSeconds != null) {
      try {
        await updateSession(sId, { duration_seconds: elapsedSeconds });
      } catch {
        // Không lưu được thời lượng thì vẫn cho tạm dừng; set đã ghi vẫn còn
      }
    }
    leavingSessionRef.current = true;
    setCurrentSessionObj(null);
    setActiveSessionDay(null);
    showToast?.('Đã tạm dừng buổi tập. Bạn có thể tiếp tục bất cứ lúc nào!', 'info');
    setScreen('routine');
  }, [currentSessionObj, inProgressSession, updateSession, setScreen, showToast]);

  const handleModeLocked = useCallback((mode) => {
    const sId = currentSessionObj?.id || inProgressSession?.id;
    if (sId) updateSession(sId, { mode }).catch(() => {});
  }, [currentSessionObj, inProgressSession, updateSession]);

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

  // Màn tập tách khỏi điều hướng Body: không header/tab, header mobile — LiveSessionScreen tự có header
  const isSession = currentScreen === 'session';
  const screenLabel = SCREENS.find(s => s.key === currentScreen)?.label || 'Body';

  // Đang tập: ẩn luôn sidebar chung của Life Hub (màn tập chiếm trọn màn hình)
  useEffect(() => {
    if (!isSession) return undefined;
    document.body.classList.add('in-body-session');
    return () => document.body.classList.remove('in-body-session');
  }, [isSession]);

  // Pill "Buổi dở": tên buổi + số set đã ghi / tổng set theo lịch + thời lượng đã lưu
  const liveSession = currentSessionObj || inProgressSession;
  const liveInfo = useMemo(() => {
    if (!liveSession) return null;
    const weekday = Number(liveSession.planned_weekday) || null;
    const total = weekday
      ? routineItems.filter(it => it.weekday === weekday).reduce((sum, it) => sum + (Number(it.target_sets) || 0), 0)
      : 0;
    const done = recentSets.filter(s => s.session_id === liveSession.id).length;
    const day = splitDayName(liveSession.day_type || String(liveSession.title || '').replace(/^Buổi\s+/, ''));
    return {
      name: day.tag || day.title || 'Buổi tập',
      meta: [total ? `${done}/${total} set` : `${done} set`, liveSession.duration_seconds ? mmss(liveSession.duration_seconds) : null]
        .filter(Boolean).join(' · ')
    };
  }, [liveSession, routineItems, recentSets]);

  const resumeLive = useCallback(() => {
    if (currentSessionObj) setScreen('session');
    else if (inProgressSession) handleResumeSession(inProgressSession);
  }, [currentSessionObj, inProgressSession, setScreen, handleResumeSession]);

  // Mobile: chip tab đang chọn luôn nằm trong tầm nhìn khi đổi màn
  const mobileTabsRef = useRef(null);
  useEffect(() => {
    const el = mobileTabsRef.current?.querySelector('[aria-current="page"]');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [currentScreen]);

  const monthSessionCount = useMemo(() => {
    const prefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    return sessions.filter(s => s.status === 'completed' && String(s.local_date || '').startsWith(prefix)).length;
  }, [sessions, today]);
  const mobileSub = currentScreen === 'overview'
    ? todayStr
    : currentScreen === 'history'
      ? `${monthSessionCount} buổi đã tập tháng này`
      : null;

  return (
    <div className="body-workspace">
      {/* ── HEADER DESKTOP ─────────────────────────────────────────── */}
      {!isSession && (
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
              <h1 className="body-header-title">{screenLabel}<span className="body-header-suffix"> · Sức Khỏe & Thể Hình</span></h1>
              <div className="body-header-sub">
                Kế hoạch · Tập luyện · Nhật ký · So sánh tiến bộ
              </div>
            </div>
          )}
        </div>

        <div className="body-header-right">
          {liveInfo && (
            <button type="button" className="body-live-pill" onClick={resumeLive} title="Quay lại buổi tập đang dở">
              <i />
              <span className="body-live-pill-text">
                <b>Buổi dở · {liveInfo.name}</b>
                <small>{liveInfo.meta}</small>
              </span>
              <span className="body-live-pill-btn"><AppIcon name="play" size={11} weight="fill" />Tiếp tục</span>
            </button>
          )}

          <nav className="body-subnav" aria-label="Màn Body">
            {SCREENS.map(s => {
              const isActive = currentScreen === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  className={`body-subnav-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setScreen(s.key)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <AppIcon name={s.icon} size={14} weight={isActive ? 'fill' : 'regular'} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </nav>

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
      )}

      {/* ── HEADER MOBILE: tiêu đề + dải chip tab (thay topbar + bottom nav cũ) ── */}
      {!isSession && (
      <div className="body-mhead">
        <div className="body-mhead-row">
          <button type="button" className="body-mhead-icon" onClick={() => navigate('/')} aria-label="Về Life Hub" title="Về Life Hub">
            <AppIcon name="sparkle" size={17} weight="fill" />
          </button>
          <div className="body-mhead-titles">
            <span className="body-mhead-title">{screenLabel}</span>
            {mobileSub && <span className="body-mhead-sub">{mobileSub}</span>}
          </div>
          {liveInfo && (
            <button type="button" className="body-mhead-live" onClick={resumeLive} aria-label={`Tiếp tục buổi dở ${liveInfo.name}`}>
              <i />
              <span>{liveInfo.meta || 'Đang tập'}</span>
              <AppIcon name="play" size={11} weight="fill" />
            </button>
          )}
          {currentScreen === 'biometrics' && (
            <button
              type="button"
              className="body-mhead-icon is-dark"
              onClick={() => window.dispatchEvent(new CustomEvent('body:add-measurement'))}
              aria-label="Thêm cân đo"
              title="Thêm cân đo"
            >
              <AppIcon name="plus" size={17} />
            </button>
          )}
          {currentScreen === 'overview' && (
            <button
              type="button"
              className="body-mhead-icon is-dark"
              onClick={() => window.dispatchEvent(new CustomEvent('body:open-quick-capture'))}
              aria-label="Ghi nhanh"
              title="Ghi nhanh"
            >
              <AppIcon name="plus" size={17} />
            </button>
          )}
          <button type="button" className="body-mhead-icon" onClick={toggleTheme} aria-label="Đổi giao diện sáng / tối">
            <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={16} weight="fill" />
          </button>
        </div>
        <nav className="body-mhead-tabs" ref={mobileTabsRef} aria-label="Màn Body">
          {SCREENS.map(s => {
            const isActive = currentScreen === s.key;
            return (
              <button
                key={s.key}
                type="button"
                className={isActive ? 'is-on' : ''}
                onClick={() => setScreen(s.key)}
                aria-current={isActive ? 'page' : undefined}
              >
                <AppIcon name={s.icon} size={13} weight={isActive ? 'fill' : 'regular'} />
                {s.label}
              </button>
            );
          })}
        </nav>
      </div>
      )}

      {/* ── CONTENT SCROLL NỘI BỘ ────────────────────────────────── */}
      <main className={`body-content${currentScreen === 'muscles' ? ' body-content-atlas' : ''}${isSession ? ' body-content-session' : ''}`}>
        {currentScreen === 'overview' && (
          <OverviewScreen
            onNavigateTab={setScreen}
            onStartSession={handleStartSession}
          />
        )}

        {/* Lộ trình & Tiến bộ đọc thẳng dữ liệu của useWorkouts — chưa tải xong thì chưa biết có gì. */}
        {['routine', 'history'].includes(currentScreen) && !hasLoaded && (
          <SkeletonList heading rows={4} gap="10px" label="Đang tải buổi tập" />
        )}

        {currentScreen === 'routine' && hasLoaded && (
          <RoutineScreen
            routine={activeRoutine}
            exerciseMap={exerciseMap}
            routineItems={routineItems}
            routines={routines}
            routineTemplates={routineTemplates}
            sessions={sessions}
            activeSession={effectiveSession}
            onResumeSession={handleResumeSession}
            recentSets={recentSets}
            onCreateCustomRoutine={withToast(createCustomRoutine, 'Đã tạo lộ trình mới.')}
            onSwitchRoutine={withToast(switchRoutine)}
            onUpdateRoutineDetails={withToast(updateRoutineDetails, 'Đã lưu lộ trình.')}
            onDeleteRoutine={withToast(deleteRoutine, 'Đã xóa lộ trình.')}
            onStartSession={handleStartSession}
            onUpdateTarget={withToast(updateRoutineTarget)}
            onUpdateSets={withToast(updateRoutineSets)}
            onUpdateRest={withToast(updateRoutineRest)}
            onUpdateUnit={withToast(updateRoutineUnit)}
            onReorderItems={withToast(reorderRoutineItems)}
            onNavigate={setScreen}
            onAddExercise={withToast(addRoutineItem)}
            onDeleteExercise={withToast(deleteRoutineItem)}
            onToggleAutoProgress={withToast(toggleAutoProgress)}
            onLoadCycleSets={withToast(loadSessionSets)}
            onRestartCycle={withToast(handleRestartCycle, 'Đã bắt đầu chu kỳ mới.')}
          />
        )}

        {currentScreen === 'session' && effectiveSession && !hasLoaded && (
          <div className="body-card" style={{ maxWidth: '480px', margin: '40px auto', padding: '32px', textAlign: 'center', color: 'var(--body-text-muted)' }}>
            Đang tải buổi tập…
          </div>
        )}

        {currentScreen === 'session' && (!effectiveSession || hasLoaded) && (
          effectiveSession ? (
            <LiveSessionScreen
              key={effectiveSession.id}
              dayInfo={effectiveDayInfo}
              routineItems={routineItems}
              recentSets={recentSets}
              exerciseMap={exerciseMap}
              sessionId={effectiveSession.id}
              isResume={Boolean(effectiveSession.isResume || effectiveDayInfo?.isResume)}
              initialMode={effectiveSession.mode}
              autoProgress={activeRoutine?.auto_progress ?? true}
              initialElapsed={effectiveSession.duration_seconds || 0}
              startedAt={effectiveSession.started_at}
              onLogSet={logSet}
              onUpdateSet={updateSetValue}
              onModeLocked={handleModeLocked}
              onFinishSession={handleFinishSession}
              onCancel={handleCancelSession}
              onPause={handlePauseSession}
            />
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

        {currentScreen === 'history' && hasLoaded && (
          <WorkoutHistoryScreen
            sessions={sessions}
            routineItems={routineItems}
            exerciseMap={exerciseMap}
            recentSets={recentSets}
            onNavigate={setScreen}
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
            routineItems={routineItems}
            exerciseMap={exerciseMap}
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

      <ConfirmModal
        open={Boolean(pendingStart)}
        title="Bắt đầu buổi tập mới?"
        message={`Bạn đang có buổi "${inProgressSession?.title || inProgressSession?.day_type || 'tập'}" tạm dừng. Bắt đầu buổi mới sẽ hủy buổi đó (các set đã ghi vẫn được giữ trong lịch sử).`}
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

    </div>
  );
}

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AppIcon from '../AppIcon';
import BASE_EXERCISES from '../../data/body-exercises.json';
import ExerciseVideoPlayer from './ExerciseVideoPlayer';
import {
  generateWorkoutQueue,
  formatValWithUnit,
  checkAutoProgression,
  detectPR,
  compareSessionWithPrevious
} from '../../utils/workoutLogic';

export default function LiveSessionScreen({
  dayInfo,
  routineItems = [],
  recentSets = [],
  exerciseMap = new Map(),
  sessionId,
  isResume = false,
  onLogSet,
  onFinishSession,
  onCancel
}) {
  const [mode, setMode] = useState('straight');
  const [screenState, setScreenState] = useState('guide'); // 'guide' | 'set' | 'rest' | 'done'
  const [curQueueIdx, setCurQueueIdx] = useState(0);
  const [logs, setLogs] = useState({}); // { [exKey]: [val1, val2...] }
  const [loggedSets, setLoggedSets] = useState([]); // array of set records
  const [elapsed, setElapsed] = useState(0);
  const [approvedProgressions, setApprovedProgressions] = useState({});
  const [saveError, setSaveError] = useState(null);
  const hasRestoredRef = useRef(false);

  // Wall-clock timers for drift resistance (background tabs / mobile lock)
  const sessionStartTimeRef = useRef(Date.now());
  const restEndRef = useRef(null);
  const plankStartTimeRef = useRef(null);

  const [restRemaining, setRestRemaining] = useState(0);
  const [restTotal, setRestTotal] = useState(60);

  const [tSec, setTSec] = useState(0);
  const [tRunning, setTRunning] = useState(false);

  // Input rep value
  const [currentVal, setCurrentVal] = useState(15);

  // 1. Freeze / snapshot the day items once when session starts
  const dayItems = useMemo(() => {
    if (dayInfo?.singleExercise) {
      const ex = dayInfo.singleExercise;
      return [{
        id: 'single-custom-item',
        exercise_key: ex.key || ex.id,
        name: ex.name,
        target_sets: ex.defaultSets || 3,
        target_val: ex.defaultTarget || 10,
        unit: ex.metric || 'rep',
        kg: ex.defaultKg || 0,
        rest_seconds: 60
      }];
    }
    const weekday = dayInfo?.weekday || dayInfo?.day || 2;
    return routineItems.filter(item => item.weekday === weekday);
  }, [dayInfo, routineItems]);

  // 2. Build the exercise queue based on mode
  const queue = useMemo(() => {
    return generateWorkoutQueue(dayItems, mode);
  }, [dayItems, mode]);

  const currentItem = queue[curQueueIdx] || queue[0];

  // Resolve exercise definition from map or fallback
  const exDef = useMemo(() => {
    if (!currentItem) return null;
    const found = exerciseMap.get(currentItem.exercise_key)
      || BASE_EXERCISES.find(e => e.key === currentItem.exercise_key);
    return found || {
      name: currentItem.name || currentItem.exercise_key,
      primary: 'Toàn thân',
      secondary: [],
      steps: ['Thực hiện động tác đúng tư thế và kiểm soát chuyển động.'],
      tip: ''
    };
  }, [currentItem, exerciseMap]);

  // Map of historical max per exercise for accurate PR detection
  const historyMaxMap = useMemo(() => {
    const map = new Map();
    (recentSets || []).forEach(s => {
      const key = s.exercise_key;
      const prev = map.get(key) || { maxVal: 0, kg: 0 };
      if (Number(s.actual_val || 0) > prev.maxVal) {
        map.set(key, { maxVal: Number(s.actual_val), kg: Number(s.kg || 0) });
      }
    });
    return map;
  }, [recentSets]);

  // Overall workout elapsed timer (wall-clock based)
  useEffect(() => {
    if (screenState === 'done') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartTimeRef.current) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [screenState]);

  // Persistent Web Audio context with user gesture unlock (iOS Safari compatibility)
  const audioCtxRef = useRef(null);

  const ensureAudioUnlocked = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContextClass();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch {
      // Audio context restricted or unavailable
    }
  }, []);

  const playTimerBeep = useCallback(() => {
    try {
      ensureAudioUnlocked();
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state === 'closed') return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio context restricted or unavailable
    }
  }, [ensureAudioUnlocked]);

  // Clean up AudioContext when unmounting
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  // End rest handler defined BEFORE rest timer effect to avoid TDZ initialization error
  const handleEndRest = useCallback(() => {
    if (curQueueIdx + 1 >= queue.length) {
      setScreenState('done');
    } else {
      setCurQueueIdx(prev => prev + 1);
      setScreenState('set');
    }
  }, [curQueueIdx, queue.length]);

  // Rest countdown timer (timestamp delta)
  useEffect(() => {
    if (screenState !== 'rest' || !restEndRef.current) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.round((restEndRef.current - now) / 1000));
      setRestRemaining(diff);
      if (diff <= 0) {
        clearInterval(interval);
        playTimerBeep();
        handleEndRest();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [screenState, handleEndRest, playTimerBeep]);

  // Timed exercise timer (Plank, Dead Hang) using timestamp delta
  useEffect(() => {
    if (!tRunning) return;
    const interval = setInterval(() => {
      if (plankStartTimeRef.current) {
        setTSec(Math.floor((Date.now() - plankStartTimeRef.current) / 1000));
      }
    }, 250);
    return () => clearInterval(interval);
  }, [tRunning]);

  // Reset input values when current item changes
  useEffect(() => {
    if (currentItem) {
      setCurrentVal(Number(currentItem.target_val || 10));
      setTSec(0);
      setTRunning(false);
      plankStartTimeRef.current = null;
    }
  }, [curQueueIdx, currentItem]);

  // Restore previously logged sets ONLY on mount when explicitly continuing an in-progress session
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    if (!isResume || !sessionId || !recentSets || recentSets.length === 0) return;

    const existing = recentSets.filter(s => (s.session_id || s.sessionId) === sessionId);
    if (existing.length === 0) return;

    existing.sort((a, b) => (a.sequence_order || a.set_no || 0) - (b.sequence_order || b.set_no || 0));

    const restoredLoggedSets = existing.map(s => ({
      sessionId,
      routineItemId: s.routine_item_id || s.routineItemId || null,
      exerciseKey: s.exercise_key || s.exerciseKey,
      exerciseName: s.exercise_name || s.exerciseName || s.exercise_key,
      setNo: s.set_no || s.setNo,
      sequenceOrder: s.sequence_order || s.sequenceOrder,
      targetVal: s.target_val || s.targetVal,
      unit: s.unit || 'rep',
      actualVal: s.actual_val != null ? s.actual_val : s.actualVal,
      kg: Number(s.kg || 0),
      isPR: Boolean(s.is_pr || s.isPR)
    }));

    const restoredLogs = {};
    restoredLoggedSets.forEach(s => {
      if (!restoredLogs[s.exerciseKey]) restoredLogs[s.exerciseKey] = [];
      restoredLogs[s.exerciseKey][s.setNo - 1] = s.actualVal;
    });

    setLoggedSets(restoredLoggedSets);
    setLogs(restoredLogs);

    if (queue.length > 0) {
      const nextIdx = Math.min(existing.length, queue.length - 1);
      setCurQueueIdx(nextIdx);
    }
  }, [isResume, sessionId, recentSets, queue.length]);

  const formatClock = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const startRestTimer = (seconds) => {
    const s = Math.max(10, seconds || 60);
    setRestTotal(s);
    setRestRemaining(s);
    restEndRef.current = Date.now() + s * 1000;
    setScreenState('rest');
  };

  const handleAdjustRest = (delta) => {
    ensureAudioUnlocked();
    if (!restEndRef.current) return;
    const nextEnd = Math.max(Date.now() + 5000, restEndRef.current + delta * 1000);
    restEndRef.current = nextEnd;
    const nextRemaining = Math.round((nextEnd - Date.now()) / 1000);
    setRestRemaining(nextRemaining);
    setRestTotal(prev => Math.max(prev, nextRemaining));
  };

  const handleLogSet = (valToLog) => {
    ensureAudioUnlocked();
    if (!currentItem) return;

    // valToLog === null means set was explicitly skipped
    const isSkipped = valToLog === null;
    const actualVal = isSkipped ? null : Number(valToLog !== undefined ? valToLog : currentVal);
    const exKey = currentItem.exercise_key;

    // Detect PR against history
    const hist = historyMaxMap.get(exKey);
    const isPR = !isSkipped && hist != null && detectPR(actualVal, hist.maxVal, currentItem.kg, hist.kg);

    // Update local logs
    const prevArr = logs[exKey] || [];
    const nextArr = [...prevArr];
    nextArr[currentItem.set_no - 1] = actualVal;
    setLogs(prev => ({ ...prev, [exKey]: nextArr }));

    const rawItemId = currentItem.routine_item_id || currentItem.id;
    const isValidUUID = typeof rawItemId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawItemId);
    const resolvedRoutineItemId = isValidUUID ? rawItemId : null;

    const record = {
      sessionId,
      routineItemId: resolvedRoutineItemId,
      exerciseKey: exKey,
      exerciseName: exDef?.name || currentItem.name || exKey,
      setNo: currentItem.set_no,
      sequenceOrder: currentItem.sequence_order,
      targetVal: currentItem.target_val,
      unit: currentItem.unit,
      actualVal,
      kg: currentItem.kg || 0,
      isPR
    };

    setLoggedSets(prev => [...prev, record]);

    // Persist set to Supabase immediately if callback provided
    if (onLogSet) {
      onLogSet(record).catch(err => {
        console.error('Failed to save set to DB:', err);
        setSaveError('Không thể lưu set vào máy chủ. Dữ liệu vẫn được giữ tạm trên màn hình.');
      });
    }

    // Move to next step
    if (curQueueIdx + 1 < queue.length) {
      startRestTimer(currentItem.rest_seconds || 60);
    } else {
      setScreenState('done');
    }
  };

  // Rest SVG circular progress
  const C110 = 2 * Math.PI * 110;
  const restProgress = restTotal ? (restRemaining / restTotal) : 0;
  const restDashOffset = C110 * (1 - restProgress);

  // Unique exercises count and current exercise index for header label
  const uniqueExerciseKeys = useMemo(() => {
    return Array.from(new Set(queue.map(q => q.exercise_key)));
  }, [queue]);

  const currentExerciseIdx = currentItem
    ? uniqueExerciseKeys.indexOf(currentItem.exercise_key) + 1
    : 1;

  // ── STATS CALCULATION FOR DONE SCREEN ─────────────────────────────────────
  const doneStats = useMemo(() => {
    const completedCount = loggedSets.filter(s => s.actualVal != null).length;
    const totalVolumeKg = loggedSets.reduce((acc, s) => {
      return acc + (s.actualVal != null ? s.actualVal * (s.kg || 0) : 0);
    }, 0);
    const prCount = loggedSets.filter(s => s.isPR).length;

    // Auto-progression evaluation for each day item
    const progressionCandidates = dayItems.map(item => {
      const itemSets = loggedSets.filter(s => s.exerciseKey === item.exercise_key);
      const evalRes = checkAutoProgression(
        itemSets,
        item.target_val,
        item.target_sets,
        item.unit
      );
      return {
        routineItemId: item.id,
        exercise_key: item.exercise_key,
        name: exerciseMap?.get(item.exercise_key)?.name || BASE_EXERCISES.find(e => e.key === item.exercise_key)?.name || item.name || item.exercise_key,
        currentVal: item.target_val,
        nextVal: evalRes.nextTarget,
        unit: item.unit,
        shouldProgress: evalRes.shouldProgress,
        step: evalRes.step,
        completedSets: itemSets.filter(s => s.actualVal != null).length,
        totalTargetSets: item.target_sets
      };
    });

    // Comparison with recent historical sets (excluding current session sets)
    // Only compare against the most recent session that contained each exercise,
    // avoiding summing up all historical sets across time.
    const historicalSets = (recentSets || []).filter(s => {
      const sId = s.session_id || s.sessionId;
      return sId && sId !== sessionId;
    });

    const histSetsByEx = new Map();
    historicalSets.forEach(s => {
      const key = s.exercise_key || s.exerciseKey;
      if (!key) return;
      if (!histSetsByEx.has(key)) histSetsByEx.set(key, []);
      histSetsByEx.get(key).push(s);
    });

    const previousSetsOfLastWorkout = [];
    histSetsByEx.forEach((sets) => {
      let latestSessionId = null;
      let latestTime = 0;
      sets.forEach(s => {
        const time = new Date(s.completed_at || s.created_at || 0).getTime();
        if (time >= latestTime) {
          latestTime = time;
          latestSessionId = s.session_id || s.sessionId;
        }
      });
      if (latestSessionId) {
        sets.filter(s => (s.session_id || s.sessionId) === latestSessionId)
            .forEach(s => previousSetsOfLastWorkout.push(s));
      }
    });

    const prevComparison = compareSessionWithPrevious(loggedSets, previousSetsOfLastWorkout);

    return {
      completedCount,
      totalSets: queue.length,
      totalVolumeKg,
      prCount,
      progressionCandidates,
      prevComparison
    };
  }, [loggedSets, queue.length, dayItems, recentSets, sessionId, exerciseMap]);

  // Set initial approved progressions when entering done state
  useEffect(() => {
    if (screenState === 'done') {
      const initialApproved = {};
      doneStats.progressionCandidates.forEach(cand => {
        if (cand.shouldProgress) {
          initialApproved[cand.routineItemId || cand.exercise_key] = true;
        }
      });
      setApprovedProgressions(initialApproved);
    }
  }, [screenState, doneStats.progressionCandidates]);

  // If queue is empty (e.g. rest day selected)
  if (queue.length === 0) {
    return (
      <div className="body-card" style={{ padding: '32px', textAlign: 'center', margin: 'auto 0' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--body-shell-bg)', display: 'grid', placeItems: 'center', margin: '0 auto 16px auto', color: 'var(--body-text-muted)' }}>
          <AppIcon name="calendar" size={24} />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>Không có bài tập theo lịch hôm nay</h3>
        <p style={{ fontSize: '13.5px', color: 'var(--body-text-muted)', margin: '0 0 20px 0', maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
          Hôm nay là ngày nghỉ hoặc chưa có bài tập nào được gán cho thứ này. Bạn có thể chọn ngày khác hoặc quay lại Lộ trình.
        </p>
        <button className="body-btn body-btn-primary" onClick={onCancel} style={{ padding: '0 20px', height: '38px' }}>
          Quay lại Lộ trình
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      {/* ── SAVE ERROR ALERT ────────────────────────────────────────── */}
      {saveError && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: 'var(--body-red, #EF4444)',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AppIcon name="alert-circle" size={16} />
            <span>{saveError}</span>
          </div>
          <button
            onClick={() => setSaveError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--body-red, #EF4444)',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: '12px'
            }}
          >
            Đóng
          </button>
        </div>
      )}

      {/* ── TOP LIVE BAR ────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px',
        borderRadius: '14px',
        background: 'var(--body-card-bg)',
        border: '1px solid var(--body-card-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '18px',
            fontWeight: 700,
            fontFamily: 'var(--body-mono)',
            color: 'var(--body-accent)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <AppIcon name="timer" size={18} />
            {formatClock(elapsed)}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--body-text-muted)' }}>
            Bài {currentExerciseIdx} / {uniqueExerciseKeys.length} · Set {currentItem?.set_no || 1}/{currentItem?.total_sets || 3}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="body-btn body-btn-secondary"
            onClick={onCancel}
          >
            Thoát
          </button>
          <button
            className="body-btn body-btn-primary"
            onClick={() => setScreenState('done')}
          >
            Kết thúc buổi
          </button>
        </div>
      </div>

      {/* ── PROGRESS SEGMENTS ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {queue.map((item, i) => {
          const isDone = i < curQueueIdx;
          const isCur = i === curQueueIdx;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: isDone ? 'var(--body-green)' : isCur ? 'var(--body-accent)' : 'var(--body-border-subtle)',
                transition: 'all 0.2s ease'
              }}
            />
          );
        })}
      </div>

      {/* ── BƯỚC 1: XEM HƯỚNG DẪN KỸ THUẬT (GUIDE) ──────────────── */}
      {screenState === 'guide' && (
        <div className="body-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <span className="body-badge body-badge-accent" style={{ marginBottom: '6px' }}>
                BÀI {currentExerciseIdx} / {uniqueExerciseKeys.length}
              </span>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0' }}>{exDef?.name}</h2>
              <div style={{ fontSize: '13px', color: 'var(--body-text-muted)' }}>
                Cơ chính: {exDef?.primary} · Phụ: {(exDef?.secondary || []).join(', ') || 'Không'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>MỤC TIÊU</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--body-accent)' }}>
                {currentItem?.total_sets} × {formatValWithUnit(currentItem?.target_val, currentItem?.unit)}
              </div>
            </div>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: 'var(--body-shell-bg)', fontSize: '13px' }}>
            <span style={{ color: 'var(--body-text-muted)', fontWeight: 500 }}>Chế độ:</span>
            {curQueueIdx === 0 ? (
              [
                { key: 'straight', label: 'Từng bài (Straight)' },
                { key: 'circuit', label: 'Vòng tròn (Circuit)' },
                { key: 'superset', label: 'Superset' }
              ].map(m => (
                <button
                  key={m.key}
                  className="body-btn"
                  style={{
                    height: '28px',
                    padding: '0 10px',
                    fontSize: '12px',
                    background: mode === m.key ? 'var(--body-text-main)' : 'transparent',
                    color: mode === m.key ? 'var(--body-bg)' : 'var(--body-text-main)',
                    border: mode === m.key ? 'none' : '1px solid var(--body-card-border)'
                  }}
                  onClick={() => setMode(m.key)}
                >
                  {m.label}
                </button>
              ))
            ) : (
              <span style={{ fontWeight: 600, color: 'var(--body-accent)', fontSize: '12.5px' }}>
                {mode === 'straight' ? 'Từng bài (Straight)' : mode === 'circuit' ? 'Vòng tròn (Circuit)' : 'Superset'} (Cố định suốt buổi)
              </span>
            )}
          </div>

          <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--body-shell-bg)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Cách thực hiện chuẩn:</div>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--body-text-main)' }}>
              {(exDef?.steps || []).map((step, sIdx) => (
                <li key={sIdx} style={{ marginBottom: '4px' }}>{step}</li>
              ))}
            </ol>

            {(exDef?.breathing || exDef?.tempo) && (
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--body-card-bg)',
                border: '1px solid var(--body-card-border)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                fontSize: '12px',
                lineHeight: 1.45
              }}>
                {exDef?.breathing && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                    <span>🌬️</span>
                    <span><strong>Thở:</strong> {exDef.breathing}</span>
                  </div>
                )}
                {exDef?.tempo && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                    <span>⏱️</span>
                    <span><strong>Tempo:</strong> {exDef.tempo}</span>
                  </div>
                )}
              </div>
            )}

            {exDef?.tip && (
              <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--body-red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AppIcon name="warning" size={14} />
                <span>Lỗi hay gặp: {exDef.tip}</span>
              </div>
            )}

            {exDef?.injury_risk && (
              <div style={{
                marginTop: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: '12px',
                lineHeight: 1.5,
                color: 'var(--body-text-main)'
              }}>
                <div style={{ fontWeight: 700, color: '#DC2626', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <AppIcon name="warning" size={13} />
                  <span>Cảnh báo chấn thương & Phòng tránh đau:</span>
                </div>
                <div>{exDef.injury_risk}</div>
                {(exDef.contraindications || []).length > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#DC2626', fontWeight: 600 }}>
                    ⚠️ Không nên tập nếu: {exDef.contraindications.join(', ')}
                  </div>
                )}
                {exDef.easier_variation && (
                  <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--body-green-text)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AppIcon name="arrowDown" size={12} />
                    <span>Bài quá khó? Gợi ý biến thể dễ hơn: <strong>{BASE_EXERCISES.find(e => e.key === exDef.easier_variation)?.name}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Video thị phạm (YouTube / Google Drive) */}
            <div style={{ marginTop: '12px' }}>
              <ExerciseVideoPlayer
                exerciseKey={currentItem?.exerciseKey}
                exerciseName={currentItem?.name}
                defaultUrl={exDef?.video_url}
                compact={true}
              />
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              className="body-btn body-btn-primary"
              style={{ padding: '0 24px', height: '42px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setScreenState('set')}
            >
              <span>Bắt đầu Set {currentItem?.set_no || 1}</span>
              <AppIcon name="arrowRight" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── BƯỚC 2: GHI SET (REP HOẶC BẤM GIỜ) ──────────────────── */}
      {screenState === 'set' && (
        <div className="body-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>{exDef?.name}</h2>
              <div style={{ fontSize: '13px', color: 'var(--body-text-muted)', marginTop: '2px' }}>
                Set {currentItem?.set_no} / {currentItem?.total_sets} · Mục tiêu {formatValWithUnit(currentItem?.target_val, currentItem?.unit)}
                {currentItem?.kg ? ` · ${currentItem.kg} kg` : ''}
              </div>
            </div>
            <button
              className="body-btn body-btn-secondary"
              style={{ fontSize: '12px', height: '30px' }}
              onClick={() => setScreenState('guide')}
            >
              Xem hướng dẫn
            </button>
          </div>

          {/* Bài đếm rep */}
          {currentItem?.unit !== 's' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: 'auto 0' }}>
              <div style={{ fontSize: '13px', color: 'var(--body-text-muted)' }}>
                Nhập số rep thực tế hoàn thành:
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <button
                  className="body-btn-icon"
                  style={{ width: '48px', height: '48px', fontSize: '20px' }}
                  onClick={() => setCurrentVal(prev => Math.max(0, prev - 1))}
                >
                  −
                </button>

                <div style={{ textAlign: 'center', minWidth: '90px' }}>
                  <div style={{ fontSize: '56px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: currentVal >= currentItem.target_val ? 'var(--body-green)' : 'var(--body-amber)' }}>
                    {currentVal}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--body-text-muted)' }}>
                    {currentVal >= currentItem.target_val ? 'Đạt mục tiêu ✓' : `Thiếu ${currentItem.target_val - currentVal} rep`}
                  </div>
                </div>

                <button
                  className="body-btn-icon"
                  style={{ width: '48px', height: '48px', fontSize: '20px' }}
                  onClick={() => setCurrentVal(prev => prev + 1)}
                >
                  +
                </button>
              </div>

              {/* Quick Select Chips */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {[
                  currentItem.target_val - 4,
                  currentItem.target_val - 2,
                  currentItem.target_val,
                  currentItem.target_val + 2,
                  currentItem.target_val + 4
                ].filter(v => v >= 0).map((v) => (
                  <button
                    key={v}
                    className="body-btn body-btn-secondary"
                    style={{
                      height: '32px',
                      padding: '0 12px',
                      fontWeight: v === currentVal ? 700 : 500,
                      background: v === currentVal ? 'var(--body-text-main)' : undefined,
                      color: v === currentVal ? 'var(--body-bg)' : undefined
                    }}
                    onClick={() => setCurrentVal(v)}
                  >
                    {v} rep
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Bài đếm giây (Plank / Dead Hang) */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', margin: 'auto 0' }}>
              <div style={{ fontSize: '64px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: tSec >= currentItem.target_val ? 'var(--body-green)' : 'var(--body-accent)' }}>
                {tSec}s
              </div>
              <div style={{ fontSize: '13px', color: 'var(--body-text-muted)' }}>
                Mục tiêu: {currentItem.target_val}s {tSec >= currentItem.target_val ? '· Đã đạt ✓' : `· Còn ${Math.max(0, currentItem.target_val - tSec)}s`}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="body-btn body-btn-primary"
                  onClick={() => {
                    if (!tRunning) {
                      plankStartTimeRef.current = Date.now() - tSec * 1000;
                    }
                    setTRunning(!tRunning);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <AppIcon name={tRunning ? 'pause' : 'play'} size={16} />
                  <span>{tRunning ? 'Tạm dừng' : tSec > 0 ? 'Tiếp tục' : 'Bắt đầu đếm giờ'}</span>
                </button>
                {tSec > 0 && (
                  <button
                    className="body-btn body-btn-secondary"
                    onClick={() => { setTSec(0); setTRunning(false); plankStartTimeRef.current = null; }}
                  >
                    Đặt lại
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--body-card-border)' }}>
            <button
              className="body-btn body-btn-secondary"
              onClick={() => handleLogSet(null)}
            >
              Bỏ set này
            </button>

            <button
              className="body-btn body-btn-accent"
              style={{ padding: '0 24px', height: '42px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => handleLogSet(currentItem.unit === 's' ? tSec : currentVal)}
            >
              <AppIcon name="checkCircle" size={18} />
              <span>Hoàn thành Set {currentItem.set_no}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── BƯỚC 3: REST TIMER OVERLAY ──────────────────────────── */}
      {screenState === 'rest' && (
        <div className="body-rest-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#C4B6F4' }}>
              NGHỈ GIỮA SET
            </span>
            <button
              className="body-btn body-btn-secondary"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
              onClick={handleEndRest}
            >
              Bỏ qua nghỉ
            </button>
          </div>

          <div className="body-timer-ring-container">
            <svg width="250" height="250" viewBox="0 0 250 250">
              <circle
                cx="125"
                cy="125"
                r="110"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="10"
              />
              <circle
                cx="125"
                cy="125"
                r="110"
                fill="none"
                stroke={restRemaining <= 10 ? '#7FD3A2' : '#7C5CFC'}
                strokeWidth="10"
                strokeDasharray={C110}
                strokeDashoffset={restDashOffset}
                strokeLinecap="round"
                transform="rotate(-90 125 125)"
                style={{ transition: 'stroke-dashoffset 0.3s ease' }}
              />
            </svg>

            <div className="body-timer-ring-text">
              <span className="body-timer-clock">{restRemaining}s</span>
              <span className="body-timer-label">Hít thở đều</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', margin: '16px 0' }}>
            <button
              className="body-btn body-btn-secondary"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
              onClick={() => handleAdjustRest(-15)}
            >
              −15 giây
            </button>
            <button
              className="body-btn body-btn-secondary"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
              onClick={() => handleAdjustRest(15)}
            >
              +15 giây
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 'auto', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '11px', fontFamily: 'var(--body-mono)', color: '#9C9AA8' }}>TIẾP THEO</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginTop: '2px' }}>
              Set {queue[curQueueIdx + 1]?.set_no || 1} · {queue[curQueueIdx + 1]?.name}
            </div>
            <div style={{ fontSize: '12.5px', color: '#B0B3BE' }}>
              Mục tiêu {formatValWithUnit(queue[curQueueIdx + 1]?.target_val, queue[curQueueIdx + 1]?.unit)}
            </div>
          </div>
        </div>
      )}

      {/* ── BƯỚC 4: KẾT QUẢ BUỔI TẬP VỚI SỐ LIỆU THẬT & DUYỆT TĂNG TIẾN ── */}
      {screenState === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header chúc mừng */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            background: 'var(--body-card-bg)',
            border: '1px solid var(--body-card-border)',
            borderRadius: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'var(--body-green-soft)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--body-green)'
              }}>
                <AppIcon name="checkCircle" size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 2px 0', color: 'var(--body-text-main)' }}>
                  Hoàn thành buổi {dayInfo?.name || 'Tập luyện'}
                </h2>
                <div style={{ fontSize: '13px', color: 'var(--body-text-muted)' }}>
                  Thời gian: {formatClock(elapsed)} · Hoàn thành {doneStats.completedCount}/{doneStats.totalSets} set
                </div>
              </div>
            </div>

            <button
              className="body-btn body-btn-accent"
              onClick={() => {
                const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
                const progressionsToApply = doneStats.progressionCandidates
                  .filter(c => c.shouldProgress && isValidUUID(c.routineItemId) && approvedProgressions[c.routineItemId || c.exercise_key])
                  .map(c => ({
                    routineItemId: c.routineItemId,
                    nextTargetVal: c.nextVal
                  }));

                onFinishSession?.({
                  elapsed,
                  logs,
                  loggedSets,
                  hasSaveError: Boolean(saveError),
                  approvedProgressions: progressionsToApply
                });
              }}
              style={{ height: '38px', padding: '0 20px' }}
            >
              Hoàn tất & Lưu
            </button>
          </div>

          {/* 4 Stat KPI Cards - 100% Số Liệu Thật */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div className="body-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>Thời gian thực</span>
              <span style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                {Math.max(1, Math.round(elapsed / 60))} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--body-text-muted)' }}>phút</span>
              </span>
            </div>

            <div className="body-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>Khối lượng tạ</span>
              <span style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                {doneStats.totalVolumeKg} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--body-text-muted)' }}>kg</span>
              </span>
            </div>

            <div className="body-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>Set hoàn thành</span>
              <span style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: doneStats.completedCount === doneStats.totalSets ? 'var(--body-green)' : 'var(--body-text-main)' }}>
                {doneStats.completedCount} / {doneStats.totalSets} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--body-text-muted)' }}>set</span>
              </span>
            </div>

            <div className="body-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>Kỷ lục mới (PR)</span>
              <span style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: doneStats.prCount > 0 ? '#E0A23C' : 'var(--body-text-muted)' }}>
                {doneStats.prCount} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--body-text-muted)' }}>kỷ lục</span>
              </span>
            </div>
          </div>

          {/* Hai cột: So sánh từng bài & Duyệt tăng tiến */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>

            {/* Cột trái: So sánh chi tiết từng bài */}
            <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                Chi tiết từng bài tập
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {dayItems.map((item, idx) => {
                  const loggedVals = logs[item.exercise_key] || [];
                  const compEx = doneStats.prevComparison.byExercise.find(e => e.exercise_key === item.exercise_key);
                  const isItemPR = loggedSets.some(s => s.exerciseKey === item.exercise_key && s.isPR);
                  const displayName = exerciseMap?.get(item.exercise_key)?.name || BASE_EXERCISES.find(e => e.key === item.exercise_key)?.name || item.name || item.exercise_key;

                  return (
                    <div key={idx} style={{ paddingBottom: '12px', borderBottom: '1px solid var(--body-card-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                            {displayName}
                          </span>
                          {isItemPR && (
                            <span style={{
                              padding: '2px 7px',
                              borderRadius: '6px',
                              background: 'var(--body-amber-soft)',
                              color: 'var(--body-amber-text)',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <AppIcon name="trophy" size={12} /> PR
                            </span>
                          )}
                        </div>
                        {compEx && (
                          <span style={{ fontSize: '13px', fontWeight: 600, color: compEx.diff > 0 ? 'var(--body-green)' : 'var(--body-text-muted)' }}>
                            {compEx.label} {compEx.unit}
                          </span>
                        )}
                      </div>

                      {/* Set values pills */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {loggedVals.map((val, sIdx) => {
                          const isSkipped = val == null;
                          const isMet = !isSkipped && val >= item.target_val;
                          return (
                            <div
                              key={sIdx}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                background: isSkipped ? 'var(--body-red-soft)' : isMet ? 'var(--body-green-soft)' : 'var(--body-shell-bg)',
                                border: `1px solid ${isSkipped ? 'var(--body-red-text)' : isMet ? '#CFE8D8' : 'var(--body-card-border)'}`,
                                fontSize: '13px',
                                fontFamily: 'var(--body-mono)',
                                fontWeight: 600,
                                color: isSkipped ? 'var(--body-red-text)' : isMet ? 'var(--body-green-text)' : 'var(--body-text-main)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <span>{isSkipped ? 'Bỏ' : `${val} ${item.unit}`}</span>
                              {isMet && <AppIcon name="check" size={12} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cột phải: Duyệt mục tiêu tăng tiến buổi tới (Có Checkbox do User kiểm soát) */}
            <div style={{
              background: 'var(--body-accent-soft)',
              border: '1.5px solid var(--body-accent-border)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--body-accent)' }}>
                  Đề xuất tăng tiến buổi tới (+1 rep / +5s)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--body-text-sub)', marginTop: '2px' }}>
                  Chỉ đề xuất khi hoàn thành đủ 100% số set đạt chỉ tiêu. Đánh dấu để áp dụng vào Lộ trình.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {doneStats.progressionCandidates.map((cand, idx) => {
                  const itemKey = cand.routineItemId || cand.exercise_key;
                  const isChecked = !!approvedProgressions[itemKey];

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'var(--body-card-bg)',
                        border: '1px solid var(--body-card-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        opacity: cand.shouldProgress ? 1 : 0.65
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                          {cand.name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: cand.shouldProgress ? 'var(--body-green)' : 'var(--body-text-muted)', fontWeight: 500 }}>
                          {cand.shouldProgress
                            ? `Đạt đủ ${cand.totalTargetSets} set ✓`
                            : `Đạt ${cand.completedSets}/${cand.totalTargetSets} set (chưa đạt yêu cầu tăng)`}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontFamily: 'var(--body-mono)',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: cand.shouldProgress ? 'var(--body-accent)' : 'var(--body-text-muted)'
                        }}>
                          {cand.shouldProgress ? `${cand.nextVal} ${cand.unit}` : `${cand.currentVal} ${cand.unit}`}
                        </span>

                        {cand.shouldProgress && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setApprovedProgressions(prev => ({
                                ...prev,
                                [itemKey]: checked
                              }));
                            }}
                            style={{
                              width: '18px',
                              height: '18px',
                              accentColor: 'var(--body-accent)',
                              cursor: 'pointer'
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: '11.5px', color: 'var(--body-text-sub)', lineHeight: 1.5, marginTop: 'auto' }}>
                💡 Khi bấm "Hoàn tất & Lưu", chỉ các bài được tích chọn ở trên mới được cập nhật vào mục tiêu Lộ trình.
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

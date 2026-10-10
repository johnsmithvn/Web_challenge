import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AppIcon from '../AppIcon';
import GenericModal from '../GenericModal';
import BASE_EXERCISES from '../../data/body-exercises.json';
import ExerciseVideoPlayer from './ExerciseVideoPlayer';
import ExerciseDetailModal from './ExerciseDetailModal';
import MUSCLE_MAP from '../../data/body-muscles.json';
import {
  generateWorkoutQueue,
  formatValWithUnit,
  checkAutoProgression,
  compareSessionWithPrevious,
  isUuid,
  getSlotKey,
  findNextOpenIndex,
  getRestKind,
  REST_KIND_LABELS,
  estimateQueueMinutes,
  buildPrBaselines,
  isNewPR,
  buildPreviousSetsByExercise
} from '../../utils/workoutLogic';

const MODES = [
  { key: 'straight', label: 'Từng bài', desc: 'Làm hết các set của một bài rồi sang bài kế.' },
  { key: 'circuit', label: 'Vòng liên hoàn', desc: 'Mỗi bài 1 set, chuyển bài 20 giây, hết vòng nghỉ 90 giây.' },
  { key: 'superset', label: 'Siêu set', desc: 'Ghép cặp 2 bài liên tục không nghỉ, nghỉ 75 giây sau mỗi cặp.' }
];

const LETTERS = 'ABCDEFGHIJKLMNOP';

const slotOfRecord = (r) => getSlotKey(r.routineItemId, r.exerciseKey, r.setNo);
const slotOfItem = (q) => getSlotKey(q.routine_item_id, q.exercise_key, q.set_no);
const fmtVals = (vals, unit) => vals.map(v => (v == null ? 'bỏ' : unit === 's' ? `${v}s` : String(v))).join(' · ');

export default function LiveSessionScreen({
  dayInfo,
  routineItems = [],
  recentSets = [],
  exerciseMap = new Map(),
  sessionId,
  isResume = false,
  initialMode = 'straight',
  initialElapsed = 0,
  startedAt = null,
  onLogSet,
  onModeLocked,
  onFinishSession,
  onCancel,
  onPause
}) {
  // Các set đã ghi của chính buổi này (có khi tiếp tục buổi tạm dừng / sau khi tải lại trang)
  // Chỉ lấy lúc mở màn (BodyPage chỉ mount khi dữ liệu đã tải xong); sau đó loggedSets là nguồn sự thật
  const [existingSets] = useState(
    () => (isResume && sessionId ? recentSets.filter(s => s.session_id === sessionId) : [])
  );

  const [mode, setMode] = useState(initialMode || 'straight');
  const [modeLocked, setModeLocked] = useState(existingSets.length > 0);
  const [screenState, setScreenState] = useState('guide'); // 'guide' | 'set' | 'rest' | 'done'
  const [curQueueIdx, setCurQueueIdx] = useState(0);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [loggedSets, setLoggedSets] = useState(() => existingSets
    .slice()
    .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
    .map(s => ({
      sessionId,
      routineItemId: s.routine_item_id || null,
      exerciseKey: s.exercise_key,
      exerciseName: s.exercise_name || s.exercise_key,
      setNo: s.set_no,
      sequenceOrder: s.sequence_order,
      targetVal: s.target_val,
      unit: s.unit || 'rep',
      actualVal: s.actual_val,
      kg: Number(s.kg || 0),
      isPR: Boolean(s.is_pr)
    })));
  const [approvedProgressions, setApprovedProgressions] = useState({});
  const [saveError, setSaveError] = useState(null);
  const hasRestoredRef = useRef(false);

  // Thời lượng đã tập trước khi mở màn: thời lượng lưu lúc tạm dừng, hoặc tới set cuối đã ghi (khi tải lại trang)
  const [baseElapsed] = useState(() => {
    let lastSetSec = 0;
    if (startedAt && existingSets.length > 0) {
      const start = new Date(startedAt).getTime();
      const last = Math.max(...existingSets.map(s => new Date(s.completed_at || 0).getTime()));
      lastSetSec = Math.max(0, Math.round((last - start) / 1000));
    }
    return Math.max(Number(initialElapsed) || 0, lastSetSec);
  });
  const [elapsed, setElapsed] = useState(baseElapsed);

  // Wall-clock timers for drift resistance (background tabs / mobile lock)
  const sessionStartTimeRef = useRef(null);
  const restEndRef = useRef(null);
  const plankStartTimeRef = useRef(null);

  const [restRemaining, setRestRemaining] = useState(0);
  const [restTotal, setRestTotal] = useState(60);
  const [restKind, setRestKind] = useState('set');
  const [restNextIdx, setRestNextIdx] = useState(null);

  const [tSec, setTSec] = useState(0);
  const [tRunning, setTRunning] = useState(false);

  // Input rep value
  const [currentVal, setCurrentVal] = useState(15);

  // 1. Bài tập của buổi: bài lẻ (buổi tự do) hoặc các bài theo thứ trong lộ trình
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
    const weekday = dayInfo?.weekday || dayInfo?.day;
    return weekday ? routineItems.filter(item => item.weekday === weekday) : [];
  }, [dayInfo, routineItems]);

  // 2. Build the exercise queue based on mode
  const queue = useMemo(() => generateWorkoutQueue(dayItems, mode), [dayItems, mode]);

  const nameOf = useCallback(
    (key) => exerciseMap.get(key)?.name || BASE_EXERCISES.find(e => e.key === key)?.name || key,
    [exerciseMap]
  );

  const doneKeys = useMemo(() => new Set(loggedSets.map(slotOfRecord)), [loggedSets]);

  // Giá trị đã ghi theo bài: { [exercise_key]: [set1, set2, ...] }
  const logs = useMemo(() => {
    const out = {};
    loggedSets.forEach(s => {
      if (!out[s.exerciseKey]) out[s.exerciseKey] = [];
      out[s.exerciseKey][s.setNo - 1] = s.actualVal;
    });
    return out;
  }, [loggedSets]);

  const currentItem = queue[curQueueIdx] || queue[0];
  const currentSlotKey = currentItem ? `${slotOfItem(currentItem)}@${curQueueIdx}` : '';

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

  // Mốc PR từ lịch sử (không tính buổi này) + kết quả "lần trước" của từng bài
  const historyBaselines = useMemo(
    () => buildPrBaselines(recentSets.filter(s => s.session_id !== sessionId)),
    [recentSets, sessionId]
  );
  const prevByExercise = useMemo(
    () => buildPreviousSetsByExercise(recentSets, sessionId),
    [recentSets, sessionId]
  );
  const prevLine = (key) => {
    const prev = prevByExercise.get(key);
    if (!prev || prev.sets.length === 0) return null;
    const unit = prev.sets[0].unit;
    const kg = prev.sets.find(s => s.kg > 0)?.kg;
    return `${fmtVals(prev.sets.map(s => s.actual_val), unit)}${kg ? ` · ${kg} kg` : ''}`;
  };

  // Overall workout elapsed timer (wall-clock based, cộng dồn phần đã tập trước khi tạm dừng)
  useEffect(() => {
    if (sessionStartTimeRef.current == null) {
      sessionStartTimeRef.current = Date.now() - baseElapsed * 1000;
    }
    if (screenState === 'done') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartTimeRef.current) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [screenState, baseElapsed]);

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

  // Chuyển sang ô set idx: set đầu tiên của 1 bài thì mở hướng dẫn (theo thiết kế), còn lại vào thẳng màn ghi set
  const goToSlot = useCallback((idx) => {
    if (idx < 0 || idx >= queue.length) {
      setScreenState('done');
      return;
    }
    setCurQueueIdx(idx);
    setScreenState(queue[idx].set_no === 1 ? 'guide' : 'set');
  }, [queue]);

  // End rest handler defined BEFORE rest timer effect to avoid TDZ initialization error
  const handleEndRest = useCallback(() => {
    goToSlot(restNextIdx == null ? -1 : restNextIdx);
  }, [goToSlot, restNextIdx]);

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

  // Reset input values khi sang ô set khác (so theo khóa ổn định, không theo object để tránh reset giữa chừng)
  useEffect(() => {
    if (!currentSlotKey) return;
    const item = queue[curQueueIdx];
    setCurrentVal(Number(item?.target_val || 10));
    setTSec(0);
    setTRunning(false);
    plankStartTimeRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlotKey]);

  // Tiếp tục buổi dở: nhảy tới ô set còn trống đầu tiên theo đúng chế độ đã chốt
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    if (existingSets.length === 0 || queue.length === 0) return;
    const next = findNextOpenIndex(queue, doneKeys, -1);
    if (next < 0) setScreenState('done');
    else goToSlot(next);
  }, [existingSets, queue, doneKeys, goToSlot]);

  const formatClock = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Sau khi ghi (hoặc bỏ) các ô: nghỉ theo loại rồi tới ô trống kế tiếp
  const advanceAfter = (fromIdx, nextDoneKeys) => {
    const next = findNextOpenIndex(queue, nextDoneKeys, fromIdx);
    if (next < 0) {
      setScreenState('done');
      return;
    }
    const restSec = Number(queue[fromIdx]?.rest_seconds) || 0;
    if (restSec <= 0) {
      goToSlot(next);
      return;
    }
    setRestKind(getRestKind(mode, queue[fromIdx], queue[next]));
    setRestNextIdx(next);
    setRestTotal(restSec);
    setRestRemaining(restSec);
    restEndRef.current = Date.now() + restSec * 1000;
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

  const persistRecord = (record) => {
    if (!onLogSet) return;
    onLogSet(record).catch(err => {
      console.error('Failed to save set to DB:', err);
      setSaveError('Không thể lưu set vào máy chủ. Dữ liệu vẫn được giữ tạm trên màn hình.');
    });
  };

  const lockModeIfNeeded = () => {
    if (modeLocked) return;
    setModeLocked(true);
    onModeLocked?.(mode);
  };

  const buildRecord = (item, actualVal, isPR = false) => ({
    sessionId,
    routineItemId: isUuid(item.routine_item_id) ? item.routine_item_id : null,
    exerciseKey: item.exercise_key,
    exerciseName: nameOf(item.exercise_key),
    setNo: item.set_no,
    sequenceOrder: item.sequence_order,
    targetVal: item.target_val,
    unit: item.unit,
    actualVal,
    kg: item.kg || 0,
    isPR
  });

  const handleLogSet = (valToLog) => {
    ensureAudioUnlocked();
    if (!currentItem) return;
    lockModeIfNeeded();

    // valToLog === null means set was explicitly skipped
    const actualVal = valToLog === null ? null : Number(valToLog);

    // PR: vượt mốc lịch sử VÀ vượt các set trước của chính buổi này (mỗi bài tối đa 1 lần lên kỷ lục mới)
    let isPR = false;
    if (actualVal != null) {
      const sessionBase = buildPrBaselines(loggedSets).get(currentItem.exercise_key);
      const candidate = { actualVal, kg: currentItem.kg || 0 };
      isPR = isNewPR(candidate, historyBaselines.get(currentItem.exercise_key))
        && (!sessionBase || isNewPR(candidate, sessionBase));
    }

    const record = buildRecord(currentItem, actualVal, isPR);
    setLoggedSets(prev => [...prev, record]);
    persistRecord(record);
    advanceAfter(curQueueIdx, new Set([...doneKeys, slotOfRecord(record)]));
  };

  // Bỏ cả bài: các set còn trống của bài hiện tại được ghi là "bỏ"
  const handleSkipExercise = () => {
    if (!currentItem) return;
    lockModeIfNeeded();
    const sameItem = q => q.exercise_key === currentItem.exercise_key && q.exerciseIndex === currentItem.exerciseIndex;
    const records = queue.filter(q => sameItem(q) && !doneKeys.has(slotOfItem(q))).map(q => buildRecord(q, null));
    if (records.length === 0) return;
    setLoggedSets(prev => [...prev, ...records]);
    records.forEach(persistRecord);
    advanceAfter(curQueueIdx, new Set([...doneKeys, ...records.map(slotOfRecord)]));
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

  const totalRounds = useMemo(() => Math.max(0, ...dayItems.map(it => Number(it.target_sets) || 1)), [dayItems]);
  const positionLabel = !currentItem ? '' : mode === 'circuit'
    ? `Vòng ${currentItem.set_no} / ${totalRounds} · Bài ${currentExerciseIdx} / ${uniqueExerciseKeys.length}`
    : mode === 'superset'
      ? `Cặp ${Math.floor(currentItem.exerciseIndex / 2) + 1} · ${LETTERS[currentItem.exerciseIndex] || ''}${currentItem.set_no} · Set ${currentItem.set_no}/${currentItem.total_sets}`
      : `Bài ${currentExerciseIdx} / ${uniqueExerciseKeys.length} · Set ${currentItem.set_no}/${currentItem.total_sets}`;

  // Ước tính thời lượng của từng chế độ (chọn trước khi bắt đầu)
  const modeOptions = useMemo(() => MODES.map(m => (
    { ...m, minutes: estimateQueueMinutes(generateWorkoutQueue(dayItems, m.key)) }
  )), [dayItems]);

  // ── STATS CALCULATION FOR DONE SCREEN ─────────────────────────────────────
  const doneStats = useMemo(() => {
    const completedCount = loggedSets.filter(s => s.actualVal != null).length;
    const totalVolumeKg = loggedSets.reduce((acc, s) => {
      return acc + (s.actualVal != null && s.unit !== 's' ? s.actualVal * (s.kg || 0) : 0);
    }, 0);
    const prExercises = new Set(loggedSets.filter(s => s.isPR).map(s => s.exerciseKey));

    // Auto-progression evaluation for each day item
    const progressionCandidates = dayItems.map(item => {
      const itemSets = loggedSets.filter(s => s.exerciseKey === item.exercise_key).map(s => s.actualVal);
      const evalRes = checkAutoProgression(
        itemSets,
        item.target_val,
        item.target_sets,
        item.unit
      );
      return {
        routineItemId: item.id,
        exercise_key: item.exercise_key,
        name: nameOf(item.exercise_key),
        currentVal: item.target_val,
        nextVal: evalRes.nextTarget,
        unit: item.unit,
        shouldProgress: evalRes.shouldProgress,
        step: evalRes.step,
        completedSets: itemSets.filter(v => v != null).length,
        totalTargetSets: item.target_sets
      };
    });

    // So với buổi gần nhất có tập từng bài (không cộng dồn toàn bộ lịch sử)
    const previousSets = [];
    prevByExercise.forEach((prev, key) => {
      prev.sets.forEach(s => previousSets.push({ ...s, exercise_key: key }));
    });
    const prevComparison = compareSessionWithPrevious(loggedSets, previousSets);

    return {
      completedCount,
      totalSets: queue.length,
      totalVolumeKg: Math.round(totalVolumeKg),
      prCount: prExercises.size,
      progressionCandidates,
      prevComparison
    };
  }, [loggedSets, queue.length, dayItems, prevByExercise, nameOf]);

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

  // Màn nghỉ: thông tin set kế tiếp
  const nextItem = restNextIdx != null ? queue[restNextIdx] : null;
  const nextPrevInSession = nextItem && nextItem.set_no > 1 ? (logs[nextItem.exercise_key] || [])[nextItem.set_no - 2] : undefined;

  // Bài tính giây: gợi ý tư thế đổi mỗi 6 giây khi đang giữ
  const formCues = exDef?.form_cues || [];
  const activeCueIdx = tRunning && formCues.length ? Math.floor(tSec / 6) % formCues.length : -1;
  const C104 = 2 * Math.PI * 104;
  const timedTarget = Number(currentItem?.target_val) || 0;
  const timedProgress = timedTarget ? Math.min(1, tSec / timedTarget) : 0;

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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', gap: '16px' }}>
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
            <AppIcon name="warning" size={16} />
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
        gap: '8px',
        padding: '8px 10px 8px 16px',
        borderRadius: '14px',
        background: 'var(--body-card-bg)',
        border: '1px solid var(--body-card-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
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
          <span style={{ fontSize: '13px', color: 'var(--body-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {screenState !== 'done' && positionLabel}
          </span>
        </div>

        <button
          type="button"
          className="body-btn-icon"
          style={{ width: '36px', height: '36px', flex: 'none' }}
          onClick={() => setShowExitModal(true)}
          aria-label="Kết thúc / tạm dừng buổi tập"
        >
          <AppIcon name="dots" size={20} weight="bold" />
        </button>
      </div>

      {/* ── PROGRESS SEGMENTS ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {queue.map((item, i) => {
          const isDone = doneKeys.has(slotOfItem(item));
          const isCur = i === curQueueIdx && screenState !== 'done';
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
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, lineHeight: 1.25 }}>{exDef?.name}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 12px', marginTop: '6px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-accent)' }}>
                {currentItem?.total_sets} × {formatValWithUnit(currentItem?.target_val, currentItem?.unit)}
                {currentItem?.kg ? ` · ${currentItem.kg} kg` : ''}
              </span>
              {prevLine(currentItem?.exercise_key) && (
                <span style={{ fontSize: '12.5px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-sub)' }}>
                  lần trước {prevLine(currentItem?.exercise_key)}
                </span>
              )}
            </div>
          </div>

          {/* Chọn chế độ trước set đầu tiên, sau đó cố định suốt buổi */}
          {!modeLocked && dayItems.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
                {modeOptions.map(m => {
                  const on = mode === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMode(m.key)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: '10px',
                        border: `1.5px solid ${on ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                        background: on ? 'var(--body-accent-soft)' : 'transparent',
                        color: on ? 'var(--body-accent)' : 'var(--body-text-main)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        textAlign: 'center'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>{m.label}</span>
                      <span style={{ fontSize: '11.5px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>~{m.minutes} phút</span>
                    </button>
                  );
                })}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
                {MODES.find(m => m.key === mode)?.desc}
              </span>
            </div>
          )}

          <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: 1.6, color: 'var(--body-text-main)' }}>
            {(exDef?.steps || []).map((step, sIdx) => (
              <li key={sIdx} style={{ marginBottom: '4px' }}>{step}</li>
            ))}
          </ol>

          <details className="body-live-details">
            <summary>Chi tiết kỹ thuật & video</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', fontSize: '12.5px', lineHeight: 1.5 }}>
              {exDef?.breathing && <div><strong>Thở:</strong> {exDef.breathing}</div>}
              {exDef?.tempo && <div><strong>Tempo:</strong> {exDef.tempo}</div>}
              {exDef?.tip && <div style={{ color: 'var(--body-red)' }}><strong>Lỗi hay gặp:</strong> {exDef.tip}</div>}

              {exDef?.injury_risk && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--body-red-soft)',
                  color: 'var(--body-text-main)'
                }}>
                  <div>{exDef.injury_risk}</div>
                  {(exDef.contraindications || []).length > 0 && (
                    <div style={{ marginTop: '4px', color: 'var(--body-red)', fontWeight: 600 }}>
                      Không nên tập nếu: {exDef.contraindications.join(', ')}
                    </div>
                  )}
                  {exDef.easier_variation && (
                    <div style={{ marginTop: '4px', color: 'var(--body-green-text)' }}>
                      Quá khó? Thử <strong>{BASE_EXERCISES.find(e => e.key === exDef.easier_variation)?.name}</strong>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                className="body-btn body-btn-secondary"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setShowDetailModal(true)}
              >
                Bản đồ cơ & video
              </button>

              <ExerciseVideoPlayer
                exerciseKey={currentItem?.exercise_key}
                exerciseName={exDef?.name}
                defaultUrl={exDef?.video_url}
                compact={true}
              />
            </div>
          </details>

          <div className="body-live-actions" style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              className="body-btn body-btn-primary"
              style={{ padding: '0 24px', height: '44px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setScreenState('set')}
            >
              <span>Bắt đầu set {currentItem?.set_no || 1}</span>
              <AppIcon name="arrowRight" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── BƯỚC 2: GHI SET (REP HOẶC BẤM GIỜ) ──────────────────── */}
      {screenState === 'set' && (
        <div className="body-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, lineHeight: 1.25 }}>{exDef?.name}</h2>
              {prevLine(currentItem?.exercise_key) && (
                <div style={{ fontSize: '12px', color: 'var(--body-text-sub)', marginTop: '4px', fontFamily: 'var(--body-mono)' }}>
                  lần trước {prevLine(currentItem?.exercise_key)}
                </div>
              )}
            </div>
            <button
              className="body-btn body-btn-secondary"
              style={{ fontSize: '12px', height: '30px', flex: 'none' }}
              onClick={() => setScreenState('guide')}
            >
              Hướng dẫn
            </button>
          </div>

          {/* Trạng thái từng set của bài đang tập */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Array.from({ length: currentItem?.total_sets || 0 }, (_, j) => {
              const val = (logs[currentItem.exercise_key] || [])[j];
              const has = val !== undefined;
              const isNow = j + 1 === currentItem.set_no;
              const ok = has && val != null && val >= currentItem.target_val;
              return (
                <span
                  key={j}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: 'var(--body-mono)',
                    fontWeight: 600,
                    border: `1px solid ${isNow ? 'var(--body-accent)' : ok ? 'var(--body-green)' : has ? 'var(--body-amber)' : 'var(--body-card-border)'}`,
                    background: isNow ? 'var(--body-accent-soft)' : ok ? 'var(--body-green-soft)' : has ? 'var(--body-amber-soft)' : 'var(--body-card-bg)',
                    color: isNow ? 'var(--body-accent)' : 'var(--body-text-main)'
                  }}
                >
                  S{j + 1} · {isNow ? '…' : !has ? formatValWithUnit(currentItem.target_val, currentItem.unit) : val == null ? 'bỏ' : formatValWithUnit(val, currentItem.unit)}
                </span>
              );
            })}
          </div>

          {/* Bài đếm rep */}
          {currentItem?.unit !== 's' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: 'auto 0' }}>
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
                    {currentVal >= currentItem.target_val ? '✓ ' : ''}mục tiêu {currentItem.target_val} rep{currentItem.kg ? ` · ${currentItem.kg} kg` : ''}
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
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Bài đếm giây (Plank / Dead Hang) */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', margin: 'auto 0' }}>
              <div style={{ position: 'relative', width: '230px', height: '230px' }}>
                <svg width="230" height="230" viewBox="0 0 230 230">
                  <circle cx="115" cy="115" r="104" fill="none" stroke="var(--body-border-subtle)" strokeWidth="10" />
                  <circle
                    cx="115"
                    cy="115"
                    r="104"
                    fill="none"
                    stroke={tSec >= timedTarget ? 'var(--body-green)' : 'var(--body-accent)'}
                    strokeWidth="10"
                    strokeDasharray={`${(C104 * timedProgress).toFixed(1)} ${C104.toFixed(1)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 115 115)"
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '52px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: tSec >= timedTarget ? 'var(--body-green)' : 'var(--body-text-main)' }}>
                    {formatClock(tSec)}
                  </span>
                  <span style={{ fontSize: '12.5px', color: 'var(--body-text-muted)' }}>
                    {tSec >= timedTarget ? `Đạt mục tiêu · +${tSec - timedTarget} giây` : `mục tiêu ${formatClock(timedTarget)} · còn ${timedTarget - tSec} giây`}
                  </span>
                </div>
              </div>

              {formCues.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '420px' }}>
                  {formCues.map((cue, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12.5px', lineHeight: 1.45, color: i === activeCueIdx ? 'var(--body-text-main)' : 'var(--body-text-muted)', fontWeight: i === activeCueIdx ? 600 : 400 }}>
                      <AppIcon name={i === activeCueIdx ? 'checkCircle' : 'check'} size={14} style={{ color: i === activeCueIdx ? 'var(--body-accent)' : 'var(--body-border-subtle)', flex: 'none', marginTop: '2px' }} />
                      <span>{cue}</span>
                    </div>
                  ))}
                </div>
              )}

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

          <div className="body-live-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--body-card-border)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="body-btn body-btn-secondary"
                onClick={() => handleLogSet(null)}
              >
                Bỏ set
              </button>
              <button
                className="body-btn body-btn-secondary"
                onClick={handleSkipExercise}
                title="Bỏ các set còn lại của bài này"
              >
                Bỏ bài
              </button>
            </div>

            <button
              className="body-btn body-btn-accent"
              style={{ padding: '0 24px', height: '42px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              disabled={currentItem.unit === 's' && tSec === 0}
              title={currentItem.unit === 's' && tSec === 0 ? 'Bấm "Bắt đầu đếm giờ" trước khi hoàn thành' : undefined}
              onClick={() => handleLogSet(currentItem.unit === 's' ? tSec : currentVal)}
            >
              <AppIcon name="checkCircle" size={18} />
              <span>Xong set {currentItem.set_no}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── BƯỚC 3: REST TIMER OVERLAY ──────────────────────────── */}
      {screenState === 'rest' && (
        <div className="body-rest-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#C4B6F4', textTransform: 'uppercase' }}>
              {REST_KIND_LABELS[restKind] || 'Nghỉ giữa set'}
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
              {nextItem ? `Set ${nextItem.set_no} / ${nextItem.total_sets} · ${nameOf(nextItem.exercise_key)}` : 'Hoàn thành buổi'}
            </div>
            {nextItem && (
              <div style={{ fontSize: '12.5px', color: '#B0B3BE' }}>
                Mục tiêu {formatValWithUnit(nextItem.target_val, nextItem.unit)}
                {nextItem.kg ? ` · ${nextItem.kg} kg` : ''}
                {nextPrevInSession !== undefined
                  ? ` · set trước ${nextPrevInSession == null ? 'bỏ' : formatValWithUnit(nextPrevInSession, nextItem.unit)}`
                  : prevLine(nextItem.exercise_key) ? ` · lần trước ${prevLine(nextItem.exercise_key)}` : ''}
              </div>
            )}
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
                const progressionsToApply = doneStats.progressionCandidates
                  .filter(c => c.shouldProgress && isUuid(c.routineItemId) && approvedProgressions[c.routineItemId || c.exercise_key])
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
                  const displayName = nameOf(item.exercise_key);

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
                              <span>{isSkipped ? 'Bỏ' : formatValWithUnit(val, item.unit)}</span>
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

      {/* Modal Chi tiết bài tập Fitness Pro (Video, Bản đồ cơ bắp 2D, Hướng dẫn) */}
      <ExerciseDetailModal
        exercise={exDef}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
      />

      {/* Modal xác nhận thoát: Tạm dừng vs Hủy buổi tập */}
      {showExitModal && (
        <GenericModal
          title="Buổi tập"
          maxWidth={420}
          onClose={() => setShowExitModal(false)}
        >
          <GenericModal.Body>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                screenState !== 'done' && {
                  icon: 'checkCircle', color: 'var(--body-green)', label: 'Kết thúc buổi', sub: 'Xem kết quả & lưu',
                  run: () => setScreenState('done')
                },
                {
                  icon: 'clock', color: 'var(--body-accent)', label: 'Tạm dừng', sub: 'Lưu dở, tiếp tục sau',
                  run: () => (onPause ? onPause(elapsed) : onCancel())
                },
                {
                  icon: 'trash', color: 'var(--body-red, #EF4444)', label: 'Hủy buổi tập', sub: 'Không lưu kết quả',
                  run: onCancel
                }
              ].filter(Boolean).map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'var(--body-card-bg)',
                    border: '1px solid var(--body-card-border)',
                    color: 'var(--body-text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setShowExitModal(false);
                    opt.run();
                  }}
                >
                  <span style={{ color: opt.color, display: 'grid', placeItems: 'center' }}>
                    <AppIcon name={opt.icon} size={22} weight="fill" />
                  </span>
                  <span>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: '14px', color: opt.color }}>{opt.label}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--body-text-muted)' }}>{opt.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </GenericModal.Body>
          <GenericModal.Footer>
            <button
              type="button"
              className="body-btn body-btn-secondary"
              onClick={() => setShowExitModal(false)}
            >
              Tiếp tục tập
            </button>
          </GenericModal.Footer>
        </GenericModal>
      )}
    </div>
  );
}

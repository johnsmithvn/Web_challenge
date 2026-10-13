import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AppIcon from '../AppIcon';
import { ConfirmModal } from '../ConfirmModal';
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
  buildPreviousSetsByExercise,
  pickSessionPR,
  splitExerciseName,
  splitDayName,
  splitTempo,
  DAY_TAG_COLORS
} from '../../utils/workoutLogic';

const MODES = [
  { key: 'straight', label: 'Từng bài', desc: 'Làm hết các set của một bài rồi sang bài kế.' },
  { key: 'circuit', label: 'Vòng liên hoàn', desc: 'Mỗi bài 1 set, chuyển bài 20 giây, hết vòng nghỉ 90 giây.' },
  { key: 'superset', label: 'Siêu set', desc: 'Ghép cặp 2 bài liên tục không nghỉ, nghỉ 75 giây sau mỗi cặp.' }
];

const LETTERS = 'ABCDEFGHIJKLMNOP';
const PREP_OPTIONS = [0, 5, 10, 15];
const RING_REST = 2 * Math.PI * 116;
const RING_TIMED = 2 * Math.PI * 104;

const slotOfRecord = (r) => getSlotKey(r.routineItemId, r.exerciseKey, r.setNo);
const slotOfItem = (q) => getSlotKey(q.routine_item_id, q.exercise_key, q.set_no);
const fmtVals = (vals, unit) => vals.map(v => (v == null ? 'bỏ' : unit === 's' ? `${v}s` : String(v))).join(' · ');
const fmtVal = (v, unit) => (unit === 's' ? `${v}s` : String(v));

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
  onUpdateSet,
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

  const [today] = useState(() => new Date());
  const [mode, setMode] = useState(initialMode || 'straight');
  const [modeLocked, setModeLocked] = useState(existingSets.length > 0);
  const [screenState, setScreenState] = useState('guide'); // 'guide' | 'set' | 'rest' | 'done'
  const [curQueueIdx, setCurQueueIdx] = useState(0);
  const [detailEx, setDetailEx] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editEx, setEditEx] = useState(null); // index bài đang mở ngăn sửa số ở màn kết quả

  useEffect(() => {
    if (editEx == null) return undefined;
    const onKey = ev => { if (ev.key === 'Escape') setEditEx(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editEx]);
  const [paused, setPaused] = useState(false);
  const [loggedSets, setLoggedSets] = useState(() => existingSets
    .slice()
    .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
    .map(s => ({
      id: s.id,
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
  const frozenAtRef = useRef(null);
  const restEndRef = useRef(null);
  const restLeftOnPauseRef = useRef(null);
  const plankStartTimeRef = useRef(null);

  const [restRemaining, setRestRemaining] = useState(0);
  const [restTotal, setRestTotal] = useState(60);
  const [restKind, setRestKind] = useState('set');
  const [restNextIdx, setRestNextIdx] = useState(null);

  // Bài tính giây: tSec = số giây đã giữ (hiển thị đếm ngược), prepLeft > 0 = đang đếm ngược chuẩn bị
  const [tSec, setTSec] = useState(0);
  const [tRunning, setTRunning] = useState(false);
  const [prepLeft, setPrepLeft] = useState(0);
  const prepEndRef = useRef(null);
  const [prepSec, setPrepSec] = useState(() => {
    try {
      const v = Number(localStorage.getItem('body.prepSec'));
      return PREP_OPTIONS.includes(v) ? v : 5;
    } catch {
      return 5;
    }
  });
  const choosePrepSec = (v) => {
    setPrepSec(v);
    try { localStorage.setItem('body.prepSec', String(v)); } catch { /* storage bị chặn */ }
  };

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

  // Các ô set của từng bài (theo thứ tự bài) — dùng cho thanh tiến độ và danh sách bài
  const groups = useMemo(
    () => dayItems.map((_, e) => queue.filter(q => q.exerciseIndex === e).sort((a, b) => a.set_no - b.set_no)),
    [dayItems, queue]
  );

  const nameOf = useCallback(
    (key) => exerciseMap.get(key)?.name || BASE_EXERCISES.find(e => e.key === key)?.name || key,
    [exerciseMap]
  );
  const exerciseOf = useCallback(
    (key) => exerciseMap.get(key) || BASE_EXERCISES.find(e => e.key === key) || null,
    [exerciseMap]
  );

  const doneKeys = useMemo(() => new Set(loggedSets.map(slotOfRecord)), [loggedSets]);
  const recordBySlot = useMemo(() => new Map(loggedSets.map(r => [slotOfRecord(r), r])), [loggedSets]);

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
  // Ô đang mở đã có bản ghi = đang quay lại sửa set (ghi lại sẽ cập nhật, không tạo bản ghi mới)
  const currentRecord = currentItem ? recordBySlot.get(slotOfItem(currentItem)) : undefined;
  const isEditing = Boolean(currentRecord);

  // Resolve exercise definition from map or fallback
  const exDef = useMemo(() => {
    if (!currentItem) return null;
    return exerciseOf(currentItem.exercise_key) || {
      name: currentItem.name || currentItem.exercise_key,
      primary: 'Toàn thân',
      secondary: [],
      steps: ['Thực hiện động tác đúng tư thế và kiểm soát chuyển động.'],
      tip: ''
    };
  }, [currentItem, exerciseOf]);

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

  // Đồng hồ buổi (wall-clock). Đứng yên khi tạm dừng hoặc ở màn kết quả; chạy lại thì dời mốc bắt đầu
  // đúng bằng khoảng đã đứng yên để không tính thời gian dừng vào buổi.
  const frozen = paused || screenState === 'done';
  useEffect(() => {
    if (sessionStartTimeRef.current == null) {
      sessionStartTimeRef.current = Date.now() - baseElapsed * 1000;
    }
    if (frozen) {
      frozenAtRef.current = Date.now();
      return undefined;
    }
    if (frozenAtRef.current != null) {
      sessionStartTimeRef.current += Date.now() - frozenAtRef.current;
      frozenAtRef.current = null;
    }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartTimeRef.current) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [frozen, baseElapsed]);

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

  // Bật đồng hồ bài tính giây: lần đầu của set thì đếm ngược chuẩn bị trước (nếu có), còn lại chạy tiếp từ số giây đã giữ
  const startTimer = (held) => {
    ensureAudioUnlocked();
    if (held === 0 && prepSec > 0) {
      prepEndRef.current = Date.now() + prepSec * 1000;
      setPrepLeft(prepSec);
    } else {
      plankStartTimeRef.current = Date.now() - held * 1000;
      setTRunning(true);
    }
  };
  const pauseTimer = () => {
    setTRunning(false);
    setPrepLeft(0);
  };

  // Chuyển sang ô set idx: set đầu tiên của 1 bài thì mở hướng dẫn (theo thiết kế), còn lại vào thẳng màn ghi set.
  // auto = tự chuyển sau khi nghỉ: bài tính giây vào thẳng màn set và tự bật đồng hồ (người tập không phải bấm)
  // direct = vào thẳng màn ghi set (quay lại sửa set đã ghi)
  const autoStartRef = useRef(false);
  const goToSlot = useCallback((idx, auto = false, direct = false) => {
    if (idx < 0 || idx >= queue.length) {
      setScreenState('done');
      return;
    }
    const autoTimed = auto && queue[idx].unit === 's';
    autoStartRef.current = autoTimed;
    setCurQueueIdx(idx);
    setScreenState(queue[idx].set_no === 1 && !autoTimed && !direct ? 'guide' : 'set');
  }, [queue]);

  // End rest handler defined BEFORE rest timer effect to avoid TDZ initialization error
  const handleEndRest = useCallback(() => {
    goToSlot(restNextIdx == null ? -1 : restNextIdx, true);
  }, [goToSlot, restNextIdx]);

  // Rest countdown timer (timestamp delta) — đứng yên khi tạm dừng
  useEffect(() => {
    if (screenState !== 'rest' || !restEndRef.current || paused) return;
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
  }, [screenState, handleEndRest, playTimerBeep, paused]);

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

  // Đếm ngược chuẩn bị → hết thì bíp và bắt đầu giữ (mốc bắt đầu = đúng lúc hết chuẩn bị)
  const preparing = prepLeft > 0;
  useEffect(() => {
    if (!preparing) return;
    const interval = setInterval(() => {
      const left = Math.ceil((prepEndRef.current - Date.now()) / 1000);
      if (left > 0) {
        setPrepLeft(left);
        return;
      }
      clearInterval(interval);
      playTimerBeep();
      plankStartTimeRef.current = prepEndRef.current;
      setPrepLeft(0);
      setTRunning(true);
    }, 200);
    return () => clearInterval(interval);
  }, [preparing, playTimerBeep]);

  // Reset input values khi sang ô set khác (so theo khóa ổn định, không theo object để tránh reset giữa chừng).
  // Ô đã ghi (quay lại sửa) điền sẵn số đã ghi.
  useEffect(() => {
    if (!currentSlotKey) return;
    const item = queue[curQueueIdx];
    const rec = recordBySlot.get(slotOfItem(item));
    const recVal = rec?.actualVal != null ? Number(rec.actualVal) : null;
    setCurrentVal(recVal ?? Number(item?.target_val || 10));
    setTSec(item?.unit === 's' && recVal != null ? recVal : 0);
    setTRunning(false);
    setPrepLeft(0);
    plankStartTimeRef.current = null;
    if (autoStartRef.current) {
      autoStartRef.current = false;
      startTimer(0);
    }
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
      goToSlot(next, true);
      return;
    }
    setRestKind(getRestKind(mode, queue[fromIdx], queue[next]));
    setRestNextIdx(next);
    setRestTotal(restSec);
    setRestRemaining(restSec);
    restEndRef.current = Date.now() + restSec * 1000;
    if (paused) restLeftOnPauseRef.current = restSec * 1000;
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

  // Tạm dừng tại chỗ: đứng đồng hồ buổi, đồng hồ nghỉ và đồng hồ bài giây. Tiếp tục thì nghỉ chạy tiếp phần còn lại.
  const togglePause = () => {
    if (paused) {
      if (restLeftOnPauseRef.current != null) {
        restEndRef.current = Date.now() + restLeftOnPauseRef.current;
        restLeftOnPauseRef.current = null;
      }
      setPaused(false);
      return;
    }
    if (screenState === 'rest' && restEndRef.current) {
      restLeftOnPauseRef.current = Math.max(0, restEndRef.current - Date.now());
    }
    pauseTimer();
    setPaused(true);
  };

  const handleEnd = () => {
    pauseTimer();
    restLeftOnPauseRef.current = null;
    setPaused(false);
    setScreenState('done');
  };

  // Về Lộ trình: lưu thời lượng, buổi vẫn ở trạng thái dở để tiếp tục sau
  const handleBack = () => (onPause ? onPause(elapsed) : onCancel?.());

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
    id: crypto.randomUUID(), // id do client tạo để sửa lại được ở màn kết quả
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

  // PR: vượt mốc lịch sử VÀ vượt các set trước của chính buổi này (mỗi bài tối đa 1 lần lên kỷ lục mới)
  const isPRFor = (item, actualVal) => {
    if (actualVal == null) return false;
    const sessionBase = buildPrBaselines(loggedSets).get(item.exercise_key);
    const candidate = { actualVal, kg: item.kg || 0 };
    return isNewPR(candidate, historyBaselines.get(item.exercise_key))
      && (!sessionBase || isNewPR(candidate, sessionBase));
  };

  // Áp danh sách set mới của 1 bài (đã sửa / thêm), tính lại cờ PR của bài (tối đa 1 set) rồi lưu:
  // set mới → onLogSet, set đã có mà đổi số hoặc đổi cờ PR → onUpdateSet.
  const commitExercise = (exerciseKey, nextLogged, { insertedIds = [], editedIds = [] } = {}) => {
    const prId = pickSessionPR(nextLogged.filter(s => s.exerciseKey === exerciseKey), historyBaselines.get(exerciseKey));
    const toInsert = [];
    const toUpdate = [];
    const final = nextLogged.map(s => {
      if (s.exerciseKey !== exerciseKey) return s;
      const isPR = s.id === prId;
      const out = isPR === s.isPR ? s : { ...s, isPR };
      if (insertedIds.includes(s.id)) toInsert.push(out);
      else if (editedIds.includes(s.id) || out !== s) toUpdate.push(out);
      return out;
    });
    setLoggedSets(final);
    toInsert.forEach(persistRecord);
    if (!onUpdateSet) return;
    toUpdate.forEach(s => {
      if (!s.id) return;
      onUpdateSet(s.id, s.actualVal, { isPR: s.isPR }).catch(err => {
        console.error('Failed to update set:', err);
        setSaveError('Không lưu được giá trị vừa sửa. Thử sửa lại.');
      });
    });
  };

  // Sửa giá trị 1 set đã ghi (null = bỏ set)
  const updateRecordValue = (record, actualVal) => {
    if (actualVal === record.actualVal) return;
    commitExercise(record.exerciseKey, loggedSets.map(s => (s === record ? { ...s, actualVal } : s)), { editedIds: [record.id] });
  };

  // Ghi thêm 1 set ở màn kết quả (set còn trống hoặc set vượt kế hoạch)
  const insertRecord = (slot, actualVal) => {
    const nextSeq = Math.max(0, ...loggedSets.map(s => Number(s.sequenceOrder) || 0)) + 1;
    const record = buildRecord({ ...slot, sequence_order: slot.sequence_order ?? nextSeq }, actualVal, false);
    commitExercise(record.exerciseKey, [...loggedSets, record], { insertedIds: [record.id] });
  };

  const handleLogSet = (valToLog) => {
    ensureAudioUnlocked();
    if (!currentItem) return;
    pauseTimer();

    // valToLog === null means set was explicitly skipped
    const actualVal = valToLog === null ? null : Number(valToLog);

    // Quay lại sửa set đã ghi: cập nhật bản ghi cũ rồi tới ô còn trống kế tiếp (không nghỉ)
    if (currentRecord) {
      updateRecordValue(currentRecord, actualVal);
      goToSlot(findNextOpenIndex(queue, doneKeys, curQueueIdx));
      return;
    }

    lockModeIfNeeded();
    const record = buildRecord(currentItem, actualVal, isPRFor(currentItem, actualVal));
    setLoggedSets(prev => [...prev, record]);
    persistRecord(record);
    advanceAfter(curQueueIdx, new Set([...doneKeys, slotOfRecord(record)]));
  };

  // Các set còn trống của bài đang tập (gồm cả set hiện tại)
  const openSetsOfCurrent = currentItem
    ? queue.filter(q => q.exercise_key === currentItem.exercise_key
      && q.exerciseIndex === currentItem.exerciseIndex
      && !doneKeys.has(slotOfItem(q)))
    : [];

  // Đóng mọi set còn trống của bài hiện tại một lần; valOf(q) = giá trị ghi cho set đó (null = bỏ)
  const closeExercise = (valOf) => {
    if (openSetsOfCurrent.length === 0) return;
    pauseTimer();
    lockModeIfNeeded();
    const vals = openSetsOfCurrent.map(valOf);
    const best = vals.indexOf(Math.max(...vals.map(v => v ?? -1))); // chỉ set cao nhất được xét PR
    const records = openSetsOfCurrent.map((q, i) => buildRecord(q, vals[i], i === best && isPRFor(q, vals[i])));
    setLoggedSets(prev => [...prev, ...records]);
    records.forEach(persistRecord);
    advanceAfter(curQueueIdx, new Set([...doneKeys, ...records.map(slotOfRecord)]));
  };

  // Bỏ cả bài: các set còn trống ghi là "bỏ"
  const handleSkipExercise = () => closeExercise(() => null);

  // Xong cả bài: set đang tập lấy số rep đang chọn, các set còn lại điền đủ mục tiêu
  const handleFinishExercise = () => closeExercise(q => (
    q.set_no === currentItem.set_no ? Number(currentVal) : Number(q.target_val)
  ));


  // Quay lại: set trước trong hàng đợi, set vừa ghi (từ màn nghỉ), hoặc bấm thẳng vào 1 ô set
  const goPrevSlot = () => {
    pauseTimer();
    goToSlot(curQueueIdx - 1, false, true);
  };
  const editJustLogged = () => goToSlot(curQueueIdx, false, true);
  const jumpToSlot = (q) => {
    pauseTimer();
    goToSlot(queue.indexOf(q), false, recordBySlot.has(slotOfItem(q)));
  };
  const nextOpenIdx = findNextOpenIndex(queue, doneKeys, -1);

  const startSetFromGuide = () => {
    setScreenState('set');
    if (currentItem?.unit === 's' && !tRunning && !preparing) startTimer(tSec);
  };

  // Unique exercises count and current exercise index for header label
  const uniqueExerciseKeys = useMemo(() => {
    return Array.from(new Set(queue.map(q => q.exercise_key)));
  }, [queue]);

  const currentExerciseIdx = currentItem
    ? uniqueExerciseKeys.indexOf(currentItem.exercise_key) + 1
    : 1;

  const totalRounds = useMemo(() => Math.max(0, ...dayItems.map(it => Number(it.target_sets) || 1)), [dayItems]);
  const positionLabel = screenState === 'done' ? 'Hoàn thành' : !currentItem ? '' : mode === 'circuit'
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
    const totalReps = loggedSets.reduce((acc, s) => acc + (s.actualVal != null && s.unit !== 's' ? Number(s.actualVal) : 0), 0);

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
        currentVal: item.target_val,
        nextVal: evalRes.nextTarget,
        unit: item.unit,
        shouldProgress: evalRes.shouldProgress
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
      totalReps,
      progressionCandidates,
      prevComparison
    };
  }, [loggedSets, queue.length, dayItems, prevByExercise]);

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
  const timedTarget = Number(currentItem?.target_val) || 0;
  const timedProgress = timedTarget ? Math.min(1, tSec / timedTarget) : 0;

  // Đếm ngược về 0 → bíp, tự ghi set đủ mục tiêu và sang bước kế (sai số sửa được ở màn kết quả)
  useEffect(() => {
    if (screenState !== 'set' || !tRunning || timedTarget <= 0 || tSec < timedTarget) return;
    playTimerBeep();
    handleLogSet(timedTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenState, tRunning, tSec, timedTarget]);

  // If queue is empty (e.g. rest day selected)
  if (queue.length === 0) {
    return (
      <div className="body-card body-ls-empty">
        <div className="body-ls-empty-ic">
          <AppIcon name="calendar" size={24} />
        </div>
        <h3>Không có bài tập theo lịch hôm nay</h3>
        <p>
          Hôm nay là ngày nghỉ hoặc chưa có bài tập nào được gán cho thứ này. Bạn có thể chọn ngày khác hoặc quay lại Lộ trình.
        </p>
        <button className="body-btn body-btn-primary" onClick={onCancel} style={{ padding: '0 20px', height: '38px' }}>
          Quay lại Lộ trình
        </button>
      </div>
    );
  }

  // ── Dữ liệu hiển thị ─────────────────────────────────────────
  const day = splitDayName(dayInfo?.singleExercise ? '' : dayInfo?.name || '');
  const sessionTitle = dayInfo?.singleExercise
    ? splitExerciseName(dayInfo.name || '').vn
    : day.title || 'Buổi tập';
  const sessionEyebrow = [
    day.tag || (dayInfo?.singleExercise ? 'Tập lẻ' : ''),
    `${today.toLocaleDateString('vi-VN', { weekday: 'long' })} ${today.getDate()}/${today.getMonth() + 1}`
  ].filter(Boolean).join(' · ').toUpperCase();
  const eyebrowColor = DAY_TAG_COLORS[day.letter] || 'var(--body-accent)';

  const exName = splitExerciseName(exDef?.name || '');
  const tempo = splitTempo(exDef?.tempo || '');
  const easierEx = exDef?.easier_variation ? exerciseOf(exDef.easier_variation) : null;
  const contra = (exDef?.contraindications || []).join(', ');
  const isTimed = currentItem.unit === 's';
  const met = currentVal >= currentItem.target_val;
  const canFinishAll = !isTimed && !isEditing && openSetsOfCurrent.length > 1;
  const curPrev = prevLine(currentItem.exercise_key);
  const restProgress = restTotal ? restRemaining / restTotal : 0;

  // Trạng thái 1 ô set: đang mở / chưa ghi / bỏ / đạt / chưa đạt mục tiêu
  const slotState = (q) => {
    if ((screenState === 'guide' || screenState === 'set') && q === currentItem) return 'cur';
    const r = recordBySlot.get(slotOfItem(q));
    if (!r) return 'todo';
    if (r.actualVal == null) return 'skip';
    return r.actualVal >= q.target_val ? 'ok' : 'low';
  };
  const slotLabel = (q) => {
    const r = recordBySlot.get(slotOfItem(q));
    if (slotState(q) === 'cur' && !r) return '…';
    if (!r) return '—';
    return r.actualVal == null ? 'bỏ' : fmtVal(r.actualVal, q.unit);
  };

  // ── Sửa số ở màn kết quả ─────────────────────────────────────
  // Các set của 1 bài: ô theo kế hoạch (có thể chưa ghi) + set ghi thêm ngoài kế hoạch
  const setRowsOf = (e) => {
    const item = dayItems[e];
    if (!item) return [];
    const slots = (groups[e] || []).map(q => ({ key: `s${q.set_no}`, setNo: q.set_no, slot: q, record: recordBySlot.get(slotOfItem(q)) || null }));
    const inSlots = new Set(slots.map(r => r.record?.id).filter(Boolean));
    const extras = loggedSets
      .filter(r => r.exerciseKey === item.exercise_key && !inSlots.has(r.id) && r.setNo > (Number(item.target_sets) || 0))
      .sort((a, b) => a.setNo - b.setNo)
      .map(r => ({ key: r.id, setNo: r.setNo, slot: null, record: r, extra: true }));
    return [...slots, ...extras];
  };
  const rowState = (row, item) => {
    if (!row.record) return 'todo';
    if (row.record.actualVal == null) return 'skip';
    return row.record.actualVal >= Number(item.target_val) ? 'ok' : 'low';
  };
  const commitTyped = (record, raw) => {
    if (String(raw).trim() === '') return;
    const val = Math.max(0, Math.round(Number(raw)));
    if (!Number.isNaN(val)) updateRecordValue(record, val);
  };
  // Thêm 1 set ngoài kế hoạch (tập dư); giá trị mặc định = mục tiêu, sửa tiếp bằng −/+
  const addExtraSet = (e) => {
    const item = dayItems[e];
    const rows = setRowsOf(e);
    const setNo = Math.max(Number(item.target_sets) || 0, ...rows.map(r => r.setNo)) + 1;
    const sequenceOrder = Math.max(0, ...loggedSets.map(s => Number(s.sequenceOrder) || 0)) + 1;
    insertRecord({
      routine_item_id: item.id,
      exercise_key: item.exercise_key,
      set_no: setNo,
      sequence_order: sequenceOrder,
      target_val: item.target_val,
      unit: item.unit || 'rep',
      kg: item.kg || 0
    }, Number(item.target_val) || 0);
  };

  const segments = (
    <div className="body-ls-segs" aria-hidden="true">
      {groups.map((g, e) => (
        <span key={e} style={{ flex: g.length }}>
          {g.map(q => <i key={q.set_no} className={`is-${slotState(q)}`} />)}
        </span>
      ))}
    </div>
  );

  const backButton = curQueueIdx > 0 && (
    <button type="button" className="body-ls-btn is-back" onClick={goPrevSlot} title="Quay lại set trước" aria-label="Quay lại set trước">
      <AppIcon name="caretLeft" size={15} /><span className="body-ls-d-text">Set trước</span>
    </button>
  );

  const prepPicker = !modeLocked && dayItems.some(it => it.unit === 's') && (
    <div className="body-ls-prep">
      <span>Chuẩn bị trước set giây</span>
      <div className="body-ls-seg">
        {PREP_OPTIONS.map(v => (
          <button key={v} type="button" className={prepSec === v ? 'is-on' : ''} onClick={() => choosePrepSec(v)} aria-pressed={prepSec === v}>
            {v === 0 ? 'Tắt' : `${v}s`}
          </button>
        ))}
      </div>
    </div>
  );

  // ── HƯỚNG DẪN: cách làm bên trái, video + nhóm cơ bên phải ───────────
  const guideView = (
    <>
      <div className="body-ls-scroll">
        <div className="body-ls-guide">
          <div className="body-ls-g-main">
            <div className="body-ls-g-head">
              <span className="body-ls-eyebrow is-accent">
                BÀI {currentExerciseIdx} / {uniqueExerciseKeys.length}{currentItem.set_no > 1 ? ` · SET ${currentItem.set_no}` : ''}
              </span>
              <h2 className="body-ls-g-title">{exName.vn}</h2>
              {exName.en && <span className="body-ls-g-en">{exName.en}</span>}
              <div className="body-ls-g-chips">
                <span className="body-ls-chip is-target">
                  {currentItem.total_sets} × {formatValWithUnit(currentItem.target_val, currentItem.unit)}
                </span>
                <span className="body-ls-chip">{currentItem.kg ? `${currentItem.kg} kg` : 'BW'} · nghỉ {currentItem.rest_seconds}s</span>
                {curPrev && (
                  <span className="body-ls-chip">
                    <AppIcon name="history" size={14} /><span className="body-ls-d-text">Lần trước</span> <b>{curPrev}</b>
                  </span>
                )}
              </div>
            </div>

            {/* Mobile: chọn cách tập ngay trong hướng dẫn (desktop nằm ở cột trái) */}
            {!modeLocked && dayItems.length > 1 && (
              <div className="body-ls-mmodes">
                <span className="body-ls-mmodes-label">Cách tập buổi này</span>
                <div className="body-ls-mmodes-grid">
                  {modeOptions.map(m => (
                    <button
                      key={m.key}
                      type="button"
                      className={mode === m.key ? 'is-on' : ''}
                      onClick={() => setMode(m.key)}
                      aria-pressed={mode === m.key}
                    >
                      <b>{m.label}</b>
                      <small>~{m.minutes} phút</small>
                    </button>
                  ))}
                </div>
                <span className="body-ls-mmodes-desc">{MODES.find(m => m.key === mode)?.desc}</span>
              </div>
            )}
            {prepPicker && <div className="body-ls-m-prep">{prepPicker}</div>}

            <div className="body-ls-g-steps">
              <span className="body-ls-label">CÁCH LÀM</span>
              {(exDef?.steps || []).map((step, i) => (
                <div key={i} className="body-ls-step">
                  <span>{i + 1}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>

            {(exDef?.breathing || exDef?.tempo) && (
              <div className="body-ls-g-cards">
                {exDef?.breathing && (
                  <div>
                    <span className="body-ls-label">NHỊP THỞ</span>
                    <p>{exDef.breathing}</p>
                  </div>
                )}
                {exDef?.tempo && (
                  <div>
                    <span className="body-ls-label">TEMPO</span>
                    {tempo.code && <b>{tempo.code}</b>}
                    <p>{tempo.text}</p>
                  </div>
                )}
              </div>
            )}

            {(exDef?.tip || contra) && (
              <div className="body-ls-tip">
                <AppIcon name="warning" size={18} weight="fill" />
                <div>
                  <b>Lỗi hay gặp</b>
                  {exDef?.tip && <p>{exDef.tip}</p>}
                  {contra && <strong>Không nên tập nếu: {contra}</strong>}
                </div>
              </div>
            )}

            {easierEx && (
              <button type="button" className="body-ls-easier" onClick={() => setDetailEx(easierEx)}>
                <span>Quá khó? Đổi sang <b>{splitExerciseName(easierEx.name).vn}</b></span>
                <AppIcon name="repeat" size={15} />
              </button>
            )}
          </div>

          <div className="body-ls-g-aside">
            <ExerciseVideoPlayer
              exerciseKey={currentItem.exercise_key}
              exerciseName={exDef?.name}
              defaultUrl={exDef?.video_url}
            />
            <div className="body-ls-muscles">
              <span className="body-ls-label">NHÓM CƠ</span>
              <div className="body-ls-mgrid">
                <span>Chính</span>
                <span><i className="is-prim">{MUSCLE_MAP[exDef?.primary]?.name || exDef?.primary}</i></span>
                {(exDef?.secondary || []).length > 0 && (
                  <>
                    <span>Phụ</span>
                    <span>{exDef.secondary.map(m => <i key={m}>{MUSCLE_MAP[m]?.name || m}</i>)}</span>
                  </>
                )}
              </div>
              <button type="button" className="body-ls-link" onClick={() => setDetailEx(exDef)}>
                Mở bản đồ cơ<AppIcon name="arrowRight" size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="body-ls-foot">
        <div className="body-ls-foot-group">
          {backButton}
          <button type="button" className="body-ls-btn" onClick={handleSkipExercise}>
            <AppIcon name="skip" size={14} />Bỏ bài<span className="body-ls-d-text"> này</span>
          </button>
        </div>
        <button type="button" className="body-ls-btn is-primary" onClick={startSetFromGuide}>
          Bắt đầu set {currentItem.set_no}<AppIcon name="arrowRight" size={16} />
        </button>
      </div>
    </>
  );

  // ── GHI SET (đếm rep hoặc bấm giờ) ─────────────────────────────────
  const setView = (
    <>
      <div className="body-ls-scroll is-set">
        <div className="body-ls-set-head">
          <div>
            <span className="body-ls-eyebrow is-accent">
              SET {currentItem.set_no} / {currentItem.total_sets}{isEditing ? ' · ĐANG SỬA' : ''}
            </span>
            <h2 className="body-ls-set-title">{exName.vn}</h2>
            {curPrev && <span className="body-ls-mono-sub">lần trước {curPrev}</span>}
          </div>
          <button
            type="button"
            className="body-ls-btn is-guide"
            onClick={() => { pauseTimer(); setScreenState('guide'); }}
            aria-label="Xem hướng dẫn"
          >
            <AppIcon name="book" size={15} /><span className="body-ls-d-text">Xem hướng dẫn</span>
          </button>
        </div>

        <div className="body-ls-set-center">
          <div className="body-ls-set-chips">
            {(groups[currentItem.exerciseIndex] || []).map(q => {
              const st = slotState(q);
              const r = recordBySlot.get(slotOfItem(q));
              return (
                <button
                  key={q.set_no}
                  type="button"
                  className={`body-ls-schip is-${st}`}
                  onClick={() => jumpToSlot(q)}
                  disabled={st === 'cur'}
                  title={r ? `Sửa set ${q.set_no}` : `Sang set ${q.set_no}`}
                >
                  S{q.set_no} · {st === 'cur' ? '…' : r ? slotLabel(q) : fmtVal(q.target_val, q.unit)}
                </button>
              );
            })}
          </div>

          {!isTimed ? (
            <>
              <div className="body-ls-counter">
                <button type="button" className="body-ls-round" onClick={() => setCurrentVal(prev => Math.max(0, prev - 1))} aria-label="Giảm 1 rep">
                  <AppIcon name="minus" size={26} />
                </button>
                <div className="body-ls-counter-val">
                  <b className={met ? 'is-met' : ''}>{currentVal}</b>
                  <span className={met ? 'is-met' : ''}>
                    <AppIcon name={met ? 'checkCircle' : 'flag'} size={15} weight={met ? 'fill' : 'regular'} />
                    {met ? 'đạt' : ''} mục tiêu {currentItem.target_val} rep{currentItem.kg ? ` · ${currentItem.kg} kg` : ''}
                  </span>
                </div>
                <button type="button" className="body-ls-round" onClick={() => setCurrentVal(prev => prev + 1)} aria-label="Tăng 1 rep">
                  <AppIcon name="plus" size={26} />
                </button>
              </div>

              {/* Chọn nhanh 7 số liên tiếp quanh mục tiêu (−4 … +2) */}
              <div className="body-ls-quick">
                {Array.from({ length: 7 }, (_, i) => Math.max(0, Number(currentItem.target_val) - 4) + i).map(v => (
                  <button key={v} type="button" className={v === currentVal ? 'is-on' : ''} onClick={() => setCurrentVal(v)}>
                    {v}
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Bài đếm giây (Plank / Dead Hang) */
            <div className="body-ls-timed">
              <div className={`body-ls-ring is-timed${preparing ? ' is-prep' : ''}`}>
                <svg viewBox="0 0 230 230">
                  <circle cx="115" cy="115" r="104" className="body-ls-ring-track" />
                  <circle
                    cx="115"
                    cy="115"
                    r="104"
                    className="body-ls-ring-bar"
                    strokeDasharray={`${(RING_TIMED * (preparing ? prepLeft / (prepSec || 1) : 1 - timedProgress)).toFixed(1)} ${RING_TIMED.toFixed(1)}`}
                  />
                </svg>
                <div>
                  <b>{preparing ? prepLeft : formatClock(Math.max(0, timedTarget - tSec))}</b>
                  <span>{preparing ? 'chuẩn bị' : `/ ${formatClock(timedTarget)}`}</span>
                </div>
              </div>

              <div className="body-ls-timed-actions">
                <button type="button" className="body-ls-btn" onClick={() => (tRunning || preparing ? pauseTimer() : startTimer(tSec))}>
                  <AppIcon name={tRunning || preparing ? 'pause' : 'play'} size={16} />
                  {tRunning || preparing ? 'Tạm dừng' : tSec > 0 ? 'Tiếp tục' : 'Bắt đầu'}
                </button>
                {tSec > 0 && !tRunning && (
                  <button type="button" className="body-ls-btn" onClick={() => { setTSec(0); plankStartTimeRef.current = null; }}>
                    Đặt lại
                  </button>
                )}
              </div>

              {formCues.length > 0 && (
                <div className="body-ls-cues">
                  {formCues.map((cue, i) => (
                    <div key={i} className={i === activeCueIdx ? 'is-on' : ''}>
                      <AppIcon name={i === activeCueIdx ? 'checkCircle' : 'check'} size={14} />
                      <span>{cue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {canFinishAll && (
            <button type="button" className="body-ls-finish-all" onClick={handleFinishExercise}>
              <AppIcon name="check" size={14} />Xong cả bài (các set sau đủ mục tiêu)
            </button>
          )}
        </div>
      </div>
      <div className="body-ls-foot">
        <div className="body-ls-foot-group">
          {backButton}
          <button type="button" className="body-ls-btn" onClick={() => handleLogSet(null)}>Bỏ set</button>
          <button type="button" className="body-ls-btn body-ls-d-only" onClick={handleSkipExercise} title="Bỏ các set còn lại của bài này">
            Bỏ bài
          </button>
        </div>
        <div className="body-ls-foot-group is-grow">
          {canFinishAll && (
            <button
              type="button"
              className="body-ls-btn is-green body-ls-d-only"
              onClick={handleFinishExercise}
              title="Set này theo số đang chọn, các set còn lại đủ mục tiêu"
            >
              <AppIcon name="check" size={16} />Xong cả bài
            </button>
          )}
          <button
            type="button"
            className="body-ls-btn is-primary"
            disabled={isTimed && tSec === 0}
            title={isTimed && tSec === 0 ? 'Bấm "Bắt đầu" đếm giờ trước khi hoàn thành' : undefined}
            onClick={() => handleLogSet(isTimed ? tSec : currentVal)}
          >
            <AppIcon name="checkCircle" size={18} weight="fill" />
            {isEditing ? `Lưu set ${currentItem.set_no}` : `Xong set ${currentItem.set_no}`}
          </button>
        </div>
      </div>
    </>
  );

  // ── NGHỈ ─────────────────────────────────────────────────────────────
  const restView = (
    <>
      <div className="body-ls-scroll is-rest-view">
        <span className="body-ls-rest-kind">{REST_KIND_LABELS[restKind] || 'Nghỉ giữa set'}</span>
        <div className={`body-ls-ring is-rest${restRemaining <= 10 ? ' is-ending' : ''}`}>
          <svg viewBox="0 0 260 260">
            <circle cx="130" cy="130" r="116" className="body-ls-ring-track" />
            <circle
              cx="130"
              cy="130"
              r="116"
              className="body-ls-ring-bar"
              strokeDasharray={`${(RING_REST * restProgress).toFixed(1)} ${RING_REST.toFixed(1)}`}
            />
          </svg>
          <div>
            <b>{formatClock(restRemaining)}</b>
            <span>/ {formatClock(restTotal)}</span>
          </div>
        </div>
        <div className="body-ls-rest-actions">
          <button type="button" className="body-ls-btn is-glass" onClick={() => handleAdjustRest(-15)} disabled={paused}>−15s</button>
          <button type="button" className="body-ls-btn is-glass" onClick={() => handleAdjustRest(15)} disabled={paused}>+15s</button>
          <button type="button" className="body-ls-btn is-primary is-sm body-ls-d-only" onClick={handleEndRest}>
            Bỏ qua nghỉ<AppIcon name="arrowRight" size={14} />
          </button>
        </div>
        <div className="body-ls-next">
          <span>TIẾP THEO</span>
          <b>{nextItem ? `Set ${nextItem.set_no} / ${nextItem.total_sets} · ${splitExerciseName(nameOf(nextItem.exercise_key)).vn}` : 'Hoàn thành buổi'}</b>
          {nextItem && (
            <small>
              Mục tiêu {formatValWithUnit(nextItem.target_val, nextItem.unit)}
              {nextItem.kg ? ` · ${nextItem.kg} kg` : ''}
              {nextPrevInSession !== undefined
                ? ` · set trước ${nextPrevInSession == null ? 'bỏ' : formatValWithUnit(nextPrevInSession, nextItem.unit)}`
                : prevLine(nextItem.exercise_key) ? ` · lần trước ${prevLine(nextItem.exercise_key)}` : ''}
            </small>
          )}
        </div>
        <button type="button" className="body-ls-undo" onClick={editJustLogged}>
          <AppIcon name="back" size={14} />Sửa set vừa ghi
        </button>
      </div>
      <div className="body-ls-foot is-rest">
        <button type="button" className="body-ls-btn is-primary is-block" onClick={handleEndRest}>
          Bỏ qua nghỉ<AppIcon name="arrowRight" size={16} />
        </button>
      </div>
    </>
  );

  // ── KẾT QUẢ: số đã ghi (sửa được) · lần trước · duyệt mục tiêu buổi sau ──
  const doneView = (
    <>
      <div className="body-ls-scroll">
        <div className="body-ls-done">
          <div className="body-ls-done-head">
            <span><AppIcon name="checkCircle" size={28} weight="fill" /></span>
            <div>
              <h2>Xong buổi {day.tag || sessionTitle}</h2>
              <p>Kiểm tra số đã ghi và duyệt mục tiêu cho buổi sau</p>
            </div>
          </div>

          <div className="body-ls-stats">
            <div><span>Thời gian</span><b>{formatClock(elapsed)}</b></div>
            <div><span>Set hoàn thành</span><b>{doneStats.completedCount}/{doneStats.totalSets}</b></div>
            <div><span>Tổng rep</span><b>{doneStats.totalReps}</b></div>
          </div>

          <div className="body-ls-table">
            <div className="body-ls-trow is-head">
              <span>BÀI TẬP</span><span>HÔM NAY</span><span>LẦN TRƯỚC</span><span>BUỔI SAU</span>
            </div>
            {dayItems.map((item, e) => {
              const cand = doneStats.progressionCandidates[e];
              const comp = doneStats.prevComparison.byExercise.find(x => x.exercise_key === item.exercise_key);
              const isPR = loggedSets.some(s => s.exerciseKey === item.exercise_key && s.isPR);
              const displayName = splitExerciseName(nameOf(item.exercise_key)).vn;
              const itemKey = cand.routineItemId || cand.exercise_key;
              const prev = prevLine(item.exercise_key);
              return (
                <div key={e} className="body-ls-trow">
                  <span className="body-ls-t-name">
                    {displayName}
                    {isPR && <span className="body-ls-pr"><AppIcon name="trophy" size={11} />PR</span>}
                  </span>
                  <span className="body-ls-t-today">
                    {/* Bấm vào dãy số hoặc "Sửa" để mở ngăn sửa từng set (lỡ bấm nhầm khi tập) */}
                    <button
                      type="button"
                      className="body-ls-t-vals"
                      onClick={() => setEditEx(e)}
                      aria-label={`Sửa số đã ghi của ${displayName}`}
                    >
                      {setRowsOf(e).map(row => {
                        const st = rowState(row, item);
                        return (
                          <i key={row.key} className={`is-${st}`}>
                            {st === 'todo' ? '–' : st === 'skip' ? 'bỏ' : fmtVal(row.record.actualVal, item.unit)}
                          </i>
                        );
                      })}
                      <em><AppIcon name="pencil" size={12} />Sửa</em>
                    </button>
                    {comp && <b className={`body-ls-delta${comp.diff > 0 ? ' is-up' : comp.diff < 0 ? ' is-down' : ''}`}>{comp.label}</b>}
                  </span>
                  <span className="body-ls-t-prev">
                    <span className="body-ls-m-text">trước </span>{prev || '—'}
                  </span>
                  {cand.shouldProgress ? (
                    <label className="body-ls-t-sug">
                      <input
                        type="checkbox"
                        checked={Boolean(approvedProgressions[itemKey])}
                        onChange={ev => {
                          const checked = ev.target.checked;
                          setApprovedProgressions(prevApproved => ({ ...prevApproved, [itemKey]: checked }));
                        }}
                      />
                      <span>
                        <span className="body-ls-m-text">Buổi sau: </span>
                        {item.target_sets} × {formatValWithUnit(cand.nextVal, cand.unit)}
                      </span>
                    </label>
                  ) : (
                    <span className="body-ls-t-keep">Giữ {item.target_sets} × {formatValWithUnit(item.target_val, item.unit)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="body-ls-foot">
        <button type="button" className="body-ls-text-btn is-danger" onClick={() => setConfirmCancel(true)}>
          Hủy buổi
        </button>
        <div className="body-ls-foot-group is-grow">
          {nextOpenIdx >= 0 && (
            <button type="button" className="body-ls-btn" onClick={() => goToSlot(nextOpenIdx)}>Tập tiếp</button>
          )}
          <button
            type="button"
            className="body-ls-btn is-dark is-save"
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
          >
            Lưu buổi tập
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className={`body-ls${screenState === 'rest' ? ' is-rest' : ''}${paused ? ' is-paused' : ''}`}>
      {/* ── HEADER DESKTOP ─────────────────────────────────────────── */}
      <header className="body-ls-head">
        <div className="body-ls-head-left">
          <button type="button" className="body-ls-icon-btn" onClick={handleBack} title="Về Lộ trình — buổi vẫn được giữ" aria-label="Về Lộ trình, buổi vẫn được giữ">
            <AppIcon name="caretLeft" size={16} />
          </button>
          <div className="body-ls-head-title">
            <span className="body-ls-eyebrow" style={{ color: eyebrowColor }}>{sessionEyebrow}</span>
            <span className="body-ls-title">{sessionTitle}</span>
          </div>
        </div>
        <div className="body-ls-head-center">
          <span className="body-ls-pos">{positionLabel}</span>
          {segments}
        </div>
        <div className="body-ls-head-right">
          {paused && <span className="body-ls-paused-badge">Đã tạm dừng</span>}
          <span className="body-ls-clock"><AppIcon name="timer" size={19} /><b>{formatClock(elapsed)}</b></span>
          {screenState !== 'done' && (
            <>
              <button type="button" className={`body-ls-btn${paused ? ' is-dark' : ''}`} onClick={togglePause}>
                <AppIcon name={paused ? 'play' : 'pause'} size={14} weight={paused ? 'fill' : 'regular'} />
                {paused ? 'Tiếp tục' : 'Tạm dừng'}
              </button>
              <button type="button" className="body-ls-btn is-danger" onClick={handleEnd}>Kết thúc</button>
            </>
          )}
        </div>
      </header>

      {/* ── HEADER MOBILE ──────────────────────────────────────────── */}
      <header className="body-ls-mhead">
        <div className="body-ls-mhead-row">
          <button type="button" className="body-ls-icon-btn is-ghost" onClick={handleBack} aria-label="Về Lộ trình, buổi vẫn được giữ">
            <AppIcon name="caretDown" size={20} />
          </button>
          <div className="body-ls-mhead-title">
            <span className="body-ls-title">{sessionTitle}</span>
            <span className="body-ls-mhead-sub">
              <b>{formatClock(elapsed)}</b>·<span>{positionLabel}</span>
            </span>
          </div>
          {screenState !== 'done' ? (
            <button
              type="button"
              className={`body-ls-icon-btn${paused ? ' is-dark' : ''}`}
              onClick={togglePause}
              aria-label={paused ? 'Tiếp tục buổi tập' : 'Tạm dừng buổi tập'}
            >
              <AppIcon name={paused ? 'play' : 'pause'} size={17} weight={paused ? 'fill' : 'regular'} />
            </button>
          ) : <span />}
        </div>
        {segments}
      </header>
      {paused && (
        <div className="body-ls-pausebar">
          <span><b>Đã tạm dừng</b><small>Số set đã ghi vẫn được giữ</small></span>
          <button type="button" className="body-ls-text-btn is-danger" onClick={handleEnd}>Kết thúc</button>
          <button type="button" className="body-ls-btn is-dark" onClick={togglePause}>
            <AppIcon name="play" size={11} weight="fill" />Tiếp tục
          </button>
        </div>
      )}

      {saveError && (
        <div className="body-ls-alert" role="alert">
          <AppIcon name="warning" size={16} />
          <span>{saveError}</span>
          <button type="button" onClick={() => setSaveError(null)}>Đóng</button>
        </div>
      )}

      <div className="body-ls-body">
        {/* ── CỘT TRÁI (desktop): cách tập + thứ tự bài ─────────────── */}
        <aside className="body-ls-side">
          {(dayItems.length > 1 || prepPicker) && (
            <div className="body-ls-side-sec">
              {dayItems.length > 1 && (
                <>
                  <span className="body-ls-label">CÁCH TẬP BUỔI NÀY</span>
                  {modeLocked ? (
                    <div className="body-ls-locked">
                      <AppIcon name="lock" size={15} />
                      <span>
                        <b>{MODES.find(m => m.key === mode)?.label}</b>
                        <small>Đã chốt khi ghi set đầu</small>
                      </span>
                    </div>
                  ) : modeOptions.map(m => {
                    const on = mode === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        className={`body-ls-mode${on ? ' is-on' : ''}`}
                        onClick={() => setMode(m.key)}
                        aria-pressed={on}
                      >
                        <AppIcon name={on ? 'checkCircle' : 'circle'} size={18} weight={on ? 'fill' : 'regular'} />
                        <span>
                          <b>{m.label}</b>
                          <small>{m.desc}</small>
                        </span>
                        <em>~{m.minutes}′</em>
                      </button>
                    );
                  })}
                </>
              )}
              {prepPicker}
            </div>
          )}

          <div className="body-ls-side-sec">
            <span className="body-ls-label">THỨ TỰ BÀI</span>
            {groups.map((g, e) => {
              const item = dayItems[e];
              const fin = g.every(q => recordBySlot.has(slotOfItem(q)));
              const cur = screenState !== 'done' && currentItem.exerciseIndex === e;
              return (
                <div key={e} className={`body-ls-qcard${cur ? ' is-cur' : ''}`}>
                  <div className="body-ls-qcard-head">
                    <span className={`body-ls-qno${fin ? ' is-fin' : cur ? ' is-cur' : ''}`}>
                      {fin ? <AppIcon name="check" size={12} /> : e + 1}
                    </span>
                    <span className="body-ls-qtext">
                      <b className={fin && !cur ? 'is-fin' : ''}>{splitExerciseName(nameOf(item.exercise_key)).vn}</b>
                      <small>
                        {item.target_sets} × {formatValWithUnit(item.target_val, item.unit)}{item.kg ? ` · ${item.kg} kg` : ''}
                      </small>
                    </span>
                  </div>
                  <div className="body-ls-qchips">
                    {g.map(q => {
                      const st = slotState(q);
                      return (
                        <button
                          key={q.set_no}
                          type="button"
                          className={`body-ls-qchip is-${st}`}
                          onClick={() => jumpToSlot(q)}
                          disabled={st === 'cur'}
                          title={recordBySlot.has(slotOfItem(q)) ? `Sửa set ${q.set_no}` : `Sang set ${q.set_no}`}
                        >
                          {slotLabel(q)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="body-ls-main">
          {screenState === 'guide' && guideView}
          {screenState === 'set' && setView}
          {screenState === 'rest' && restView}
          {screenState === 'done' && doneView}
        </main>
      </div>

      {/* ── NGĂN SỬA SỐ ĐÃ GHI (màn kết quả): −/+, gõ số, bỏ / khôi phục, ghi set còn thiếu, thêm set ── */}
      {editEx != null && dayItems[editEx] && (() => {
        const item = dayItems[editEx];
        const step = item.unit === 's' ? 5 : 1;
        const unitText = item.unit === 's' ? 'giây' : item.unit || 'rep';
        return (
          <>
            <div className="body-ls-sheet-backdrop" onClick={() => setEditEx(null)} />
            <div className="body-ls-sheet" role="dialog" aria-label="Sửa số đã ghi">
              <span className="body-ls-sheet-grip" />
              <div className="body-ls-sheet-head">
                <div>
                  <span className="body-ls-eyebrow is-accent">SỬA SỐ ĐÃ GHI</span>
                  <b>{splitExerciseName(nameOf(item.exercise_key)).vn}</b>
                  <small>Mục tiêu {item.target_sets} × {formatValWithUnit(item.target_val, item.unit)}</small>
                </div>
                <button type="button" className="body-ls-icon-btn" onClick={() => setEditEx(null)} aria-label="Đóng">
                  <AppIcon name="x" size={15} />
                </button>
              </div>
              <div className="body-ls-sheet-list">
                {setRowsOf(editEx).map(row => {
                  const r = row.record;
                  const v = r?.actualVal;
                  const st = rowState(row, item);
                  return (
                    <div key={row.key} className={`body-ls-erow is-${st}`}>
                      <span className="body-ls-erow-no">
                        Set {row.setNo}
                        {row.extra && <small>thêm</small>}
                      </span>
                      {r && v != null ? (
                        <div className="body-ls-estep">
                          <button type="button" onClick={() => updateRecordValue(r, Math.max(0, v - step))} aria-label={`Giảm set ${row.setNo}`}>
                            <AppIcon name="minus" size={14} />
                          </button>
                          <label>
                            <input
                              key={`${r.id}-${v}`}
                              type="number"
                              inputMode="numeric"
                              min="0"
                              defaultValue={v}
                              aria-label={`Số ${unitText} set ${row.setNo}`}
                              onBlur={ev => commitTyped(r, ev.target.value)}
                              onKeyDown={ev => { if (ev.key === 'Enter') ev.currentTarget.blur(); }}
                            />
                            <small>{unitText}</small>
                          </label>
                          <button type="button" onClick={() => updateRecordValue(r, v + step)} aria-label={`Tăng set ${row.setNo}`}>
                            <AppIcon name="plus" size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="body-ls-erow-empty">{r ? 'Đã bỏ set' : 'Chưa ghi'}</span>
                      )}
                      {r && v != null && (
                        <button type="button" className="body-ls-text-btn is-danger" onClick={() => updateRecordValue(r, null)}>Bỏ set</button>
                      )}
                      {r && v == null && (
                        <button type="button" className="body-ls-btn is-soft" onClick={() => updateRecordValue(r, Number(item.target_val) || 0)}>Khôi phục</button>
                      )}
                      {!r && row.slot && (
                        <button type="button" className="body-ls-btn is-soft" onClick={() => insertRecord(row.slot, Number(item.target_val) || 0)}>Ghi set</button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="body-ls-sheet-foot">
                <button type="button" className="body-ls-btn" onClick={() => addExtraSet(editEx)}>
                  <AppIcon name="plus" size={14} />Thêm set
                </button>
                <button type="button" className="body-ls-btn is-dark" onClick={() => setEditEx(null)}>Xong</button>
              </div>
            </div>
          </>
        );
      })()}

      {/* Modal chi tiết bài (video, bản đồ cơ) — bài đang tập hoặc bài dễ hơn */}
      <ExerciseDetailModal
        exercise={detailEx}
        isOpen={Boolean(detailEx)}
        onClose={() => setDetailEx(null)}
      />

      <ConfirmModal
        open={confirmCancel}
        title="Hủy buổi tập?"
        message="Buổi này sẽ không được tính là hoàn thành. Các set đã ghi vẫn được giữ trong lịch sử."
        confirmLabel="Hủy buổi"
        cancelLabel="Quay lại"
        danger
        onConfirm={() => {
          setConfirmCancel(false);
          onCancel?.();
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}

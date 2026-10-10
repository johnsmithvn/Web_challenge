/**
 * Pure functions for Body Workout logic.
 * Independent of React and Supabase. Tested via src/__tests__/body/workoutLogic.test.js
 */

export const RECOVERY_STATUS = {
  READY: 'ready',
  MID: 'mid',
  LOW: 'low'
};

export const DAY_TYPE_COLORS = {
  'Chân': '#2E9D8F',
  'Đẩy': '#6949E8',
  'Kéo': '#E0822C',
  'Toàn thân': '#4C8DE0'
};

/**
 * Format value with unit string
 */
export function formatValWithUnit(val, unit) {
  if (val == null) return '—';
  if (unit === 's') return `${val}s`;
  if (unit === 'min') return `${val} phút`;
  return `${val} ${unit || 'rep'}`;
}

/**
 * Step value for progression (+1 for reps, +5s for seconds)
 */
export function stepOfUnit(unit) {
  return unit === 's' ? 5 : 1;
}

/**
 * Standard rest durations:
 * - Straight sets: exercise rest_seconds (default 60s)
 * - Circuit: 20s transition between exercises, 90s between rounds
 * - Superset: 0s between the paired exercises (liên hoàn), 75s after each pair round
 */
export const REST_PRESETS = {
  CIRCUIT_TRANSITION: 20,
  CIRCUIT_ROUND: 90,
  SUPERSET_TRANSITION: 0,
  SUPERSET_ROUND: 75
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Khóa định danh 1 ô set trong buổi: routine item (nếu là UUID thật) hoặc exercise_key, kèm số set.
 * Dùng chung cho hàng đợi và các set đã ghi để biết ô nào còn trống.
 */
export function getSlotKey(routineItemId, exerciseKey, setNo) {
  return `${isUuid(routineItemId) ? routineItemId : exerciseKey}:${setNo}`;
}

/**
 * Tìm ô set kế tiếp còn trống sau vị trí fromIdx (quay vòng về đầu hàng đợi). -1 nếu đã ghi hết.
 */
export function findNextOpenIndex(queue, doneKeys, fromIdx = -1) {
  if (!Array.isArray(queue) || queue.length === 0) return -1;
  const done = doneKeys instanceof Set ? doneKeys : new Set(doneKeys || []);
  const isOpen = i => !done.has(getSlotKey(queue[i].routine_item_id, queue[i].exercise_key, queue[i].set_no));
  for (let i = fromIdx + 1; i < queue.length; i++) if (isOpen(i)) return i;
  for (let i = 0; i <= Math.min(fromIdx, queue.length - 1); i++) if (isOpen(i)) return i;
  return -1;
}

export const REST_KIND_LABELS = {
  set: 'Nghỉ giữa set',
  round: 'Nghỉ giữa vòng',
  switch: 'Chuyển bài',
  exercise: 'Nghỉ trước bài mới'
};

/**
 * Loại nghỉ giữa 2 ô set liên tiếp, theo chế độ tập.
 */
export function getRestKind(mode, current, next) {
  if (!current || !next) return 'set';
  if (mode === 'circuit') return next.set_no !== current.set_no ? 'round' : 'switch';
  if (mode === 'superset') {
    const samePair = Math.floor(current.exerciseIndex / 2) === Math.floor(next.exerciseIndex / 2);
    if (samePair && current.exerciseIndex !== next.exerciseIndex && current.set_no === next.set_no) return 'switch';
    return samePair ? 'set' : 'exercise';
  }
  return current.exerciseIndex === next.exerciseIndex ? 'set' : 'exercise';
}

/**
 * Ước tính thời lượng (phút) của hàng đợi: ~3 giây/rep, bài giây tính đúng số giây, cộng thời gian nghỉ giữa các ô.
 */
export function estimateQueueMinutes(queue) {
  if (!Array.isArray(queue) || queue.length === 0) return 0;
  const totalSec = queue.reduce((acc, item, i) => {
    const work = item.unit === 's' ? Number(item.target_val) || 0 : (Number(item.target_val) || 0) * 3;
    const rest = i < queue.length - 1 ? Number(item.rest_seconds) || 0 : 0;
    return acc + work + rest;
  }, 0);
  return Math.round(totalSec / 60);
}

/**
 * Tuần hiện tại của lộ trình tính từ ngày bắt đầu ('YYYY-MM-DD'), kẹp trong 1..totalWeeks.
 */
export function getRoutineWeek(startDate, totalWeeks, today = new Date()) {
  if (!startDate) return null;
  const [y, m, d] = String(startDate).split('-').map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.max(0, Math.round((now - start) / 86400000));
  const total = Math.max(1, Number(totalWeeks) || 1);
  return { current: Math.min(total, Math.floor(diffDays / 7) + 1), total };
}

/**
 * Tỷ lệ hoàn thành lịch: số buổi đã hoàn thành / số buổi đã lên lịch tính từ ngày bắt đầu.
 * Hôm nay chỉ được tính vào mẫu số khi đã có buổi hoàn thành (chưa tập hôm nay không bị trừ điểm).
 * Buổi tập bù (khác ngày lịch) vẫn được tính là hoàn thành.
 */
export function calculateAdherence({ startDate, plannedWeekdays = [], completedDates = [], today = new Date() }) {
  const planned = new Set(plannedWeekdays.map(Number));
  if (!startDate || planned.size === 0) return { planned: 0, done: 0, pct: null };
  const [y, m, d] = String(startDate).split('-').map(Number);
  const cursor = new Date(y, m - 1, d);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const pad = n => String(n).padStart(2, '0');
  const toKey = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const todayKey = toKey(todayDate);
  const startKey = toKey(cursor);
  const doneDates = completedDates.filter(ds => ds >= startKey && ds <= todayKey);

  let plannedCount = 0;
  while (cursor <= todayDate) {
    const iso = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (planned.has(iso)) {
      const key = toKey(cursor);
      if (key < todayKey || doneDates.includes(key)) plannedCount++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  const done = Math.min(doneDates.length, plannedCount);
  return { planned: plannedCount, done, pct: plannedCount > 0 ? Math.round((done / plannedCount) * 100) : null };
}

/**
 * Generate sequential workout queue according to mode:
 * - 'straight': All sets of exercise 1 -> All sets of exercise 2...
 * - 'circuit': 1 set of each exercise (20s rest) -> round ends (90s rest) -> round 2...
 * - 'superset': Pairs of exercises (1A -> 15s -> 1B -> 75s) -> round 2...
 */
export function generateWorkoutQueue(exerciseList, mode = 'straight') {
  if (!Array.isArray(exerciseList) || exerciseList.length === 0) return [];

  const queue = [];
  const list = exerciseList.map(e => ({
    ...e,
    target_sets: Math.max(1, Number(e.target_sets || e.sets || 1)),
    target_val: Number(e.target_val || e.t || 10),
    unit: e.unit || e.u || 'rep',
    kg: Number(e.kg || 0),
    rest_seconds: Number(e.rest_seconds || (e.unit === 's' ? 45 : e.kg ? 75 : 60))
  }));

  if (mode === 'circuit') {
    const maxRounds = Math.max(...list.map(x => x.target_sets));
    for (let r = 0; r < maxRounds; r++) {
      const activeExercises = list.filter(item => r < item.target_sets);
      activeExercises.forEach((item, exIdxInRound) => {
        const isLastInRound = exIdxInRound === activeExercises.length - 1;
        queue.push({
          id: item.id || null,
          routine_item_id: item.id || item.routine_item_id || null,
          exerciseIndex: list.indexOf(item),
          exercise_key: item.exercise_key || item.key || item.name,
          name: item.name || item.exercise_key,
          primary_muscle: item.primary_muscle || item.primary || '',
          set_no: r + 1,
          total_sets: item.target_sets,
          target_val: item.target_val,
          unit: item.unit,
          kg: item.kg,
          rest_seconds: isLastInRound ? REST_PRESETS.CIRCUIT_ROUND : REST_PRESETS.CIRCUIT_TRANSITION,
          mode: 'circuit'
        });
      });
    }
  } else if (mode === 'superset') {
    for (let pairIdx = 0; pairIdx < list.length; pairIdx += 2) {
      const pair = [list[pairIdx], list[pairIdx + 1]].filter(Boolean);
      const maxRoundsInPair = Math.max(...pair.map(item => item.target_sets));
      for (let r = 0; r < maxRoundsInPair; r++) {
        const activePairItems = pair.filter(item => r < item.target_sets);
        activePairItems.forEach((item, itemIdxInPair) => {
          const isLastInPairRound = itemIdxInPair === activePairItems.length - 1;
          queue.push({
            id: item.id || null,
            routine_item_id: item.id || item.routine_item_id || null,
            exerciseIndex: list.indexOf(item),
            exercise_key: item.exercise_key || item.key || item.name,
            name: item.name || item.exercise_key,
            primary_muscle: item.primary_muscle || item.primary || '',
            set_no: r + 1,
            total_sets: item.target_sets,
            target_val: item.target_val,
            unit: item.unit,
            kg: item.kg,
            rest_seconds: isLastInPairRound ? REST_PRESETS.SUPERSET_ROUND : REST_PRESETS.SUPERSET_TRANSITION,
            mode: 'superset'
          });
        });
      }
    }
  } else {
    // straight sets
    list.forEach((item, exIdx) => {
      for (let s = 1; s <= item.target_sets; s++) {
        queue.push({
          id: item.id || null,
          routine_item_id: item.id || item.routine_item_id || null,
          exerciseIndex: exIdx,
          exercise_key: item.exercise_key || item.key || item.name,
          name: item.name || item.exercise_key,
          primary_muscle: item.primary_muscle || item.primary || '',
          set_no: s,
          total_sets: item.target_sets,
          target_val: item.target_val,
          unit: item.unit,
          kg: item.kg,
          rest_seconds: item.rest_seconds,
          mode: 'straight'
        });
      }
    });
  }

  // Assign sequence_order 1..N
  return queue.map((item, idx) => ({
    ...item,
    sequence_order: idx + 1
  }));
}

/**
 * Check auto-progression rule:
 * - Must achieve at least targetSetsCount sets (if targetSetsCount is specified)
 * - Every set must have reached or exceeded currentTarget (cannot have null/skipped sets)
 * - Returns { shouldProgress, nextTarget, step, unit }
 */
export function checkAutoProgression(actualSets, currentTarget, targetSetsCount = null, unit = 'rep') {
  // Support overload: checkAutoProgression(actualSets, currentTarget, unit)
  let expectedCount = targetSetsCount;
  let resolvedUnit = unit;
  if (typeof targetSetsCount === 'string') {
    resolvedUnit = targetSetsCount;
    expectedCount = null;
  }

  const step = stepOfUnit(resolvedUnit);

  if (!Array.isArray(actualSets) || actualSets.length === 0) {
    return { shouldProgress: false, nextTarget: Number(currentTarget), step, unit: resolvedUnit };
  }

  // Check count if specified
  if (expectedCount != null && actualSets.length < Number(expectedCount)) {
    return { shouldProgress: false, nextTarget: Number(currentTarget), step, unit: resolvedUnit };
  }

  // Every set must be non-null and >= currentTarget
  const allMet = actualSets.every(s => {
    const val = typeof s === 'object' && s !== null ? s.actual_val : s;
    return val != null && !Number.isNaN(Number(val)) && Number(val) >= Number(currentTarget);
  });

  return {
    shouldProgress: allMet,
    nextTarget: allMet ? Number(currentTarget) + step : Number(currentTarget),
    step,
    unit: resolvedUnit
  };
}

/**
 * Calculate estimated 1RM using Epley formula: kg * (1 + reps / 30)
 */
export function calculateEstimated1RM(reps, kg) {
  const r = Number(reps || 0);
  const w = Number(kg || 0);
  if (w <= 0) return r;
  if (r <= 0) return 0;
  return Math.round(w * (1 + r / 30) * 10) / 10;
}

/**
 * Detect PR (Personal Record):
 * - If historyMaxVal is null/empty: NOT a PR (first time is baseline, not PR).
 * - If kg > 0: compares estimated 1RM with history 1RM.
 * - If bodyweight (kg = 0): compares actualVal directly with historyMaxVal.
 */
export function detectPR(actualVal, historyMaxVal, kg = 0, historyKg = 0) {
  const val = Number(actualVal || 0);
  if (val <= 0) return false;
  if (historyMaxVal == null) return false; // Lần đầu là baseline, không ngụy tạo PR

  const curKg = Number(kg || 0);
  const prevKg = Number(historyKg || 0);

  if (curKg > 0 || prevKg > 0) {
    const cur1RM = calculateEstimated1RM(val, curKg);
    const prev1RM = calculateEstimated1RM(Number(historyMaxVal), prevKg);
    return cur1RM > prev1RM;
  }

  return val > Number(historyMaxVal);
}

/**
 * Mốc kỷ lục theo từng bài, tách riêng set có tạ (so 1RM ước tính) và set không tạ (so số rep/giây)
 * để không so lẫn kg với rep. Bỏ qua set bị bỏ (actual_val null/0).
 */
export function buildPrBaselines(sets = []) {
  const map = new Map();
  (sets || []).forEach(s => {
    const key = s.exercise_key || s.exerciseKey;
    const val = Number(s.actual_val ?? s.actualVal ?? 0);
    if (!key || !(val > 0)) return;
    const kg = Number(s.kg || 0);
    const base = map.get(key) || { bodyweight: null, weighted: null };
    if (kg > 0) {
      const e1rm = calculateEstimated1RM(val, kg);
      if (!base.weighted || e1rm > base.weighted.e1rm) base.weighted = { val, kg, e1rm };
    } else if (base.bodyweight == null || val > base.bodyweight) {
      base.bodyweight = val;
    }
    map.set(key, base);
  });
  return map;
}

/**
 * Set có vượt mốc kỷ lục không. Không có mốc cùng loại (lần đầu) thì không tính là PR.
 */
export function isNewPR({ actualVal, kg = 0 }, baseline) {
  if (!baseline || actualVal == null) return false;
  if (Number(kg) > 0) {
    return baseline.weighted ? detectPR(actualVal, baseline.weighted.val, kg, baseline.weighted.kg) : false;
  }
  return baseline.bodyweight != null ? detectPR(actualVal, baseline.bodyweight) : false;
}

/**
 * Kết quả "lần trước" của từng bài: các set của buổi gần nhất (khác buổi hiện tại) có tập bài đó,
 * xếp theo số set. Trả về Map exercise_key → { sessionId, sets: [{ set_no, actual_val, unit, kg }] }.
 */
export function buildPreviousSetsByExercise(sets = [], excludeSessionId = null) {
  const latestByEx = new Map();
  (sets || []).forEach(s => {
    const sid = s.session_id;
    const key = s.exercise_key;
    if (!sid || !key || sid === excludeSessionId) return;
    const t = new Date(s.completed_at || 0).getTime();
    const cur = latestByEx.get(key);
    if (!cur || t > cur.time) latestByEx.set(key, { time: t, sessionId: sid });
  });
  const result = new Map();
  latestByEx.forEach(({ sessionId }, key) => {
    const rows = sets
      .filter(s => s.session_id === sessionId && s.exercise_key === key)
      .sort((a, b) => (a.set_no || 0) - (b.set_no || 0))
      .map(s => ({ set_no: s.set_no, actual_val: s.actual_val, unit: s.unit, kg: Number(s.kg || 0) }));
    result.set(key, { sessionId, sets: rows });
  });
  return result;
}

/**
 * Compare session totals by exercise with previous session
 * Group sets by exercise_key to prevent adding reps and seconds together.
 */
export function compareSessionWithPrevious(currentSets = [], previousSets = []) {
  const currByEx = new Map();
  const prevByEx = new Map();

  (currentSets || []).forEach(s => {
    const key = s.exercise_key || s.exerciseKey || s.exercise_name || s.exerciseName || 'unknown';
    const val = Number(s.actual_val != null ? s.actual_val : (s.actualVal != null ? s.actualVal : 0));
    const name = s.exercise_name || s.exerciseName || key;
    const existing = currByEx.get(key) || { name, unit: s.unit || 'rep', total: 0, sets: 0 };
    existing.total += val;
    existing.sets += 1;
    currByEx.set(key, existing);
  });

  (previousSets || []).forEach(s => {
    const key = s.exercise_key || s.exerciseKey || s.exercise_name || s.exerciseName || 'unknown';
    const val = Number(s.actual_val != null ? s.actual_val : (s.actualVal != null ? s.actualVal : 0));
    const name = s.exercise_name || s.exerciseName || key;
    const existing = prevByEx.get(key) || { name, unit: s.unit || 'rep', total: 0, sets: 0 };
    existing.total += val;
    existing.sets += 1;
    prevByEx.set(key, existing);
  });

  const byExercise = [];
  let improvedCount = 0;
  let sameCount = 0;
  let lowerCount = 0;

  currByEx.forEach((curr, key) => {
    const prev = prevByEx.get(key);
    const prevTotal = prev ? prev.total : null;
    const diff = prevTotal != null ? curr.total - prevTotal : null;

    if (diff != null) {
      if (diff > 0) improvedCount++;
      else if (diff === 0) sameCount++;
      else lowerCount++;
    }

    byExercise.push({
      exercise_key: key,
      exercise_name: curr.name,
      unit: curr.unit,
      currTotal: curr.total,
      prevTotal,
      diff,
      label: diff == null ? 'Lần đầu' : diff === 0 ? '±0' : diff > 0 ? `+${diff}` : `${diff}`
    });
  });

  const currSum = (currentSets || []).reduce((acc, s) => acc + Number(s.actual_val != null ? s.actual_val : (s.actualVal != null ? s.actualVal : 0)), 0);
  const prevSum = (previousSets || []).reduce((acc, s) => acc + Number(s.actual_val != null ? s.actual_val : (s.actualVal != null ? s.actualVal : 0)), 0);
  const diff = currSum - prevSum;

  return {
    currTotal: currSum,
    prevTotal: prevSum,
    diff,
    label: diff === 0 ? '±0' : diff > 0 ? `+${diff}` : `${diff}`,
    byExercise,
    improvedCount,
    sameCount,
    lowerCount
  };
}

/**
 * Recovery estimation (discrete 3 states: ready / mid / low)
 * based on 7-day volume and hours elapsed since last trained.
 */
export function estimateRecoveryState(sevenDaySets = 0, hoursSinceLastTrained = 72) {
  if (hoursSinceLastTrained == null || hoursSinceLastTrained >= 60) {
    return RECOVERY_STATUS.READY;
  }
  if (hoursSinceLastTrained < 24) {
    return RECOVERY_STATUS.LOW;
  }
  if (hoursSinceLastTrained < 48) {
    return sevenDaySets > 15 ? RECOVERY_STATUS.LOW : RECOVERY_STATUS.MID;
  }
  return RECOVERY_STATUS.READY;
}

/**
 * Trạng thái phục hồi của 1 nhóm cơ (3 mức rời rạc, không hiển thị % — theo quyết định D4).
 * Thời gian cần để hồi phục tùy khối lượng 7 ngày: nhẹ (≤5 set) 36h, vừa 48h, nặng (≥15 set) 60h.
 * Ưu tiên mốc lần tập với vai trò cơ chính.
 *
 * @returns {{ state: 'ready'|'mid'|'low', label: string, bg: string, fg: string, text: string, hoursSince: number|null }}
 */
export function calculateRecoveryMetrics({
  totalSets = 0,
  primarySets = 0,
  hoursSince = null,
  hoursSincePrimary = null
} = {}) {
  if (hoursSince == null && hoursSincePrimary == null) {
    return {
      state: RECOVERY_STATUS.READY,
      label: 'Sẵn sàng',
      bg: '#E6F2EA',
      fg: '#2F7A50',
      text: 'Chưa có buổi tập nào tác động nhóm cơ này trong dữ liệu gần đây.',
      hoursSince: null
    };
  }

  const hours = hoursSincePrimary ?? hoursSince;
  const sets = primarySets || totalSets || 0;
  const targetHours = sets >= 15 ? 60 : sets <= 5 ? 36 : 48;
  const ratio = hours / targetHours;

  if (ratio < 0.3) {
    return {
      state: RECOVERY_STATUS.LOW,
      label: 'Cần nghỉ',
      bg: '#FBE5E0',
      fg: '#B23A22',
      text: `Vừa tập ${hours} giờ trước (${sets} set trong 7 ngày). Nên nghỉ nhóm cơ này.`,
      hoursSince: hours
    };
  }
  if (ratio < 0.78) {
    return {
      state: RECOVERY_STATUS.MID,
      label: 'Đang hồi',
      bg: '#FBF0DC',
      fg: '#9A6514',
      text: `Đã qua ${hours} giờ kể từ buổi tập. Có thể tập nhẹ hoặc đổi nhóm cơ khác.`,
      hoursSince: hours
    };
  }
  return {
    state: RECOVERY_STATUS.READY,
    label: 'Sẵn sàng',
    bg: '#E6F2EA',
    fg: '#2F7A50',
    text: `Đã qua ${hours} giờ kể từ buổi tập. Sẵn sàng cho buổi tiếp theo.`,
    hoursSince: hours
  };
}

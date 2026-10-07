/**
 * Pure functions for Body Workout logic.
 * Independent of React and Supabase. Tested via src/__tests__/body/workoutLogic.test.js
 */

export const RECOVERY_STATUS = {
  READY: 'ready',
  MID: 'mid',
  LOW: 'low'
};

export const RECOVERY_LABELS = {
  ready: 'Sẵn sàng',
  mid: 'Đang hồi phục',
  low: 'Cần nghỉ'
};

export const RECOVERY_COLORS = {
  ready: '#2F8A57',
  mid: '#B57A12',
  low: '#C23B22'
};

export const DAY_TYPE_COLORS = {
  'Chân': '#2E9D8F',
  'Đẩy': '#6949E8',
  'Kéo': '#E0822C',
  'Toàn thân': '#4C8DE0'
};

export const DAY_TYPE_SOFTS = {
  'Chân': '#DDF1EE',
  'Đẩy': '#ECE7FD',
  'Kéo': '#FCEBDD',
  'Toàn thân': '#E1ECFA'
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
 * - Superset: 15s transition between paired exercises, 75s between superset rounds
 */
export const REST_PRESETS = {
  CIRCUIT_TRANSITION: 20,
  CIRCUIT_ROUND: 90,
  SUPERSET_TRANSITION: 15,
  SUPERSET_ROUND: 75
};

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

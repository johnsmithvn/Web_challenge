import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  generateWorkoutQueue,
  checkAutoProgression,
  detectPR,
  calculateEstimated1RM,
  compareSessionWithPrevious,
  estimateRecoveryState,
  calculateRecoveryMetrics,
  RECOVERY_STATUS,
  REST_PRESETS,
  formatValWithUnit
} from '../../utils/workoutLogic.js';

console.log('Testing workoutLogic pure functions...');

// 1. generateWorkoutQueue - straight mode
{
  const ex = [
    { key: 'push-up', name: 'Push-up', sets: 3, target_val: 12, unit: 'rep' },
    { key: 'squat', name: 'Squat', sets: 2, target_val: 15, unit: 'rep' }
  ];
  const q = generateWorkoutQueue(ex, 'straight');
  assert.equal(q.length, 5);
  assert.equal(q[0].name, 'Push-up');
  assert.equal(q[0].set_no, 1);
  assert.equal(q[0].sequence_order, 1);
  assert.equal(q[2].set_no, 3);
  assert.equal(q[3].name, 'Squat');
  assert.equal(q[3].set_no, 1);
  assert.equal(q[3].sequence_order, 4);
  console.log('  ✓ generateWorkoutQueue (straight) OK');
}

// 2. generateWorkoutQueue - circuit mode & superset rest intervals
{
  const ex = [
    { key: 'push-up', name: 'Push-up', sets: 2, target_val: 10, unit: 'rep' },
    { key: 'plank', name: 'Plank', sets: 2, target_val: 30, unit: 's' }
  ];
  const q = generateWorkoutQueue(ex, 'circuit');
  assert.equal(q.length, 4);
  // Round 1: Push-up set 1 (transition 20s), Plank set 1 (round end 90s)
  assert.equal(q[0].name, 'Push-up');
  assert.equal(q[0].rest_seconds, REST_PRESETS.CIRCUIT_TRANSITION);
  assert.equal(q[1].name, 'Plank');
  assert.equal(q[1].rest_seconds, REST_PRESETS.CIRCUIT_ROUND);

  // Superset
  const qSuper = generateWorkoutQueue(ex, 'superset');
  assert.equal(qSuper.length, 4);
  assert.equal(qSuper[0].rest_seconds, REST_PRESETS.SUPERSET_TRANSITION);
  assert.equal(qSuper[1].rest_seconds, REST_PRESETS.SUPERSET_ROUND);
  console.log('  ✓ generateWorkoutQueue (circuit & superset rests) OK');
}

// 3. checkAutoProgression
{
  // All met (reps) -> +1 rep
  const res1 = checkAutoProgression([12, 12, 13], 12, 'rep');
  assert.equal(res1.shouldProgress, true);
  assert.equal(res1.nextTarget, 13);

  // One missed (reps) -> keep target
  const res2 = checkAutoProgression([12, 11, 12], 12, 'rep');
  assert.equal(res2.shouldProgress, false);
  assert.equal(res2.nextTarget, 12);

  // Incomplete set count: target 3 sets, only 1 done -> false
  const resCount = checkAutoProgression([12], 12, 3, 'rep');
  assert.equal(resCount.shouldProgress, false);

  // Skipped set with null -> false
  const resNull = checkAutoProgression([12, null, 12], 12, 3, 'rep');
  assert.equal(resNull.shouldProgress, false);

  // All met (seconds) -> +5s
  const res3 = checkAutoProgression([45, 50, 45], 45, 's');
  assert.equal(res3.shouldProgress, true);
  assert.equal(res3.nextTarget, 50);
  console.log('  ✓ checkAutoProgression OK');
}

// 4. detectPR (no false PR on first try, considers weight/1RM)
{
  // First time is baseline, NOT a PR
  assert.equal(detectPR(15, null), false);

  // Bodyweight: higher is PR
  assert.equal(detectPR(22, 20), true);
  assert.equal(detectPR(20, 20), false);
  assert.equal(detectPR(18, 20), false);

  // Weighted: 10 reps @ 10kg (1RM = 13.3) vs 12 reps @ 5kg (1RM = 7) -> PR!
  assert.equal(detectPR(10, 12, 10, 5), true);

  // Lower weight higher reps with lower 1RM: 15 reps @ 5kg (1RM = 7.5) vs 10 reps @ 10kg (1RM = 13.3) -> NOT PR
  assert.equal(detectPR(15, 10, 5, 10), false);

  console.log('  ✓ detectPR OK');
}

// 5. compareSessionWithPrevious
{
  const s1 = [
    { exercise_key: 'push-up', exercise_name: 'Push-up', unit: 'rep', actual_val: 12 },
    { exercise_key: 'push-up', exercise_name: 'Push-up', unit: 'rep', actual_val: 12 },
    { exercise_key: 'plank', exercise_name: 'Plank', unit: 's', actual_val: 45 }
  ];
  const s2 = [
    { exercise_key: 'push-up', exercise_name: 'Push-up', unit: 'rep', actual_val: 10 },
    { exercise_key: 'push-up', exercise_name: 'Push-up', unit: 'rep', actual_val: 10 },
    { exercise_key: 'plank', exercise_name: 'Plank', unit: 's', actual_val: 40 }
  ];
  const diff = compareSessionWithPrevious(s1, s2);
  assert.equal(diff.byExercise.length, 2);
  const pushUpDiff = diff.byExercise.find(e => e.exercise_key === 'push-up');
  assert.equal(pushUpDiff.diff, 4);
  assert.equal(pushUpDiff.label, '+4');

  const plankDiff = diff.byExercise.find(e => e.exercise_key === 'plank');
  assert.equal(plankDiff.diff, 5);
  assert.equal(plankDiff.label, '+5');
  assert.equal(diff.improvedCount, 2);
  console.log('  ✓ compareSessionWithPrevious OK');
}

// 6. estimateRecoveryState
{
  assert.equal(estimateRecoveryState(12, 12), RECOVERY_STATUS.LOW);
  assert.equal(estimateRecoveryState(12, 36), RECOVERY_STATUS.MID);
  assert.equal(estimateRecoveryState(12, 72), RECOVERY_STATUS.READY);
  console.log('  ✓ estimateRecoveryState OK');
}

// 6.1. calculateRecoveryMetrics (continuous biological curve)
{
  // Chưa tập bao giờ -> 100% Sẵn sàng
  const fresh = calculateRecoveryMetrics({ hoursSince: null });
  assert.equal(fresh.pct, 100);
  assert.equal(fresh.state, RECOVERY_STATUS.READY);

  // Vừa tập 12h trước -> Low (dưới 50%)
  const recent = calculateRecoveryMetrics({ totalSets: 10, hoursSince: 12 });
  assert(recent.pct < 50);
  assert.equal(recent.state, RECOVERY_STATUS.LOW);

  // Sau 36h -> Mid (đang hồi)
  const recovering = calculateRecoveryMetrics({ totalSets: 10, hoursSince: 36 });
  assert(recovering.pct >= 70 && recovering.pct < 85);
  assert.equal(recovering.state, RECOVERY_STATUS.MID);

  // Sau 44h (Thứ 3 -> Thứ 5) -> Phục hồi cao (~85-94%)
  const almostReady = calculateRecoveryMetrics({ totalSets: 10, hoursSince: 44 });
  assert(almostReady.pct >= 85);
  assert.equal(almostReady.state, RECOVERY_STATUS.READY);

  // Sau 72h -> 100% Sẵn sàng
  const fullyReady = calculateRecoveryMetrics({ totalSets: 10, hoursSince: 72 });
  assert.equal(fullyReady.pct, 100);
  assert.equal(fullyReady.state, RECOVERY_STATUS.READY);
  console.log('  ✓ calculateRecoveryMetrics continuous curve OK');
}

// 7. exercise dataset schema check
{
  const raw = fs.readFileSync(new URL('../../data/body-exercises.json', import.meta.url), 'utf8');
  const exercises = JSON.parse(raw);
  assert(Array.isArray(exercises) && exercises.length >= 16);
  exercises.forEach(ex => {
    assert(ex.key && typeof ex.key === 'string');
    assert(ex.name && typeof ex.name === 'string');
    assert(ex.primary && typeof ex.primary === 'string');
  });
  console.log(`  ✓ exercise dataset schema OK (${exercises.length} exercises)`);
}

// 8. calculateEstimated1RM & formatValWithUnit check
{
  assert.equal(Math.round(calculateEstimated1RM(10, 50)), 67);
  assert.equal(formatValWithUnit(12, 'rep'), '12 rep');
  assert.equal(formatValWithUnit(60, 's'), '60s');
  console.log('  ✓ calculateEstimated1RM & formatValWithUnit OK');
}

console.log('ALL WORKOUT LOGIC TESTS PASSED!');

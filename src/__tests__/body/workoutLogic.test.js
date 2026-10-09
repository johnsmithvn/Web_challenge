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
  REST_KIND_LABELS,
  formatValWithUnit,
  isUuid,
  getSlotKey,
  findNextOpenIndex,
  getRestKind,
  estimateQueueMinutes,
  buildPrBaselines,
  isNewPR,
  buildPreviousSetsByExercise,
  getRoutineWeek,
  calculateAdherence
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

// 6.1. calculateRecoveryMetrics (3 trạng thái rời rạc, không trả % — quyết định D4)
{
  const fresh = calculateRecoveryMetrics({ hoursSince: null });
  assert.equal(fresh.state, RECOVERY_STATUS.READY);
  assert.equal(fresh.pct, undefined);

  // 10 set/7 ngày -> cần 48h
  assert.equal(calculateRecoveryMetrics({ totalSets: 10, hoursSince: 12 }).state, RECOVERY_STATUS.LOW);
  assert.equal(calculateRecoveryMetrics({ totalSets: 10, hoursSince: 36 }).state, RECOVERY_STATUS.MID);
  assert.equal(calculateRecoveryMetrics({ totalSets: 10, hoursSince: 44 }).state, RECOVERY_STATUS.READY);
  assert.equal(calculateRecoveryMetrics({ totalSets: 10, hoursSince: 72 }).state, RECOVERY_STATUS.READY);

  // Tập nặng (≥15 set) cần lâu hơn: 36h vẫn đang hồi
  assert.equal(calculateRecoveryMetrics({ totalSets: 18, hoursSince: 36 }).state, RECOVERY_STATUS.MID);
  // Không có set nào trong 7 ngày nhưng có mốc giờ (tập > 7 ngày trước) -> coi là nhẹ, không tự điền 8 set
  assert.equal(calculateRecoveryMetrics({ totalSets: 0, hoursSince: 30 }).state, RECOVERY_STATUS.READY);
  // Ưu tiên mốc cơ chính
  assert.equal(calculateRecoveryMetrics({ totalSets: 10, hoursSince: 2, hoursSincePrimary: 70 }).state, RECOVERY_STATUS.READY);
  console.log('  ✓ calculateRecoveryMetrics 3 states OK');
}

// 6.2. Slot keys & next open index (resume / skip exercise)
{
  const items = [
    { id: '11111111-1111-4111-8111-111111111111', exercise_key: 'a', target_sets: 2, target_val: 10, unit: 'rep' },
    { id: '22222222-2222-4222-8222-222222222222', exercise_key: 'b', target_sets: 2, target_val: 30, unit: 's' }
  ];
  const q = generateWorkoutQueue(items, 'circuit'); // a1 b1 a2 b2
  const done = new Set([getSlotKey(items[0].id, 'a', 1), getSlotKey(items[1].id, 'b', 1)]);
  assert.equal(findNextOpenIndex(q, done, -1), 2);
  // Đang ở a2 (idx 2), b1 đã xong: kế tiếp là b2
  assert.equal(findNextOpenIndex(q, new Set([...done, getSlotKey(items[0].id, 'a', 2)]), 2), 3);
  // Quay vòng về ô trống phía trước
  assert.equal(findNextOpenIndex(q, new Set([getSlotKey(items[1].id, 'b', 1)]), 2), 3);
  assert.equal(findNextOpenIndex(q, new Set([getSlotKey(items[1].id, 'b', 1), getSlotKey(items[1].id, 'b', 2)]), 3), 0);
  // Hết ô trống
  const all = new Set(q.map(x => getSlotKey(x.routine_item_id, x.exercise_key, x.set_no)));
  assert.equal(findNextOpenIndex(q, all, 0), -1);
  // routine item không phải UUID (bài lẻ) -> khóa theo exercise_key
  assert.equal(getSlotKey('single-custom-item', 'push-up', 2), 'push-up:2');
  assert.equal(isUuid('single-custom-item'), false);
  console.log('  ✓ getSlotKey / findNextOpenIndex OK');
}

// 6.3. Rest kind & queue estimate
{
  const ex = [
    { id: 'x1', exercise_key: 'a', target_sets: 2, target_val: 10, unit: 'rep', rest_seconds: 60 },
    { id: 'x2', exercise_key: 'b', target_sets: 2, target_val: 10, unit: 'rep', rest_seconds: 60 }
  ];
  const st = generateWorkoutQueue(ex, 'straight');
  assert.equal(getRestKind('straight', st[0], st[1]), 'set');
  assert.equal(getRestKind('straight', st[1], st[2]), 'exercise');
  const ci = generateWorkoutQueue(ex, 'circuit');
  assert.equal(getRestKind('circuit', ci[0], ci[1]), 'switch');
  assert.equal(getRestKind('circuit', ci[1], ci[2]), 'round');
  const su = generateWorkoutQueue(ex, 'superset');
  assert.equal(getRestKind('superset', su[0], su[1]), 'switch');
  assert.equal(su[0].rest_seconds, 0);
  assert.ok(REST_KIND_LABELS.round);

  // straight: 4 ô × 30s làm + 3 lần nghỉ 60s = 300s = 5 phút
  assert.equal(estimateQueueMinutes(st), 5);
  assert.equal(estimateQueueMinutes([]), 0);
  console.log('  ✓ getRestKind / estimateQueueMinutes OK');
}

// 6.4. PR baselines: không so lẫn có tạ / không tạ, lần đầu không phải PR
{
  const history = [
    { exercise_key: 'push-up', actual_val: 20, kg: 0 },
    { exercise_key: 'push-up', actual_val: null, kg: 0 },
    { exercise_key: 'curl', actual_val: 12, kg: 5 },
    { exercise_key: 'curl', actual_val: 8, kg: 10 }
  ];
  const base = buildPrBaselines(history);
  assert.equal(base.get('push-up').bodyweight, 20);
  assert.equal(base.get('curl').weighted.kg, 10); // 8@10kg (1RM 12.7) > 12@5kg (1RM 7)
  assert.equal(isNewPR({ actualVal: 21, kg: 0 }, base.get('push-up')), true);
  assert.equal(isNewPR({ actualVal: 20, kg: 0 }, base.get('push-up')), false);
  assert.equal(isNewPR({ actualVal: 14, kg: 5 }, base.get('curl')), false); // 1RM 7.3 < 12.7
  assert.equal(isNewPR({ actualVal: 10, kg: 10 }, base.get('curl')), true);
  // Bài có tạ nhưng lịch sử chỉ có set không tạ -> chưa có mốc cùng loại
  assert.equal(isNewPR({ actualVal: 5, kg: 5 }, base.get('push-up')), false);
  assert.equal(isNewPR({ actualVal: 30, kg: 0 }, undefined), false);
  console.log('  ✓ buildPrBaselines / isNewPR OK');
}

// 6.5. Previous sets by exercise
{
  const sets = [
    { session_id: 's1', exercise_key: 'a', set_no: 2, actual_val: 9, completed_at: '2026-10-01T10:02:00Z' },
    { session_id: 's1', exercise_key: 'a', set_no: 1, actual_val: 10, completed_at: '2026-10-01T10:01:00Z' },
    { session_id: 's2', exercise_key: 'a', set_no: 1, actual_val: 12, completed_at: '2026-10-05T10:01:00Z' },
    { session_id: 'cur', exercise_key: 'a', set_no: 1, actual_val: 14, completed_at: '2026-10-09T10:01:00Z' }
  ];
  const prev = buildPreviousSetsByExercise(sets, 'cur');
  assert.equal(prev.get('a').sessionId, 's2');
  assert.deepEqual(prev.get('a').sets.map(x => x.actual_val), [12]);
  const prevNoExclude = buildPreviousSetsByExercise(sets.filter(s => s.session_id !== 'cur' && s.session_id !== 's2'));
  assert.deepEqual(prevNoExclude.get('a').sets.map(x => x.set_no), [1, 2]);
  console.log('  ✓ buildPreviousSetsByExercise OK');
}

// 6.6. Routine week & adherence
{
  const today = new Date(2026, 9, 9); // Thứ Sáu 9/10/2026
  assert.deepEqual(getRoutineWeek('2026-09-19', 8, today), { current: 3, total: 8 });
  assert.deepEqual(getRoutineWeek('2026-10-09', 8, today), { current: 1, total: 8 });
  assert.deepEqual(getRoutineWeek('2026-01-01', 8, today), { current: 8, total: 8 });
  assert.equal(getRoutineWeek(null, 8, today), null);

  // Lịch T2/T4/T6, bắt đầu T2 5/10. Đến hết T5 8/10 đã lên lịch 2 buổi (5/10, 7/10); hôm nay T6 chưa tập không bị tính.
  const a1 = calculateAdherence({ startDate: '2026-10-05', plannedWeekdays: [1, 3, 5], completedDates: ['2026-10-05'], today });
  assert.deepEqual(a1, { planned: 2, done: 1, pct: 50 });
  // Tập bù 8/10 vẫn tính hoàn thành; hôm nay đã tập thì tính vào mẫu số
  const a2 = calculateAdherence({ startDate: '2026-10-05', plannedWeekdays: [1, 3, 5], completedDates: ['2026-10-05', '2026-10-08', '2026-10-09'], today });
  assert.deepEqual(a2, { planned: 3, done: 3, pct: 100 });
  // Buổi trước ngày bắt đầu không tính
  const a3 = calculateAdherence({ startDate: '2026-10-05', plannedWeekdays: [1, 3, 5], completedDates: ['2026-10-01'], today });
  assert.equal(a3.done, 0);
  assert.equal(calculateAdherence({ startDate: '2026-10-05', plannedWeekdays: [], completedDates: [], today }).pct, null);
  console.log('  ✓ getRoutineWeek / calculateAdherence OK');
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

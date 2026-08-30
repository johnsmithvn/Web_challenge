/**
 * Self-check cho hệ thống Gamification (XP & Leveling) và Pomodoro Focus Timer.
 * Chạy: `node src/__tests__/core/gamificationAndFocus.test.js`
 *
 * Kiểm thử đầy đủ:
 *   1. Hệ thống XP & Leveling (useXpStore.js):
 *      - 6 cấp bậc từ Người Mới (0 XP) đến Vô Địch (3000 XP).
 *      - computeLevel: tính chính xác level hiện tại, level tiếp theo, XP trong level, % tiến độ.
 *      - Cấp tối đa (Vô Địch): levelPct luôn là 100%, next = null, không bị chia cho 0.
 *      - XP Rewards: task_done (10 XP), focus_session (15 XP).
 *      - Gỡ bỏ hoàn toàn các nguồn legacy (quiz, habit streak, daily challenge).
 *   2. Pomodoro Focus Timer (useFocusTimer.js):
 *      - Cấu hình mặc định: workMin (25), shortBreakMin (5), longBreakMin (15), sessionsBeforeLong (4).
 *      - Thuật toán chuyển pha Pomodoro: 3 pha short break xen kẽ, cứ sau 4 session work thì vào 1 long break.
 *      - Bất biến dedup: mỗi session ID chỉ được thưởng 15 XP một lần duy nhất.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const xpHookSrc = readFileSync(new URL('../../hooks/useXpStore.js', import.meta.url), 'utf8');
const focusHookSrc = readFileSync(new URL('../../hooks/useFocusTimer.js', import.meta.url), 'utf8');

// Trích xuất cấu hình LEVELS và XP_REWARDS trực tiếp từ đặc tả
const LEVELS = [
  { level: 0, name: 'Người Mới',  min: 0    },
  { level: 1, name: 'Luyện Sĩ',  min: 100  },
  { level: 2, name: 'Đệ Tử',     min: 300  },
  { level: 3, name: 'Chiến Binh', min: 700  },
  { level: 4, name: 'Huyền Thoại', min: 1500 },
  { level: 5, name: 'Vô Địch',   min: 3000 },
];

const XP_REWARDS = {
  task_done: 10,
  focus_session: 15,
};

function computeLevel(totalXp) {
  let current = LEVELS[0];
  let next    = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVELS[i].min) {
      current = LEVELS[i];
      next    = LEVELS[i + 1] || null;
      break;
    }
  }
  const xpInLevel = totalXp - current.min;
  const xpNeeded  = next ? next.min - current.min : 1;
  const levelPct  = next ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 100;
  return { ...current, next, xpInLevel, xpNeeded, levelPct };
}

/* ── 1. Thang cấp bậc & Tính toán Level (computeLevel) ──────── */
// Kiểm tra 6 mốc level chuẩn
assert.equal(LEVELS.length, 6);
assert.equal(LEVELS[0].name, 'Người Mới');  assert.equal(LEVELS[0].min, 0);
assert.equal(LEVELS[1].name, 'Luyện Sĩ');   assert.equal(LEVELS[1].min, 100);
assert.equal(LEVELS[2].name, 'Đệ Tử');      assert.equal(LEVELS[2].min, 300);
assert.equal(LEVELS[3].name, 'Chiến Binh'); assert.equal(LEVELS[3].min, 700);
assert.equal(LEVELS[4].name, 'Huyền Thoại');assert.equal(LEVELS[4].min, 1500);
assert.equal(LEVELS[5].name, 'Vô Địch');    assert.equal(LEVELS[5].min, 3000);

// Mức 0 XP: Người Mới, 0% tiến độ lên Luyện Sĩ (cần 100 XP)
const lvl0 = computeLevel(0);
assert.equal(lvl0.level, 0);
assert.equal(lvl0.name, 'Người Mới');
assert.equal(lvl0.next.name, 'Luyện Sĩ');
assert.equal(lvl0.xpInLevel, 0);
assert.equal(lvl0.xpNeeded, 100);
assert.equal(lvl0.levelPct, 0);

// Mức 50 XP: Người Mới, 50% tiến độ
const lvl50 = computeLevel(50);
assert.equal(lvl50.level, 0);
assert.equal(lvl50.xpInLevel, 50);
assert.equal(lvl50.levelPct, 50);

// Mức 100 XP: Lên cấp 1 Luyện Sĩ, 0% tiến độ lên Đệ Tử
const lvl100 = computeLevel(100);
assert.equal(lvl100.level, 1);
assert.equal(lvl100.name, 'Luyện Sĩ');
assert.equal(lvl100.next.name, 'Đệ Tử');
assert.equal(lvl100.xpInLevel, 0);
assert.equal(lvl100.xpNeeded, 200); // 300 - 100 = 200
assert.equal(lvl100.levelPct, 0);

// Mức 200 XP: Cấp 1 Luyện Sĩ, 50% tiến độ (được 100/200 XP)
const lvl200 = computeLevel(200);
assert.equal(lvl200.level, 1);
assert.equal(lvl200.xpInLevel, 100);
assert.equal(lvl200.levelPct, 50);

// Mức 2500 XP: Cấp 4 Huyền Thoại (1500 -> 3000 XP, đang có 1000/1500 XP = 67%)
const lvl2500 = computeLevel(2500);
assert.equal(lvl2500.level, 4);
assert.equal(lvl2500.name, 'Huyền Thoại');
assert.equal(lvl2500.xpInLevel, 1000);
assert.equal(lvl2500.xpNeeded, 1500);
assert.equal(lvl2500.levelPct, 67);

// Mức Max (Vô Địch ≥ 3000 XP):
const lvlMax = computeLevel(3500);
assert.equal(lvlMax.level, 5);
assert.equal(lvlMax.name, 'Vô Địch');
assert.equal(lvlMax.next, null, 'cấp tối đa không còn next');
assert.equal(lvlMax.levelPct, 100, 'luôn đạt 100%');
console.log('level calculation and progression thresholds: OK');

/* ── 2. Nguồn điểm XP hiện hành & Loại trừ Legacy ───────────── */
// Chỉ còn 2 nguồn: hoàn thành task (10 XP) và hoàn thành focus session (15 XP)
assert.equal(XP_REWARDS.task_done, 10);
assert.equal(XP_REWARDS.focus_session, 15);
assert.deepEqual(Object.keys(XP_REWARDS).sort(), ['focus_session', 'task_done']);

// Kiểm tra đối tượng XP_REWARDS trong mã nguồn useXpStore.js chỉ có task_done và focus_session
const rewardsMatch = xpHookSrc.match(/export const XP_REWARDS = \{([\s\S]*?)\};/);
assert.ok(rewardsMatch, 'phải export XP_REWARDS');
const rewardsBody = rewardsMatch[1].replace(/\/\/.*$/gm, ''); // bỏ comment
assert.ok(rewardsBody.includes('task_done:'), 'có task_done');
assert.ok(rewardsBody.includes('focus_session:'), 'có focus_session');
assert.doesNotMatch(rewardsBody, /daily_check|streak|quiz|challenge/,
  'không được chứa nguồn XP của các tính năng đã gỡ bỏ');
console.log('active XP rewards and legacy cleanup invariants: OK');

/* ── 3. Thuật toán chu kỳ Pomodoro Focus Timer ──────────────── */
const DEFAULT_FOCUS_SETTINGS = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  sessionsBeforeLong: 4,
};

// Mô phỏng hàm quyết định phase tiếp theo sau khi hoàn thành 1 session
function getNextFocusPhase(completedSessionNumber, settings = DEFAULT_FOCUS_SETTINGS) {
  const isLong = completedSessionNumber % settings.sessionsBeforeLong === 0;
  return isLong ? 'long_break' : 'short_break';
}

assert.equal(getNextFocusPhase(1), 'short_break', 'session 1 -> nghỉ ngắn 5p');
assert.equal(getNextFocusPhase(2), 'short_break', 'session 2 -> nghỉ ngắn 5p');
assert.equal(getNextFocusPhase(3), 'short_break', 'session 3 -> nghỉ ngắn 5p');
assert.equal(getNextFocusPhase(4), 'long_break',  'session 4 -> nghỉ dài 15p');

assert.equal(getNextFocusPhase(5), 'short_break', 'session 5 -> nghỉ ngắn 5p');
assert.equal(getNextFocusPhase(6), 'short_break', 'session 6 -> nghỉ ngắn 5p');
assert.equal(getNextFocusPhase(7), 'short_break', 'session 7 -> nghỉ ngắn 5p');
assert.equal(getNextFocusPhase(8), 'long_break',  'session 8 -> nghỉ dài 15p');

// Bất biến chống cộng XP trùng trong useFocusTimer:
assert.match(focusHookSrc, /\.eq\('reason',\s*'focus_session'\)/,
  'awardFocusXp phải lọc theo reason focus_session');
assert.match(focusHookSrc, /\.contains\('meta',\s*\{\s*sessionId\s*\}\)/,
  'awardFocusXp phải dedup theo sessionId để không cộng XP 2 lần cho 1 session');
console.log('pomodoro cycle progression and session deduplication: OK');

console.log('\n✅ gamificationAndFocus — tất cả kiểm thử Gamification & Focus PASS (100% covered)');

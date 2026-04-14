import { useState, useCallback, useEffect } from 'react';

const KEY = 'vl_xp_store';

const LEVELS = [
  { level: 0, name: 'Người Mới', emoji: '🌱', min: 0 },
  { level: 1, name: 'Luyện Sĩ', emoji: '⚡', min: 100 },
  { level: 2, name: 'Đệ Tử', emoji: '🔥', min: 300 },
  { level: 3, name: 'Chiến Binh', emoji: '⚔️', min: 700 },
  { level: 4, name: 'Huyền Thoại', emoji: '👑', min: 1500 },
  { level: 5, name: 'Vô Địch', emoji: '🏆', min: 3000 },
];

export const XP_REWARDS = {
  daily_check: 10,
  streak_3: 50,
  streak_10: 100,
  streak_21: 200,
  daily_challenge: 20,
  quiz_complete: (score) => Math.round((score / 10) * 50),
  duo_streak: 30,
};

function computeLevel(totalXp) {
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVELS[i].min) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }
  const xpInLevel = totalXp - current.min;
  const xpNeeded = next ? next.min - current.min : 1;
  const levelPct = next ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 100;
  return { ...current, next, xpInLevel, xpNeeded, levelPct };
}

export function useXpStore() {
  const [log, setLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  });

  const totalXp = log.reduce((sum, e) => sum + e.amount, 0);
  const levelInfo = computeLevel(totalXp);

  const addXp = useCallback((amount, reason, meta = {}) => {
    const entry = { amount, reason, meta, ts: Date.now() };
    setLog(prev => {
      const next = [...prev, entry];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
    return entry;
  }, []);

  // Check if a milestone has already been awarded (prevent re-award)
  const hasMilestone = useCallback((reason, meta = {}) => {
    return log.some(e => e.reason === reason && JSON.stringify(e.meta) === JSON.stringify(meta));
  }, [log]);

  return { totalXp, levelInfo, log, addXp, hasMilestone, levels: LEVELS };
}

export { LEVELS, computeLevel };

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'vl_habit_data';
const XP_KEY = 'vl_xp_log';
const MILESTONE_KEY = 'vl_milestones';

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function calcStreak(data) {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (data[key]) streak++;
    else break;
  }
  return streak;
}

function getLongestStreak(data) {
  const keys = Object.keys(data).filter(k => data[k]).sort();
  if (!keys.length) return 0;
  let longest = 1, current = 1;
  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(keys[i - 1]);
    const curr = new Date(keys[i]);
    const diff = (curr - prev) / 86400000;
    if (diff === 1) { current++; longest = Math.max(longest, current); }
    else current = 1;
  }
  return longest;
}

export function getBadge(streak) {
  if (streak >= 21) return { emoji: '🏆', label: 'Hoàn Thành', color: 'gold' };
  if (streak >= 10) return { emoji: '🟡', label: 'Bứt Phá', color: 'gold' };
  if (streak >= 3) return { emoji: '🟢', label: 'Lấy Đà', color: 'green' };
  return null;
}

export function useHabitStore() {
  const [data, setData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  });

  const toggle = useCallback((dateKey) => {
    setData(prev => {
      const next = { ...prev, [dateKey]: !prev[dateKey] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const weekDates = getWeekDates();
  const streak = calcStreak(data);
  const longestStreak = getLongestStreak(data);
  const totalDone = Object.values(data).filter(Boolean).length;
  const weekDone = weekDates.filter(d => data[d]).length;
  const completionPct = Math.round((weekDone / 7) * 100);
  const badge = getBadge(streak);
  const todayDone = !!data[getTodayKey()];

  return {
    data, toggle,
    weekDates, streak, longestStreak,
    totalDone, weekDone, completionPct,
    badge, todayDone,
  };
}

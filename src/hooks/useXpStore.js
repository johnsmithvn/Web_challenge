import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ── Levels ────────────────────────────────────────────────
const LEVELS = [
  { level: 0, name: 'Người Mới',  emoji: '🌱', min: 0    },
  { level: 1, name: 'Luyện Sĩ',  emoji: '⚡',  min: 100  },
  { level: 2, name: 'Đệ Tử',     emoji: '🔥',  min: 300  },
  { level: 3, name: 'Chiến Binh', emoji: '⚔️',  min: 700  },
  { level: 4, name: 'Huyền Thoại',emoji: '👑',  min: 1500 },
  { level: 5, name: 'Vô Địch',   emoji: '🏆',  min: 3000 },
];

export const XP_REWARDS = {
  daily_check:     10,
  streak_3:        50,
  streak_10:       100,
  streak_21:       200,
  daily_challenge: 20,
  quiz_complete:   (score) => Math.round((score / 10) * 50),
  duo_streak:      30,  // TODO: wire into Team Mode v3 when team check is live
  focus_session:   15,  // awarded directly in useFocusTimer.js (avoid circular import)
};

export function computeLevel(totalXp) {
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

export { LEVELS };

// Legacy key — read once then destroy
const LEGACY_KEY   = 'vl_xp_store';
const MIGRATED_KEY = 'vl_xp_migrated';

async function migrateXpToSupabase(userId) {
  if (localStorage.getItem(MIGRATED_KEY) === userId) return;
  try {
    const local = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    if (local.length) {
      const rows = local.map(e => ({
        user_id: userId,
        amount:  e.amount,
        reason:  e.reason,
        meta:    e.meta || {},
        created_at: e.ts ? new Date(e.ts).toISOString() : new Date().toISOString(),
      }));
      await supabase.from('xp_logs').insert(rows);
      console.log(`[XpStore] Migrated ${rows.length} XP entries from localStorage`);
    }
    localStorage.removeItem(LEGACY_KEY);
    localStorage.setItem(MIGRATED_KEY, userId);
  } catch (e) {
    console.warn('[XpStore] Migration failed:', e.message);
  }
}

export function useXpStore() {
  const { user, isAuthenticated } = useAuth();
  const useDB = isSupabaseEnabled && isAuthenticated;

  // In-memory log: [{ amount, reason, meta, ts }]
  const [log, setLog] = useState([]);
  // Prevents double-awarding XP before DB log finishes loading
  const [isReady, setIsReady] = useState(!useDB);

  // On login: migrate then load
  useEffect(() => {
    if (!useDB || !user) {
      setIsReady(true); // guest mode — nothing to load
      return;
    }
    setIsReady(false);

    migrateXpToSupabase(user.id).then(async () => {
      const { data, error } = await supabase
        .from('xp_logs')
        .select('amount, reason, meta, created_at')
        .eq('user_id', user.id)
        .order('created_at');

      if (!error && data) {
        setLog(data.map(r => ({
          amount: r.amount,
          reason: r.reason,
          meta:   r.meta || {},
          ts:     new Date(r.created_at).getTime(),
        })));
      }
      setIsReady(true);
    });
  }, [useDB, user?.id]);

  // Clear on logout
  useEffect(() => {
    if (!useDB) { setLog([]); setIsReady(true); }
  }, [useDB]);

  const addXp = useCallback(async (amount, reason, meta = {}) => {
    // Server-side dedup: check if this exact (reason, meta) already exists in DB
    if (useDB && user) {
      const { data: existing } = await supabase
        .from('xp_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('reason', reason)
        .contains('meta', meta)
        .maybeSingle();

      if (existing) return null; // already awarded — skip
    }

    const entry = { amount, reason, meta, ts: Date.now() };
    setLog(prev => [...prev, entry]);

    if (useDB && user) {
      const { error } = await supabase.from('xp_logs').insert({
        user_id:    user.id,
        amount,
        reason,
        meta:       meta || {},
        created_at: new Date().toISOString(),
      });
      if (error) {
        console.warn('[XpStore] addXp failed:', error.message);
        // Rollback — remove last entry matching this reason+ts
        setLog(prev => prev.filter(e => e.ts !== entry.ts));
      }
    }
    // Guest: in-memory only
    return entry;
  }, [useDB, user]);

  // ── Remove XP (reverse a previous addXp) ──────────────────
  const removeXp = useCallback(async (reason, meta = {}) => {
    const metaStr = JSON.stringify(meta);
    const match = log.find(e => e.reason === reason && JSON.stringify(e.meta) === metaStr);
    if (!match) return; // nothing to reverse

    // Optimistic: remove from in-memory log
    setLog(prev => prev.filter(e => !(e.reason === reason && JSON.stringify(e.meta) === metaStr)));

    if (useDB && user) {
      // Delete the matching xp_logs row from Supabase
      const { error } = await supabase
        .from('xp_logs')
        .delete()
        .eq('user_id', user.id)
        .eq('reason', reason)
        .eq('meta', meta);

      if (error) {
        console.warn('[XpStore] removeXp failed:', error.message);
        // Rollback: put it back
        setLog(prev => [...prev, match]);
      }
    }
  }, [useDB, user, log]);

  const hasMilestone = useCallback((reason, meta = {}) => {
    // Conservative: if DB log hasn't loaded yet, assume already awarded
    // This prevents double-awarding during the async load window
    if (useDB && !isReady) return true;

    return log.some(e =>
      e.reason === reason && JSON.stringify(e.meta) === JSON.stringify(meta)
    );
  }, [log, useDB, isReady]);

  const totalXp  = log.reduce((sum, e) => sum + e.amount, 0);
  const levelInfo = computeLevel(totalXp);

  return { totalXp, levelInfo, log, addXp, removeXp, hasMilestone, isReady, levels: LEVELS };
}

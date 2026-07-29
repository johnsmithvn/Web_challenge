import { useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

// activity_logs.created_at is UTC. Bucket and range queries by the user's LOCAL day,
// otherwise activities after local midnight (e.g. 00:00–07:00 in +07) land on the
// wrong calendar day. `localMidnight` parses 'YYYY-MM-DD' as local time, and
// `.toISOString()` then yields the exact UTC instant of that local midnight.
const pad2 = (n) => String(n).padStart(2, '0');
const localYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const localMidnight = (dateStr) => new Date(`${dateStr}T00:00:00`);

/**
 * useActivityLog — Append-only logging that feeds the Life Log heatmap.
 *
 * Table: activity_logs (see data/schema_v4.24.0.sql § 20)
 *
 * `action` is free-form text (no CHECK constraint). Every value actually written
 * as of v4.26.2 — verified from call sites, keep this list in sync when adding one:
 *
 * | action                | Written by                                        |
 * |-----------------------|---------------------------------------------------|
 * | habit_done/habit_undo | TrackerPage.jsx handleHabitTick                   |
 * | challenge_done        | DailyChallenge.jsx                                |
 * | expense_add           | FinancePage.jsx, InboxPage.jsx (quick expense)    |
 * | subscription_add      | FinancePage.jsx                                   |
 * | task_done             | InboxPage.jsx quick-done ONLY (see caveat below)  |
 * | inbox_snooze          | InboxPage.jsx                                     |
 * | inbox_classify        | InboxPage.jsx (row + detail view)                 |
 * | inbox_bulk_delete     | InboxPage.jsx bulk bar                            |
 * | inbox_bulk_classify   | InboxPage.jsx bulk bar                            |
 * | focus_done            | useFocusTimer.js — inserts DIRECTLY, bypasses this hook |
 *
 * Stale data: rows with action='fitness_done' predate the v4.26.0 tab removal.
 * Append-only means they stay, and the heatmap still counts them.
 *
 * ⚠️ Known limits — see docs/TASKS.md before building on this table:
 * - `amount` mixes 4 units in one column (XP / VNĐ / snooze days / item count)
 *   with no unit column, so it cannot be summed or compared across actions.
 * - Read side only ever COUNTs rows (getHeatmapData, getTodayCount).
 *   `action`, `label`, `amount` and `meta` are written but never read anywhere.
 * - Coverage is partial: useUserTasks.completeTask (the normal way to finish a
 *   task) logs nothing — only Inbox quick-done emits task_done.
 *
 * Design: fire-and-forget inserts. Never blocks the calling hook.
 * No UPDATE/DELETE — append-only audit trail.
 */
export function useActivityLog() {
  const { user } = useAuth();
  const enabled = isSupabaseEnabled && !!user;

  /**
   * Log a single activity. Fire-and-forget — errors are only console.warn'd.
   * @param {string}  action  - One of the defined action types
   * @param {string}  [label] - Human-readable description
   * @param {number}  [amount]- XP value or VNĐ amount
   * @param {object}  [meta]  - Extra context (habit_id, category, etc.)
   */
  const logActivity = useCallback(async (action, label = null, amount = null, meta = {}) => {
    if (!enabled) return;

    try {
      const { error } = await supabase.from('activity_logs').insert({
        user_id: user.id,
        action,
        label,
        amount,
        meta,
      });
      if (error) {
        logger.warn('[useActivityLog] insert error:', error.message);
      }
    } catch (err) {
      logger.warn('[useActivityLog] unexpected error:', err);
    }
  }, [enabled, user]);

  /**
   * Get heatmap data: count of activities per day for a date range.
   * Returns: [{ date: 'YYYY-MM-DD', count: N }, ...]
   */
  const getHeatmapData = useCallback(async (startDate, endDate) => {
    if (!enabled) return [];

    try {
      // Use RPC or raw query for date aggregation
      // Supabase JS doesn't support GROUP BY natively,
      // so we fetch raw and aggregate client-side
      const startLocal = localMidnight(startDate);
      const endLocal = localMidnight(endDate);
      endLocal.setDate(endLocal.getDate() + 1); // exclusive: day after endDate (local)

      const { data, error } = await supabase
        .from('activity_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', startLocal.toISOString())
        .lt('created_at', endLocal.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        logger.warn('[useActivityLog] heatmap query error:', error.message);
        return [];
      }

      // Aggregate by LOCAL date
      const counts = {};
      (data || []).forEach(row => {
        const date = localYMD(new Date(row.created_at));
        counts[date] = (counts[date] || 0) + 1;
      });

      return Object.entries(counts).map(([date, count]) => ({ date, count }));
    } catch (err) {
      logger.warn('[useActivityLog] heatmap error:', err);
      return [];
    }
  }, [enabled, user]);

  /**
   * Get total activity count for today (for quick stats).
   */
  const getTodayCount = useCallback(async () => {
    if (!enabled) return 0;

    try {
      const now = new Date();
      const startLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // local midnight today
      const endLocal = new Date(startLocal);
      endLocal.setDate(endLocal.getDate() + 1);
      const { count, error } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startLocal.toISOString())
        .lt('created_at', endLocal.toISOString());

      if (error) {
        logger.warn('[useActivityLog] todayCount error:', error.message);
        return 0;
      }

      return count || 0;
    } catch (err) {
      logger.warn('[useActivityLog] todayCount unexpected error:', err);
      return 0;
    }
  }, [enabled, user]);

  return {
    logActivity,      // (action, label?, amount?, meta?) => Promise<void>
    getHeatmapData,   // (startDate, endDate) => Promise<[{date, count}]>
    getTodayCount,    // () => Promise<number>
    enabled,          // boolean — whether logging is active
  };
}

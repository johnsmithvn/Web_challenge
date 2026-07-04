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
 * useActivityLog — Append-only logging for Life Log heatmap + timeline.
 *
 * Table: activity_logs (see migration_v3.0.0.sql)
 * - action:     'habit_done' | 'habit_undo' | 'task_done' | 'task_add'
 *               | 'expense_add' | 'collect_add' | 'focus_done'
 *               | 'mood_set' | 'xp_earned' | 'challenge_done'
 *               | 'subscription_add' | 'journey_start' | 'journey_complete'
 * - label:      human-readable text ("Tập thể dục", "85,000₫ Ăn trưa")
 * - amount:     XP or VNĐ if applicable
 * - meta:       JSONB extra context { habit_id, category, etc. }
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
   * Get timeline for a specific date (for DailyTimeline component).
   * Returns: [{ id, action, label, amount, meta, created_at }, ...]
   */
  const getTimelineByDate = useCallback(async (dateStr) => {
    if (!enabled) return [];

    try {
      const startLocal = localMidnight(dateStr);
      const endLocal = localMidnight(dateStr);
      endLocal.setDate(endLocal.getDate() + 1);

      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, action, label, amount, meta, created_at')
        .eq('user_id', user.id)
        .gte('created_at', startLocal.toISOString())
        .lt('created_at', endLocal.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        logger.warn('[useActivityLog] timeline query error:', error.message);
        return [];
      }

      return data || [];
    } catch (err) {
      logger.warn('[useActivityLog] timeline error:', err);
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
    getTimelineByDate,// (dateStr) => Promise<[{id, action, label, ...}]>
    getTodayCount,    // () => Promise<number>
    enabled,          // boolean — whether logging is active
  };
}

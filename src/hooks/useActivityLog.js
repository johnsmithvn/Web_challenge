import { useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
        console.warn('[useActivityLog] insert error:', error.message);
      }
    } catch (err) {
      console.warn('[useActivityLog] unexpected error:', err);
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
      const { data, error } = await supabase
        .from('activity_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[useActivityLog] heatmap query error:', error.message);
        return [];
      }

      // Aggregate by date
      const counts = {};
      (data || []).forEach(row => {
        const date = row.created_at.split('T')[0];
        counts[date] = (counts[date] || 0) + 1;
      });

      return Object.entries(counts).map(([date, count]) => ({ date, count }));
    } catch (err) {
      console.warn('[useActivityLog] heatmap error:', err);
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
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, action, label, amount, meta, created_at')
        .eq('user_id', user.id)
        .gte('created_at', `${dateStr}T00:00:00`)
        .lte('created_at', `${dateStr}T23:59:59`)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[useActivityLog] timeline query error:', error.message);
        return [];
      }

      return data || [];
    } catch (err) {
      console.warn('[useActivityLog] timeline error:', err);
      return [];
    }
  }, [enabled, user]);

  /**
   * Get total activity count for today (for quick stats).
   */
  const getTodayCount = useCallback(async () => {
    if (!enabled) return 0;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);

      if (error) {
        console.warn('[useActivityLog] todayCount error:', error.message);
        return 0;
      }

      return count || 0;
    } catch (err) {
      console.warn('[useActivityLog] todayCount unexpected error:', err);
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

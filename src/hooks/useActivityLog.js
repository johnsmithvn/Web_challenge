import { useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { ACTIONS } from '../utils/taskFields';

// activity_logs.created_at is UTC. Bucket and range queries by the user's LOCAL day,
// otherwise activities after local midnight (e.g. 00:00–07:00 in +07) land on the
// wrong calendar day. `localMidnight` parses 'YYYY-MM-DD' as local time, and
// `.toISOString()` then yields the exact UTC instant of that local midnight.
const pad2 = (n) => String(n).padStart(2, '0');
const localYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const localMidnight = (dateStr) => new Date(`${dateStr}T00:00:00`);

/**
 * useActivityLog — hai việc trong một bảng `activity_logs` (schema v2, migration
 * v5.0.0). Đọc `data/migration_v5.0.0_activity_logs_v2.sql` trước khi sửa file này.
 *
 * ┌ Loại dòng ─────────┬ task_id ┬ field ┬ note ┬ Đếm cho heatmap? ┐
 * │ Sự kiện rời rạc    │  NULL   │ NULL  │ NULL │ CÓ               │
 * │ Sự kiện của task   │  có     │ NULL  │ NULL │ CÓ               │
 * │ Field-diff         │  có     │ có    │ NULL │ KHÔNG            │
 * │ Ghi chú cá nhân    │  có     │ NULL  │ có   │ KHÔNG            │
 * └────────────────────┴─────────┴───────┴──────┴──────────────────┘
 *
 * Quy tắc đếm (chốt 2026-08-02): heatmap Life Log + KPI "Hoạt động hôm nay" CHỈ
 * đếm sự kiện, KHÔNG đếm field-diff và ghi chú — nếu không, sửa 1 task đổi 3
 * field sẽ nhảy +3 "hoạt động", làm heatmap mất ý nghĩa. Bộ lọc dưới đây phải
 * khớp CHÍNH XÁC mệnh đề WHERE của index `idx_activity_logs_heatmap`; lệch là
 * Postgres bỏ qua index.
 *
 * `action` KHÔNG có CHECK constraint dưới DB (cố ý — xem header migration: mọi
 * lệnh ghi ở đây đều fire-and-forget nuốt lỗi, nên constraint bị vi phạm sẽ làm
 * log biến mất âm thầm). Luôn dùng hằng số `ACTIONS` trong utils/taskFields.js,
 * đừng gõ chuỗi thẳng.
 *
 * Ghi: fire-and-forget, không bao giờ chặn hook gọi nó, lỗi chỉ `logger.warn`.
 * Sửa: chỉ cột `note` của dòng ghi chú (RLS + GRANT cấp cột chặn phần còn lại)
 *      → dòng field-diff là bất biến tuyệt đối.
 */
export function useActivityLog() {
  const { user } = useAuth();
  const enabled = isSupabaseEnabled && !!user;

  /** Chỉ đếm sự kiện — bỏ field-diff và ghi chú. Khớp idx_activity_logs_heatmap. */
  const eventsOnly = useCallback(
    (query) => query.is('field', null).neq('action', ACTIONS.NOTE),
    []
  );

  // ── GHI ────────────────────────────────────────────────────────────────

  /**
   * Ghi 1 sự kiện. Fire-and-forget.
   * @param {string} action - hằng số trong ACTIONS
   * @param {string|null} [taskId] - gắn vào 1 task; bỏ trống = sự kiện rời rạc
   */
  const logActivity = useCallback(async (action, taskId = null) => {
    if (!enabled) return;
    try {
      const { error } = await supabase.from('activity_logs').insert({
        user_id: user.id,
        task_id: taskId,
        action,
      });
      if (error) logger.warn('[useActivityLog] insert error:', error.message);
    } catch (err) {
      logger.warn('[useActivityLog] unexpected error:', err);
    }
  }, [enabled, user]);

  /**
   * Ghi nhiều dòng field-diff của cùng 1 task trong 1 lần insert.
   * @param {string} taskId
   * @param {Array<{field:string, old_value:?string, new_value:?string}>} diffs
   *        — kết quả của diffTaskFields() trong utils/taskFields.js
   */
  const logFieldChanges = useCallback(async (taskId, diffs) => {
    if (!enabled || !taskId || !diffs?.length) return;
    try {
      const { error } = await supabase.from('activity_logs').insert(
        diffs.map(d => ({
          user_id: user.id,
          task_id: taskId,
          action: ACTIONS.TASK_UPDATE,
          field: d.field,
          old_value: d.old_value,
          new_value: d.new_value,
        }))
      );
      if (error) logger.warn('[useActivityLog] field-diff insert error:', error.message);
    } catch (err) {
      logger.warn('[useActivityLog] field-diff unexpected error:', err);
    }
  }, [enabled, user]);

  /**
   * Ghi 1 sự kiện tag/liên kết KB. Tên tag / tiêu đề bài viết được ghi THẲNG vào
   * old_value/new_value (không phải uuid) — tab Activity không có cách nào tra
   * ngược tên sau khi tag/bài viết bị xoá.
   */
  const logTaskRelation = useCallback(async (action, taskId, label, removed = false) => {
    if (!enabled || !taskId) return;
    try {
      const { error } = await supabase.from('activity_logs').insert({
        user_id: user.id,
        task_id: taskId,
        action,
        old_value: removed ? label : null,
        new_value: removed ? null : label,
      });
      if (error) logger.warn('[useActivityLog] relation insert error:', error.message);
    } catch (err) {
      logger.warn('[useActivityLog] relation unexpected error:', err);
    }
  }, [enabled, user]);

  // ── GHI CHÚ (tab Note) ─────────────────────────────────────────────────

  /** Thêm ghi chú cho 1 task. Trả row vừa tạo (để prepend vào UI) hoặc null. */
  const addNote = useCallback(async (taskId, note) => {
    if (!enabled || !taskId || !note?.trim()) return null;
    try {
      const { data, error } = await supabase.from('activity_logs').insert({
        user_id: user.id,
        task_id: taskId,
        action: ACTIONS.NOTE,
        note: note.trim(),
      }).select().single();

      if (error) {
        logger.warn('[useActivityLog] addNote error:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      logger.warn('[useActivityLog] addNote unexpected error:', err);
      return null;
    }
  }, [enabled, user]);

  /**
   * Sửa nội dung 1 ghi chú. Chỉ dòng `action='note'` sửa được (policy
   * activity_logs_update_own_note), và chỉ cột `note` (GRANT cấp cột).
   */
  const updateNote = useCallback(async (logId, note) => {
    if (!enabled || !logId || !note?.trim()) return false;
    try {
      const { error } = await supabase
        .from('activity_logs')
        .update({ note: note.trim() })
        .eq('id', logId)
        .eq('user_id', user.id);

      if (error) {
        logger.warn('[useActivityLog] updateNote error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      logger.warn('[useActivityLog] updateNote unexpected error:', err);
      return false;
    }
  }, [enabled, user]);

  // ── ĐỌC ────────────────────────────────────────────────────────────────

  /**
   * Mọi dòng của 1 task (cả field-diff lẫn ghi chú), mới nhất trước.
   * Caller tự tách 2 tab bằng `action === ACTIONS.NOTE` — 1 round-trip, đếm
   * badge cả hai tab có ngay.
   */
  const getTaskLogs = useCallback(async (taskId) => {
    if (!enabled || !taskId) return [];
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('[useActivityLog] getTaskLogs error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      logger.warn('[useActivityLog] getTaskLogs unexpected error:', err);
      return [];
    }
  }, [enabled, user]);

  /** Xoá 1 dòng log hoặc 1 ghi chú (policy activity_logs_delete_own). */
  const deleteLog = useCallback(async (logId) => {
    if (!enabled || !logId) return false;
    try {
      const { error } = await supabase
        .from('activity_logs')
        .delete()
        .eq('id', logId)
        .eq('user_id', user.id);

      if (error) {
        logger.warn('[useActivityLog] deleteLog error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      logger.warn('[useActivityLog] deleteLog unexpected error:', err);
      return false;
    }
  }, [enabled, user]);

  /**
   * Heatmap: số SỰ KIỆN mỗi ngày trong khoảng.
   * Returns: [{ date: 'YYYY-MM-DD', count: N }, ...]
   */
  const getHeatmapData = useCallback(async (startDate, endDate) => {
    if (!enabled) return [];

    try {
      // Supabase JS không hỗ trợ GROUP BY, nên fetch created_at rồi group ở client.
      // Chỉ select 1 cột nên payload không phình theo old_value/new_value.
      const startLocal = localMidnight(startDate);
      const endLocal = localMidnight(endDate);
      endLocal.setDate(endLocal.getDate() + 1); // exclusive: day after endDate (local)

      const { data, error } = await eventsOnly(
        supabase
          .from('activity_logs')
          .select('created_at')
          .eq('user_id', user.id)
      )
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
  }, [enabled, user, eventsOnly]);

  /** Số sự kiện hôm nay (KPI Dashboard + Life Log). */
  const getTodayCount = useCallback(async () => {
    if (!enabled) return 0;

    try {
      const now = new Date();
      const startLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // local midnight today
      const endLocal = new Date(startLocal);
      endLocal.setDate(endLocal.getDate() + 1);

      const { count, error } = await eventsOnly(
        supabase
          .from('activity_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
      )
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
  }, [enabled, user, eventsOnly]);

  return {
    logActivity,       // (action, taskId?) => Promise<void>
    logFieldChanges,   // (taskId, diffs) => Promise<void>
    logTaskRelation,   // (action, taskId, label, removed?) => Promise<void>
    addNote,           // (taskId, note) => Promise<row|null>
    updateNote,        // (logId, note) => Promise<boolean>
    getTaskLogs,       // (taskId) => Promise<row[]>
    deleteLog,         // (logId) => Promise<boolean>
    getHeatmapData,    // (startDate, endDate) => Promise<[{date, count}]>
    getTodayCount,     // () => Promise<number>
    enabled,           // boolean — whether logging is active
  };
}

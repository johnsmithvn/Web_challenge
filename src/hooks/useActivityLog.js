import { useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { ACTIONS } from '../utils/taskFields';

/**
 * useActivityLog — lịch sử thay đổi + ghi chú cá nhân của TASK.
 *
 * Bảng `activity_logs` (schema v2, migration v5.0.0). Đọc file migration trước
 * khi sửa hook này.
 *
 * ┌ Loại dòng ─────────┬ field ┬ note ┐
 * │ Sự kiện của task   │ NULL  │ NULL │  task_created / task_completed / …
 * │ Field-diff         │ có    │ NULL │  task_update, 1 dòng / field đổi
 * │ Ghi chú cá nhân    │ NULL  │ có   │  note
 * └────────────────────┴───────┴──────┘
 *
 * MỌI dòng đều gắn `task_id` (FK ON DELETE CASCADE) — xoá task là DB tự dọn
 * sạch lịch sử của nó, không bao giờ có dòng mồ côi.
 *
 * Bảng chỉ lưu lịch sử gắn với Task; Finance, Inbox và Focus có data owner riêng.
 *
 * `action` KHÔNG có CHECK constraint dưới DB (cố ý — mọi lệnh ghi ở đây đều
 * fire-and-forget nuốt lỗi, nên constraint bị vi phạm sẽ làm log biến mất âm
 * thầm). Luôn dùng hằng số `ACTIONS` trong utils/taskFields.js.
 *
 * Ghi: fire-and-forget, không bao giờ chặn hook gọi nó, lỗi chỉ `logger.warn`.
 * Sửa: chỉ cột `note` của dòng ghi chú (RLS + GRANT cấp cột chặn phần còn lại)
 *      → dòng field-diff là bất biến tuyệt đối.
 */
export function useActivityLog() {
  const { user } = useAuth();
  const enabled = isSupabaseEnabled && !!user;

  // ── GHI ────────────────────────────────────────────────────────────────

  /**
   * Ghi 1 sự kiện của task (tạo / hoàn thành / bỏ hoàn thành). Fire-and-forget.
   * @param {string} action - hằng số trong ACTIONS
   * @param {string} taskId
   */
  const logTaskEvent = useCallback(async (action, taskId) => {
    if (!enabled || !taskId) return;
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

  return {
    logTaskEvent,      // (action, taskId) => Promise<void>
    logFieldChanges,   // (taskId, diffs) => Promise<void>
    logTaskRelation,   // (action, taskId, label, removed?) => Promise<void>
    addNote,           // (taskId, note) => Promise<row|null>
    updateNote,        // (logId, note) => Promise<boolean>
    getTaskLogs,       // (taskId) => Promise<row[]>
    deleteLog,         // (logId) => Promise<boolean>
    enabled,           // boolean — whether logging is active
  };
}

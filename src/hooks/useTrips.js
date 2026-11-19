import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * useTrips — data owner Chuyến đi của module Chốn (bảng trips, trip_options, trip_places; RPC choose_trip_option).
 * Thiết kế: docs/PLAN_CHON.md §3.2. Auth-only.
 *
 * Mỗi chuyến mang `trip_options[]`, `trip_places[]` và `prep_task` ({ id, title, due_date, completed } | null — việc
 * cha "Chuẩn bị …" bên Nhiệm vụ). Việc con của nó (danh sách chuẩn bị đã đẩy) đọc bằng useUserTasks().getSubtasks.
 * Thao tác ghi trả `{ data }` hoặc `{ error: string }`.
 * Used by: ChonPage, ChonTripView.
 */
const TRIP_SELECT = '*, trip_options(*), trip_places(*), prep_task:user_tasks!fk_trips_prep_task(id, title, due_date, completed)';
const FAIL = 'Chưa lưu được — kiểm tra mạng rồi thử lại.';

const errorText = (err) => {
  const msg = err?.message || '';
  if (/[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i.test(msg)) return msg;
  if (err?.code) return `Chưa lưu được — máy chủ báo lỗi (mã ${err.code}). Thử lại, còn lỗi thì báo mã này.`;
  return FAIL;
};

export function useTrips() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;
  const userId = user?.id;

  const [trips, setTrips] = useState([]);           // chưa vào thùng rác
  const [tripTrash, setTripTrash] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(enabled);

  const userRef = useRef(userId);
  useEffect(() => { userRef.current = userId; }, [userId]);
  const tripsRef = useRef(trips);   // bản hiện tại để rollback khi ghi lỗi
  useEffect(() => { tripsRef.current = trips; }, [trips]);

  const patchTrip = useCallback((id, fn) => {
    setTrips(prev => prev.map(t => (t.id === id ? fn(t) : t)));
  }, []);
  const patchOptions = useCallback((tripId, fn) => {
    patchTrip(tripId, t => ({ ...t, trip_options: fn(t.trip_options || []) }));
  }, [patchTrip]);

  // ── Fetch ──
  const fetchTrips = useCallback(async () => {
    if (!enabled) return;
    const uid = userId;
    setTripsLoading(true);
    const { data, error } = await supabase
      .from('trips').select(TRIP_SELECT).eq('user_id', uid)
      .order('start_date', { ascending: true, nullsFirst: false }).limit(300);
    if (userRef.current !== uid) return;
    if (error) {
      logger.warn('[useTrips] fetch error:', error.message);
    } else {
      const all = data || [];
      setTrips(all.filter(t => !t.archived_at));
      setTripTrash(all.filter(t => t.archived_at).sort((a, b) => String(b.archived_at).localeCompare(String(a.archived_at))));
    }
    setTripsLoading(false);
  }, [enabled, userId]);

  // ── Chuyến ──
  /** @param {object} fields — value của tripLogic.cleanTrip */
  const addTrip = useCallback(async (fields) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const uid = userId;
    const { data, error } = await supabase.from('trips').insert({ ...fields, user_id: uid }).select('*').single();
    if (error) {
      logger.warn('[useTrips] addTrip:', error.message);
      return { error: errorText(error) };
    }
    const shaped = { ...data, trip_options: [], trip_places: [], prep_task: null };
    if (userRef.current === uid) setTrips(prev => [...prev, shaped]);
    return { data: shaped };
  }, [enabled, userId]);

  /** Sửa trường của chuyến — optimistic, lỗi thì trả lại bản cũ. `extra` = dữ liệu hiển thị kèm (vd prep_task). */
  const updateTrip = useCallback(async (id, patch, extra = {}) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const before = tripsRef.current.find(t => t.id === id) || null;
    patchTrip(id, t => ({ ...t, ...patch, ...extra }));
    const { error } = await supabase.from('trips').update(patch).eq('id', id).eq('user_id', userId);
    if (error) {
      logger.warn('[useTrips] updateTrip:', error.message);
      if (before) patchTrip(id, () => before);
      return { error: errorText(error) };
    }
    return { data: true };
  }, [enabled, userId, patchTrip]);

  const setTripTrashed = useCallback(async (trip, trashed) => {
    if (!enabled || !trip) return { error: 'Cần đăng nhập.' };
    const archived_at = trashed ? new Date().toISOString() : null;
    const moved = { ...trip, archived_at };
    const [setFrom, setTo] = trashed ? [setTrips, setTripTrash] : [setTripTrash, setTrips];
    setFrom(prev => prev.filter(t => t.id !== trip.id));
    setTo(prev => [moved, ...prev.filter(t => t.id !== trip.id)]);
    const { error } = await supabase.from('trips').update({ archived_at }).eq('id', trip.id).eq('user_id', userId);
    if (error) {
      logger.warn('[useTrips] trash move:', error.message);
      fetchTrips();
      return { error: errorText(error) };
    }
    return { data: true };
  }, [enabled, userId, fetchTrips]);
  const archiveTrip = useCallback(t => setTripTrashed(t, true), [setTripTrashed]);
  const restoreTrip = useCallback(t => setTripTrashed(t, false), [setTripTrashed]);

  /** Xoá vĩnh viễn (từ thùng rác). Lựa chọn + chốn trong chuyến đi theo cascade; việc / giao dịch giữ nguyên. */
  const deleteTrip = useCallback(async (id) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    setTripTrash(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from('trips').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      logger.warn('[useTrips] deleteTrip:', error.message);
      fetchTrips();
      return { error: errorText(error) };
    }
    return { data: true };
  }, [enabled, userId, fetchTrips]);

  // ── Lựa chọn ──
  /** @param {object} fields — value của tripLogic.cleanOption; sortOrder do trang tính (nextSortOrder) */
  const addOption = useCallback(async (tripId, fields, sortOrder) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { data, error } = await supabase.from('trip_options')
      .insert({ ...fields, trip_id: tripId, user_id: userId, sort_order: sortOrder }).select('*').single();
    if (error) {
      logger.warn('[useTrips] addOption:', error.message);
      return { error: errorText(error) };
    }
    patchOptions(tripId, opts => [...opts, data]);
    return { data };
  }, [enabled, userId, patchOptions]);

  const updateOption = useCallback(async (tripId, optionId, patch) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { data, error } = await supabase.from('trip_options')
      .update(patch).eq('id', optionId).eq('user_id', userId).select('*').single();
    if (error) {
      logger.warn('[useTrips] updateOption:', error.message);
      return { error: errorText(error) };
    }
    patchOptions(tripId, opts => opts.map(o => (o.id === optionId ? data : o)));
    return { data };
  }, [enabled, userId, patchOptions]);

  const deleteOption = useCallback(async (tripId, optionId) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { error } = await supabase.from('trip_options').delete().eq('id', optionId).eq('user_id', userId);
    if (error) {
      logger.warn('[useTrips] deleteOption:', error.message);
      return { error: errorText(error) };
    }
    patchOptions(tripId, opts => opts.filter(o => o.id !== optionId));
    return { data: true };
  }, [enabled, userId, patchOptions]);

  /**
   * Đặt / bỏ "Đang nghiêng về". Hai update (bỏ cái cũ rồi đặt cái mới) vì partial unique index kiểm từng dòng;
   * hỏng giữa chừng chỉ mất nhãn → tải lại cho khớp.
   */
  const setLeaning = useCallback(async (tripId, optionId) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const clear = await supabase.from('trip_options').update({ pick: null })
      .eq('trip_id', tripId).eq('user_id', userId).eq('pick', 'leaning');
    const set = !clear.error && optionId
      ? await supabase.from('trip_options').update({ pick: 'leaning' }).eq('id', optionId).eq('user_id', userId)
      : { error: clear.error };
    if (clear.error || set.error) {
      logger.warn('[useTrips] setLeaning:', (clear.error || set.error).message);
      fetchTrips();
      return { error: errorText(clear.error || set.error) };
    }
    patchOptions(tripId, opts => opts.map(o => (o.pick === 'leaning' ? { ...o, pick: null } : o))
      .map(o => (o.id === optionId ? { ...o, pick: 'leaning' } : o)));
    return { data: true };
  }, [enabled, userId, patchOptions, fetchTrips]);

  /**
   * Chốt lựa chọn qua RPC choose_trip_option (một transaction, không optimistic).
   * @param {{ amount, category_id, subcategory_id, necessity }|null} finance — null = không ghi Tài chính
   */
  const chooseOption = useCallback(async (tripId, optionId, finance = null) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { data, error } = await supabase.rpc('choose_trip_option', {
      p_trip_id: tripId,
      p_option_id: optionId,
      p_amount: finance?.amount ?? null,
      p_to_finance: !!finance,
      p_category_id: finance?.category_id ?? null,
      p_subcategory_id: finance?.subcategory_id ?? null,
      p_necessity: finance?.necessity ?? null,
    });
    if (error) {
      logger.warn('[useTrips] chooseOption:', error.message);
      return { error: errorText(error) };
    }
    patchTrip(tripId, t => ({
      ...t,
      status: data.status,
      finance_tx_id: data.finance_tx_id,
      trip_options: (t.trip_options || []).map(o => ({ ...o, pick: o.id === optionId ? 'chosen' : null })),
    }));
    return { data };
  }, [enabled, patchTrip]);

  // ── Chốn trong chuyến ──
  const addTripPlaces = useCallback(async (tripId, rows) => {
    if (!enabled || !rows.length) return { data: [] };
    const payload = rows.map(r => ({ ...r, trip_id: tripId, user_id: userId }));
    const { data, error } = await supabase.from('trip_places').upsert(payload, { onConflict: 'trip_id,place_id' }).select('*');
    if (error) {
      logger.warn('[useTrips] addTripPlaces:', error.message);
      return { error: errorText(error) };
    }
    const ids = new Set(data.map(r => r.place_id));
    patchTrip(tripId, t => ({ ...t, trip_places: [...(t.trip_places || []).filter(r => !ids.has(r.place_id)), ...data] }));
    return { data };
  }, [enabled, userId, patchTrip]);

  const moveTripPlace = useCallback(async (tripId, placeId, dayIndex) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { error } = await supabase.from('trip_places').update({ day_index: dayIndex || null })
      .eq('trip_id', tripId).eq('place_id', placeId).eq('user_id', userId);
    if (error) {
      logger.warn('[useTrips] moveTripPlace:', error.message);
      return { error: errorText(error) };
    }
    patchTrip(tripId, t => ({ ...t, trip_places: (t.trip_places || []).map(r => (r.place_id === placeId ? { ...r, day_index: dayIndex || null } : r)) }));
    return { data: true };
  }, [enabled, userId, patchTrip]);

  const removeTripPlace = useCallback(async (tripId, placeId) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { error } = await supabase.from('trip_places').delete()
      .eq('trip_id', tripId).eq('place_id', placeId).eq('user_id', userId);
    if (error) {
      logger.warn('[useTrips] removeTripPlace:', error.message);
      return { error: errorText(error) };
    }
    patchTrip(tripId, t => ({ ...t, trip_places: (t.trip_places || []).filter(r => r.place_id !== placeId) }));
    return { data: true };
  }, [enabled, userId, patchTrip]);

  return {
    trips, tripTrash, tripsLoading, fetchTrips,
    addTrip, updateTrip, archiveTrip, restoreTrip, deleteTrip,
    addOption, updateOption, deleteOption, setLeaning, chooseOption,
    addTripPlaces, moveTripPlace, removeTripPlace,
  };
}

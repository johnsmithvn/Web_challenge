import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * usePlaces — data owner của module Chốn (bảng places, place_sources, place_visits; RPC light_place).
 * Thiết kế: docs/PLAN_CHON.md §5. Auth-only.
 *
 * Mỗi chốn mang `place_sources[]`, `place_visits[]` và `plan_task` ({ id, title, due_date, completed } | null —
 * việc "Đi …" bên Nhiệm vụ). Trạng thái Muốn đến / Đã đến suy ra bằng placeLogic.placeState.
 *
 * Thao tác ghi trả `{ data }` hoặc `{ error: string }` (câu tiếng Việt để hiện toast).
 * Used by: ChonPage và các component trong components/chon.
 */
const PLACE_SELECT = '*, place_sources(*), place_visits(*), plan_task:user_tasks!fk_places_plan_task(id, title, due_date, completed)';
const FAIL = 'Chưa lưu được — kiểm tra mạng rồi thử lại.';

const errorText = (err) => {
  const msg = err?.message || '';
  // Câu RAISE của migration là tiếng Việt → hiện thẳng; lỗi kỹ thuật thì câu chung.
  return /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i.test(msg) ? msg : FAIL;
};

export function usePlaces() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;
  const userId = user?.id;

  const [places, setPlaces] = useState([]);   // chưa vào thùng rác, mới lưu trước
  const [trash, setTrash] = useState([]);     // archived_at khác NULL, bỏ gần nhất trước
  const [isLoading, setIsLoading] = useState(enabled);
  const [loadError, setLoadError] = useState(null);

  // Response của user cũ (đăng xuất / đổi tài khoản giữa chừng) không được ghi vào state.
  const userRef = useRef(userId);
  useEffect(() => { userRef.current = userId; }, [userId]);

  const patchPlace = useCallback((id, fn) => {
    setPlaces(prev => prev.map(p => (p.id === id ? fn(p) : p)));
  }, []);

  // ── Fetch ────────────────────────────────────────────────────
  const fetchPlaces = useCallback(async () => {
    if (!enabled) return;
    const uid = userId;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('places')
      .select(PLACE_SELECT)
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (userRef.current !== uid) return;
    if (error) {
      logger.warn('[usePlaces] fetch error:', error.message);
      setLoadError(FAIL);
    } else {
      const all = data || [];
      setPlaces(all.filter(p => !p.archived_at));
      setTrash(all.filter(p => p.archived_at).sort((a, b) => String(b.archived_at).localeCompare(String(a.archived_at))));
      setLoadError(null);
    }
    setIsLoading(false);
  }, [enabled, userId]);

  // ── Chốn ─────────────────────────────────────────────────────
  /**
   * Tạo chốn (+ lời giới thiệu đầu tiên nếu có). Nguồn lỗi → xoá chốn vừa tạo để không còn chốn mồ côi.
   * @param {object} fields — value của placeLogic.cleanPlace
   * @param {object|null} source — value của placeLogic.cleanSource
   */
  const addPlace = useCallback(async (fields, source = null) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const uid = userId;
    const { data: place, error } = await supabase
      .from('places').insert({ ...fields, user_id: uid }).select('*').single();
    if (error) {
      logger.warn('[usePlaces] addPlace:', error.message);
      return { error: errorText(error) };
    }
    let sources = [];
    if (source) {
      const res = await supabase.from('place_sources').insert({ ...source, place_id: place.id, user_id: uid }).select('*').single();
      if (res.error) {
        logger.warn('[usePlaces] addPlace source:', res.error.message);
        await supabase.from('places').delete().eq('id', place.id).eq('user_id', uid);
        return { error: errorText(res.error) };
      }
      sources = [res.data];
    }
    const shaped = { ...place, place_sources: sources, place_visits: [], plan_task: null };
    if (userRef.current === uid) setPlaces(prev => [shaped, ...prev]);
    return { data: shaped };
  }, [enabled, userId]);

  /** Sửa trường của chốn — optimistic, lỗi thì trả lại bản cũ. */
  const updatePlace = useCallback(async (id, patch) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const before = places.find(p => p.id === id);
    patchPlace(id, p => ({ ...p, ...patch }));
    const { error } = await supabase.from('places').update(patch).eq('id', id).eq('user_id', userId);
    if (error) {
      logger.warn('[usePlaces] updatePlace:', error.message);
      if (before) patchPlace(id, () => before);
      return { error: errorText(error) };
    }
    return { data: true };
  }, [enabled, userId, places, patchPlace]);

  // ── Thùng rác ────────────────────────────────────────────────
  const setTrashed = useCallback(async (place, trashed) => {
    if (!enabled || !place) return { error: 'Cần đăng nhập.' };
    const archived_at = trashed ? new Date().toISOString() : null;
    const moved = { ...place, archived_at };
    const [setFrom, setTo] = trashed ? [setPlaces, setTrash] : [setTrash, setPlaces];
    setFrom(prev => prev.filter(p => p.id !== place.id));
    setTo(prev => [moved, ...prev.filter(p => p.id !== place.id)]);
    const { error } = await supabase.from('places').update({ archived_at }).eq('id', place.id).eq('user_id', userId);
    if (error) {
      logger.warn('[usePlaces] trash move:', error.message);
      fetchPlaces();
      return { error: errorText(error) };
    }
    return { data: true };
  }, [enabled, userId, fetchPlaces]);

  const archivePlace = useCallback(place => setTrashed(place, true), [setTrashed]);
  const restorePlace = useCallback(place => setTrashed(place, false), [setTrashed]);

  /** Xoá vĩnh viễn (chỉ từ thùng rác). Nguồn + lần đến đi theo cascade; giao dịch Tài chính giữ nguyên. */
  const deletePlace = useCallback(async (id) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    setTrash(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from('places').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      logger.warn('[usePlaces] deletePlace:', error.message);
      fetchPlaces();
      return { error: errorText(error) };
    }
    return { data: true };
  }, [enabled, userId, fetchPlaces]);

  // ── Lời giới thiệu ───────────────────────────────────────────
  const addSource = useCallback(async (placeId, source) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { data, error } = await supabase
      .from('place_sources').insert({ ...source, place_id: placeId, user_id: userId }).select('*').single();
    if (error) {
      logger.warn('[usePlaces] addSource:', error.message);
      return { error: errorText(error) };
    }
    patchPlace(placeId, p => ({ ...p, place_sources: [...(p.place_sources || []), data] }));
    return { data };
  }, [enabled, userId, patchPlace]);

  const updateSource = useCallback(async (placeId, sourceId, patch) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { data, error } = await supabase
      .from('place_sources').update(patch).eq('id', sourceId).eq('user_id', userId).select('*').single();
    if (error) {
      logger.warn('[usePlaces] updateSource:', error.message);
      return { error: errorText(error) };
    }
    patchPlace(placeId, p => ({ ...p, place_sources: (p.place_sources || []).map(s => (s.id === sourceId ? data : s)) }));
    return { data };
  }, [enabled, userId, patchPlace]);

  const deleteSource = useCallback(async (placeId, sourceId) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { error } = await supabase.from('place_sources').delete().eq('id', sourceId).eq('user_id', userId);
    if (error) {
      logger.warn('[usePlaces] deleteSource:', error.message);
      return { error: errorText(error) };
    }
    patchPlace(placeId, p => ({ ...p, place_sources: (p.place_sources || []).filter(s => s.id !== sourceId) }));
    return { data: true };
  }, [enabled, userId, patchPlace]);

  // ── Thắp đèn ─────────────────────────────────────────────────
  /**
   * Ghi một lần đến (+ giao dịch Tài chính) qua RPC light_place — một transaction, KHÔNG optimistic.
   * @param {object} visit — value của placeLogic.cleanVisit
   * @param {{ category_id, subcategory_id, necessity }|null} finance — null = không ghi Tài chính
   */
  const lightPlace = useCallback(async (placeId, visit, finance = null) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { data, error } = await supabase.rpc('light_place', {
      p_place_id: placeId,
      p_visited_on: visit.visited_on,
      p_rating: visit.rating,
      p_revisit: visit.revisit,
      p_dishes: visit.dishes,
      p_liked_dishes: visit.liked_dishes,
      p_party_size: visit.party_size,
      p_note: visit.note,
      p_photos: visit.photos,
      p_spent: visit.spent,
      p_to_finance: !!finance,
      p_category_id: finance?.category_id ?? null,
      p_subcategory_id: finance?.subcategory_id ?? null,
      p_necessity: finance?.necessity ?? null,
    });
    if (error) {
      logger.warn('[usePlaces] lightPlace:', error.message);
      return { error: errorText(error) };
    }
    patchPlace(placeId, p => ({ ...p, place_visits: [...(p.place_visits || []), data] }));
    return { data };
  }, [enabled, patchPlace]);

  /** Sửa lần đến (không đổi giao dịch Tài chính đã ghi). */
  const updateVisit = useCallback(async (placeId, visitId, patch) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { data, error } = await supabase
      .from('place_visits').update(patch).eq('id', visitId).eq('user_id', userId).select('*').single();
    if (error) {
      logger.warn('[usePlaces] updateVisit:', error.message);
      return { error: errorText(error) };
    }
    patchPlace(placeId, p => ({ ...p, place_visits: (p.place_visits || []).map(v => (v.id === visitId ? data : v)) }));
    return { data };
  }, [enabled, userId, patchPlace]);

  /** Xoá lần đến. Giao dịch Tài chính (nếu có) KHÔNG bị xoá — tiền đã tiêu là thật. */
  const deleteVisit = useCallback(async (placeId, visitId) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { error } = await supabase.from('place_visits').delete().eq('id', visitId).eq('user_id', userId);
    if (error) {
      logger.warn('[usePlaces] deleteVisit:', error.message);
      return { error: errorText(error) };
    }
    patchPlace(placeId, p => ({ ...p, place_visits: (p.place_visits || []).filter(v => v.id !== visitId) }));
    return { data: true };
  }, [enabled, userId, patchPlace]);

  // ── Hẹn ngày (việc tạo bởi useUserTasks.addTask ở component hẹn) ──
  /** @param {{ id, title, due_date, completed }|null} task */
  const setPlanTask = useCallback(async (placeId, task) => {
    if (!enabled) return { error: 'Cần đăng nhập.' };
    const { error } = await supabase
      .from('places').update({ plan_task_id: task?.id ?? null }).eq('id', placeId).eq('user_id', userId);
    if (error) {
      logger.warn('[usePlaces] setPlanTask:', error.message);
      return { error: errorText(error) };
    }
    patchPlace(placeId, p => ({
      ...p,
      plan_task_id: task?.id ?? null,
      plan_task: task ? { id: task.id, title: task.title, due_date: task.due_date ?? null, completed: !!task.completed } : null,
    }));
    return { data: true };
  }, [enabled, userId, patchPlace]);

  return {
    places,         // chốn đang dùng (không gồm thùng rác)
    trash,          // thùng rác, bỏ gần nhất trước
    isLoading,
    loadError,      // string | null
    enabled,
    fetchPlaces,    // () => Promise<void>
    addPlace,       // (fields, source|null) => { data|error }
    updatePlace,    // (id, patch)
    archivePlace,   // (place)
    restorePlace,   // (place)
    deletePlace,    // (id) — vĩnh viễn
    addSource,      // (placeId, source)
    updateSource,   // (placeId, sourceId, patch)
    deleteSource,   // (placeId, sourceId)
    lightPlace,     // (placeId, visit, finance|null)
    updateVisit,    // (placeId, visitId, patch)
    deleteVisit,    // (placeId, visitId)
    setPlanTask,    // (placeId, task|null)
  };
}

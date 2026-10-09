import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { normalizeHttpUrl } from '../utils/mediaUtils';

// Key cũ khi link còn nằm trong localStorage (trước bảng body_exercise_videos). Chỉ đọc để chuyển lên DB.
const LEGACY_STORAGE_KEY = 'body_custom_exercise_videos';
let legacyMigration = null;

// Chuyển link cũ trong localStorage lên DB một lần mỗi lần tải trang; thành công mới xoá key cũ.
// ignoreDuplicates: link đã có trên DB (gắn từ máy khác) được giữ nguyên.
function migrateLegacyVideos(userId) {
  if (legacyMigration) return legacyMigration;
  legacyMigration = (async () => {
    let map = null;
    try {
      map = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
    } catch {
      map = null;
    }
    if (!map || typeof map !== 'object') return;

    const rows = Object.entries(map)
      .map(([key, url]) => ({ user_id: userId, exercise_key: key, video_url: normalizeHttpUrl(url) }))
      .filter(r => r.exercise_key && r.exercise_key.length <= 100 && r.video_url);

    if (rows.length) {
      const { error } = await supabase
        .from('body_exercise_videos')
        .upsert(rows, { onConflict: 'user_id,exercise_key', ignoreDuplicates: true });
      if (error) {
        console.warn('Legacy exercise video migration failed:', error);
        legacyMigration = null; // lần mở sau thử lại, chưa xoá key cũ
        return;
      }
    }
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore
    }
  })();
  return legacyMigration;
}

/**
 * Link video thị phạm do user tự gắn cho 1 bài tập (bảng body_exercise_videos).
 * Guest: chỉ giữ trong bộ nhớ React, mất khi tải lại trang (RULES §4).
 * @param {string} exerciseKey key bài trong body-exercises.json hoặc id bài tự tạo
 * @returns {{ customUrl: string|null, saveUrl: (url: string) => Promise<void>, removeUrl: () => Promise<void> }}
 */
export function useExerciseVideo(exerciseKey) {
  const { user } = useAuth();
  const userId = user?.id || null;
  // Gắn theo `${chủ}:${bài}` để response cũ (đổi bài / đổi user) không ghi nhầm chỗ
  const slot = `${userId || 'guest'}:${exerciseKey}`;
  const [urls, setUrls] = useState({});

  useEffect(() => {
    if (!userId || !exerciseKey) return;
    let alive = true;
    (async () => {
      await migrateLegacyVideos(userId);
      const { data, error } = await supabase
        .from('body_exercise_videos')
        .select('video_url')
        .eq('user_id', userId)
        .eq('exercise_key', exerciseKey)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        console.warn('Exercise video fetch error:', error);
        return;
      }
      setUrls(m => ({ ...m, [`${userId}:${exerciseKey}`]: data?.video_url || null }));
    })();
    return () => { alive = false; };
  }, [userId, exerciseKey]);

  const saveUrl = useCallback(async (url) => {
    const prev = urls[slot] ?? null;
    setUrls(m => ({ ...m, [slot]: url }));
    if (!userId) return;

    const { error } = await supabase
      .from('body_exercise_videos')
      .upsert({
        user_id: userId,
        exercise_key: exerciseKey,
        video_url: url,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,exercise_key' });
    if (error) {
      setUrls(m => ({ ...m, [slot]: prev }));
      throw error;
    }
  }, [urls, slot, userId, exerciseKey]);

  const removeUrl = useCallback(async () => {
    const prev = urls[slot] ?? null;
    setUrls(m => ({ ...m, [slot]: null }));
    if (!userId) return;

    const { error } = await supabase
      .from('body_exercise_videos')
      .delete()
      .eq('user_id', userId)
      .eq('exercise_key', exerciseKey);
    if (error) {
      setUrls(m => ({ ...m, [slot]: prev }));
      throw error;
    }
  }, [urls, slot, userId, exerciseKey]);

  return { customUrl: urls[slot] ?? null, saveUrl, removeUrl };
}

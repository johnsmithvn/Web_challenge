import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { contentKind } from '../utils/kbDeriveUtils';

export function useRandomPodcast() {
  const [podcast, setPodcast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRandomPodcast = useCallback(async () => {
    // Chưa cấu hình Supabase (guest/local) → không có podcast; trước đây văng lỗi `null.from`.
    if (!supabase) return;
    setIsLoading(true);
    try {
      // Podcast = bài Kiến thức có link âm thanh (contentKind 'audio'), không còn kiểu bài riêng.
      // Supabase JS không có RANDOM() nếu không dùng RPC → lấy danh sách rồi chọn ở client.
      // Chỉ lấy cột cần (không kéo `body` dài của mọi bài — chạy ở mọi trang).
      const { data, error } = await supabase
        .from('collections')
        .select('id, title, url, type')
        .neq('status', 'archived') // bài trong Thùng rác
        .not('url', 'is', null);

      if (error) throw error;

      const pool = (data || []).filter(item => contentKind(item) === 'audio');
      setPodcast(pool.length ? pool[Math.floor(Math.random() * pool.length)] : null);
    } catch (err) {
      logger.error('Error fetching random podcast:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRandomPodcast();
  }, [fetchRandomPodcast]);

  return { podcast, fetchRandomPodcast, isLoading };
}

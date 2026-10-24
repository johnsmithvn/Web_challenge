import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export function useRandomPodcast() {
  const [podcast, setPodcast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRandomPodcast = useCallback(async () => {
    // Chưa cấu hình Supabase (guest/local) → không có podcast; trước đây văng lỗi `null.from`.
    if (!supabase) return;
    setIsLoading(true);
    try {
      // Supabase JS không có RANDOM() nếu không dùng RPC → lấy danh sách rồi chọn ở client.
      // Chỉ lấy cột trình phát cần (không kéo `body` dài của mọi podcast — chạy ở mọi trang).
      const { data, error } = await supabase
        .from('collections')
        .select('id, title, url')
        .eq('type', 'podcast')
        .not('url', 'is', null);

      if (error) throw error;

      if (data && data.length > 0) {
        // Pick random
        const randomIndex = Math.floor(Math.random() * data.length);
        setPodcast(data[randomIndex]);
      } else {
        setPodcast(null);
      }
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

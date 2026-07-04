import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export function useRandomPodcast() {
  const [podcast, setPodcast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRandomPodcast = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all items that are either type='podcast' or have a valid audio url
      // Actually, Supabase doesn't have a direct 'RANDOM()' function in JS client without RPC.
      // We will just fetch podcast types and pick one in JS.
      const { data, error } = await supabase
        .from('collections')
        .select('id, title, url, body, type, content_format')
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

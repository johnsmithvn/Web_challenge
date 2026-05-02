import { useState, useCallback, useRef } from 'react';

/**
 * useLinkMeta — Fetch and cache OG metadata for URLs via /api/meta edge function.
 *
 * Usage:
 *   const { getMeta, metaCache } = useLinkMeta();
 *   getMeta('https://example.com'); // triggers fetch, updates metaCache
 *   const meta = metaCache['https://example.com']; // { title, image, desc, blocked, loading }
 */
export function useLinkMeta() {
  const [metaCache, setMetaCache] = useState({}); // url → { title, image, desc, blocked, loading }
  const fetchingRef = useRef(new Set());

  const getMeta = useCallback(async (url) => {
    if (!url || fetchingRef.current.has(url)) return;
    if (metaCache[url] && !metaCache[url].loading) return metaCache[url];

    fetchingRef.current.add(url);
    setMetaCache(prev => ({ ...prev, [url]: { title: '', image: '', desc: '', blocked: false, loading: true } }));

    try {
      const res = await fetch(`/api/meta?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        setMetaCache(prev => ({ ...prev, [url]: { title: '', image: '', desc: '', blocked: true, loading: false } }));
        return;
      }

      const data = await res.json();
      setMetaCache(prev => ({ ...prev, [url]: { ...data, loading: false } }));
    } catch {
      setMetaCache(prev => ({ ...prev, [url]: { title: '', image: '', desc: '', blocked: true, loading: false } }));
    } finally {
      fetchingRef.current.delete(url);
    }
  }, [metaCache]);

  return { getMeta, metaCache };
}

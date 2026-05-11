/**
 * Media utility functions — shared between Markdown + Tiptap editors.
 * @module mediaUtils
 */

/**
 * Extract YouTube video ID from various URL formats.
 * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
 * @param {string} url
 * @returns {string|null} Video ID or null
 */
export function extractYoutubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // youtube.com/watch?v=ID
    if (u.hostname.includes('youtube.com') && u.searchParams.has('v')) {
      return u.searchParams.get('v');
    }
    // youtu.be/ID
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('/')[0];
    }
    // youtube.com/embed/ID
    if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/embed/')) {
      return u.pathname.split('/embed/')[1]?.split('?')[0];
    }
  } catch { /* invalid URL */ }
  return null;
}

/**
 * Check if a URL points to a YouTube video.
 * @param {string} url
 * @returns {boolean}
 */
export function isYoutubeUrl(url) {
  return extractYoutubeId(url) !== null;
}

/**
 * Check if a URL points to an audio file based on extension.
 * @param {string} url
 * @returns {boolean}
 */
export function isAudioUrl(url) {
  if (!url) return false;
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(mp3|m4a|ogg|wav|aac|flac|webm)$/.test(pathname);
  } catch {
    return /\.(mp3|m4a|ogg|wav|aac|flac|webm)(\?|$)/i.test(url);
  }
}

/**
 * Media utility functions — shared between Markdown + Tiptap editors.
 * @module mediaUtils
 */

/**
 * Extract YouTube video ID from various URL formats.
 * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
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
    // youtube.com/shorts/ID
    if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/shorts/')) {
      return u.pathname.split('/shorts/')[1]?.split('?')[0];
    }
  } catch { /* invalid URL */ }

  // Fallback regex for non-standard or raw copy-paste URLs
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&? ]{11})/i);
  return match ? match[1] : null;
}

/**
 * Get YouTube embed URL.
 * @param {string} url
 * @returns {string|null} Embed URL or null
 */
export function getYoutubeEmbedUrl(url) {
  const id = extractYoutubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
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
 * Strip media tags (#audio or #video) from a URL.
 * @param {string} url
 * @returns {string} Clean URL
 */
export function stripMediaTag(url) {
  if (!url) return '';
  return url.split('#')[0];
}

/**
 * Check if a URL points to an audio file based on extension or hash tag.
 * @param {string} url
 * @returns {boolean}
 */
export function isAudioUrl(url) {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('#audio') || lowerUrl.includes('#podcast') || lowerUrl.includes('type=audio')) {
    return true;
  }

  try {
    const u = new URL(url);
    const pathname = u.pathname.toLowerCase();
    const hasAudioExt = /\.(mp3|m4a|ogg|wav|aac|flac|webm)$/.test(pathname);
    if (hasAudioExt) return true;

    // Check query params
    const typeParam = u.searchParams.get('type');
    if (typeParam === 'audio') return true;
    const mimeParam = u.searchParams.get('mime');
    if (mimeParam && mimeParam.startsWith('audio/')) return true;
  } catch {
    return /\.(mp3|m4a|ogg|wav|aac|flac|webm)(\?|$)/i.test(url);
  }
  return false;
}

/**
 * Check if a URL points to a video file based on extension or hash tag.
 * @param {string} url
 * @returns {boolean}
 */
export function isVideoUrl(url) {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('#video') || lowerUrl.includes('type=video')) {
    return true;
  }

  try {
    const u = new URL(url);
    const pathname = u.pathname.toLowerCase();
    const hasVideoExt = /\.(mp4|webm|ogg|ogv|mov|mkv)$/.test(pathname);
    if (hasVideoExt) return true;

    // Check query params
    const typeParam = u.searchParams.get('type');
    if (typeParam === 'video') return true;
    const mimeParam = u.searchParams.get('mime');
    if (mimeParam && mimeParam.startsWith('video/')) return true;
  } catch {
    return /\.(mp4|webm|ogg|ogv|mov|mkv)(\?|$)/i.test(url);
  }
  return false;
}

/**
 * Extract Google Drive File ID from any Drive URL format.
 * Supports: /file/d/ID/view, /open?id=ID, /uc?id=ID, /file/d/ID/preview, and googleusercontent.com download URLs
 * @param {string} url
 * @returns {string|null} File ID or null
 */
export function extractDriveFileId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('googleusercontent.com')) {
      return u.searchParams.get('id') || null;
    }
    if (!u.hostname.includes('drive.google.com')) return null;

    // Format 1: /file/d/ID/view or /file/d/ID/preview
    const pathParts = u.pathname.split('/');
    if (pathParts.includes('d') && pathParts.length > pathParts.indexOf('d') + 1) {
      return pathParts[pathParts.indexOf('d') + 1] || null;
    }
    
    // Format 2: /open?id=ID or /uc?id=ID
    return u.searchParams.get('id') || null;
  } catch { /* invalid URL */ }
  return null;
}

/**
 * Extract Google Drive File ID and return Direct Stream/View Link.
 * Returns drive.google.com/uc?id=ID format which resolves auth session correctly
 * @param {string} url
 * @returns {string|null} Direct URL or null
 */
export function extractDriveDirectUrl(url) {
  const id = extractDriveFileId(url);
  return id ? `https://drive.google.com/uc?id=${id}` : null;
}

/**
 * Get proxied stream URL for Google Drive files.
 * Routes through /api/stream to bypass CORS, enabling custom HTML5 players.
 * @param {string} url - Google Drive URL
 * @returns {string|null} Proxy stream URL or null
 */
export function getDriveStreamUrl(url) {
  const id = extractDriveFileId(url);
  return id ? `/api/stream?id=${id}` : null;
}

/**
 * Check if a URL points to Google Drive.
 * @param {string} url
 * @returns {boolean}
 */
export function isDriveUrl(url) {
  return extractDriveFileId(url) !== null;
}

/**
 * Get media type from URL.
 * @param {string} url
 * @returns {string} 'youtube' | 'drive' | 'audio' | 'video' | 'link'
 */
export function getMediaType(url) {
  if (!url) return 'link';
  if (isYoutubeUrl(url)) return 'youtube';
  if (isDriveUrl(url)) return 'drive';
  if (isAudioUrl(url)) return 'audio';
  if (isVideoUrl(url)) return 'video';
  return 'link';
}

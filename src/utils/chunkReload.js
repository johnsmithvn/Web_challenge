/**
 * Chunk cũ biến mất sau khi deploy bản mới.
 *
 * Tab đang mở giữ module graph của bản build cũ (`AccountsPage-Bo0yTYUE.js`).
 * Deploy xong, build mới đổi hash nên file cũ 404, và MỌI lazy import sau đó
 * chết với "Failed to fetch dynamically imported module".
 *
 * Không có cách sửa nào ở phía JS: `React.lazy` cache luôn promise bị reject nên
 * render lại là ném lại y hệt — đó là lý do nút "Thử lại" không cứu được lỗi này.
 * Chỉ tải lại trang mới lấy được `index.html` mới trỏ sang hash mới.
 *
 * Reload ĐÚNG MỘT LẦN. Reload xong vẫn lỗi nghĩa là nguyên nhân khác (mất mạng,
 * asset hỏng, CDN chết) — reload tiếp chỉ thành vòng lặp trắng màn hình.
 */

const KEY = 'lh_chunk_reload';
const COOLDOWN_MS = 15000;

/** Thông điệp khác nhau theo trình duyệt: Chrome/Firefox/Safari mỗi bên một kiểu. */
export const isStaleChunkError = (error) => /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|dynamically imported module/i
  .test(typeof error === 'string' ? error : error?.message || '');

/** @returns {boolean} true nếu đã kích hoạt reload; false nếu vừa reload xong rồi. */
export const reloadForStaleChunk = () => {
  let last = 0;
  // Storage có thể ném ở chế độ riêng tư — vỡ ở đây là vỡ ngay trong đường xử lý lỗi.
  try { last = Number(sessionStorage.getItem(KEY) || 0); } catch { /* không có storage thì cứ reload */ }
  if (Date.now() - last < COOLDOWN_MS) return false;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
  window.location.reload();
  return true;
};

/**
 * dateUtils — Vietnamese date formatting helpers.
 */

const LOCALE = 'vi-VN';

/**
 * yyyy-MM-dd theo giờ **địa phương**.
 *
 * KHÔNG dùng `new Date().toISOString().split('T')[0]` cho việc này: toISOString trả UTC,
 * nên ở GMT+7 khoảng 00:00–06:59 nó cho ra ngày *hôm qua*.
 *
 * @param {Date} [date] — mặc định là hôm nay
 * @returns {string} e.g. "2026-07-28"
 */
export function toDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Chuyển `Date.getDay()` (0=CN..6=T7) sang index tuần bắt đầu Thứ Hai (0=T2..6=CN). */
export function mondayIndex(date = new Date()) {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

/** Date object của Thứ Hai đầu tuần chứa `date` (giữ giờ/phút gốc). */
export function getWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - mondayIndex(d));
  return d;
}

/** 7 chuỗi ngày local (T2 → CN) của tuần chứa `date`. */
export function getWeekDates(date = new Date()) {
  const monday = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateStr(d);
  });
}

/**
 * Format ISO date to "dd/MM/yyyy"
 * @param {string} iso — ISO date string
 * @returns {string} e.g. "13/06/2026"
 */
export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * "25/07/2026" → "2026-07-25". Chấp nhận cả "5/7/2026".
 *
 * Trả `null` khi chuỗi không phải một ngày CÓ THẬT — `new Date(2026, 1, 31)` tự tràn
 * sang 03/03 chứ không báo lỗi, nên phải đối chiếu lại ba thành phần sau khi dựng.
 * @param {string} str
 * @returns {string|null} yyyy-MM-dd
 */
export function parseDmy(str) {
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(str ?? '').trim());
  if (!parts) return null;
  const day = Number(parts[1]), month = Number(parts[2]), year = Number(parts[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return toDateStr(date);
}

/**
 * Format ISO date to "dd/MM/yyyy, HH:mm"
 * @param {string} iso — ISO date string
 * @returns {string} e.g. "13/06/2026, 14:30"
 */
export function formatDateTime(iso) {
  if (!iso) return '—';
  // toLocaleString (not toLocaleDateString) — only the former reliably honors the
  // hour/minute options across engines; toLocaleDateString may drop the time.
  return new Date(iso).toLocaleString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * dateUtils — Vietnamese date formatting helpers.
 */

const LOCALE = 'vi-VN';

/**
 * yyyy-MM-dd theo giờ **địa phương**.
 *
 * KHÔNG dùng `new Date().toISOString().split('T')[0]` cho việc này: toISOString trả UTC,
 * nên ở GMT+7 khoảng 00:00–06:59 nó cho ra ngày *hôm qua*. Đây là hàm duy nhất trong repo
 * sinh chuỗi ngày local — trước v4.27.0 có 4 bản copy giống nhau ở TaskListSection,
 * useIntentions, IncubatorPage và DatePickerPopover.
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

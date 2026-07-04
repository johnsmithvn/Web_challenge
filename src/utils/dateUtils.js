/**
 * dateUtils — Centralized Vietnamese date formatting helpers.
 *
 * Replaces 20+ scattered `new Date(x).toLocaleDateString('vi-VN', ...)` calls
 * across pages with consistent, reusable functions.
 */

const LOCALE = 'vi-VN';

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

/**
 * Format ISO date to "thứ X, ngày DD tháng MM"
 * @param {string|Date} dateOrIso — Date or ISO string
 * @returns {string} e.g. "thứ sáu, 13 tháng 6"
 */
export function formatWeekdayDate(dateOrIso) {
  const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso || Date.now());
  return d.toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Format to month + year label
 * @param {string|Date} dateOrIso
 * @returns {string} e.g. "tháng 6, 2026"
 */
export function formatMonthYear(dateOrIso) {
  const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso || Date.now());
  return d.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
}

/**
 * Format to month name only
 * @param {string|Date} dateOrIso
 * @returns {string} e.g. "tháng 6"
 */
export function formatMonth(dateOrIso) {
  const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso || Date.now());
  return d.toLocaleDateString(LOCALE, { month: 'long' });
}

/**
 * Format to narrow weekday
 * @param {Date} date
 * @returns {string} e.g. "T6"
 */
export function formatWeekdayNarrow(date) {
  return date.toLocaleDateString(LOCALE, { weekday: 'narrow' });
}

/**
 * Format to short date "dd/MM" (no year)
 * @param {string|Date} dateOrIso
 * @returns {string} e.g. "13/06"
 */
export function formatDateShort(dateOrIso) {
  const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso || Date.now());
  return d.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' });
}

/**
 * Format to short weekday + short month "T6, 13 Th6"
 * @param {string|Date} dateOrIso — Date or ISO or yyyy-MM-dd string
 * @returns {string} e.g. "T6, 13 Th6"
 */
export function formatWeekdayShort(dateOrIso) {
  const d = typeof dateOrIso === 'string' && dateOrIso.length === 10
    ? new Date(dateOrIso + 'T00:00:00')  // Avoid timezone shift on date-only strings
    : dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso || Date.now());
  return d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Create a Date from yyyy-MM-dd string without timezone shift.
 * Useful for date-only strings like "2026-06-13" that should stay local.
 * @param {string} dateStr — yyyy-MM-dd
 * @returns {Date}
 */
export function parseDateLocal(dateStr) {
  return new Date(dateStr + 'T00:00:00');
}

/**
 * Format date-only string (yyyy-MM-dd) to short "13 Th6"
 * @param {string} dateStr — yyyy-MM-dd
 * @returns {string} e.g. "13 Th6"
 */
export function formatDayMonth(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
  });
}

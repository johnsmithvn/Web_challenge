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
  return new Date(iso).toLocaleDateString(LOCALE, {
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

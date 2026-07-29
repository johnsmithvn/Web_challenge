/**
 * logger.js — Structured logging utility.
 *
 * Production: only `error()` outputs to console.
 * Development: all levels output.
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.error('[useUserTasks] fetch failed:', err);
 *   logger.warn('[useTags] linkTag: unknown entityType');
 *   logger.info('[useSubscriptions] auto-advanced 3 subs');
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /** Always fires — real errors that need attention even in production. */
  error: (...args) => console.error(...args),

  /** Dev-only — operational warnings (fallbacks triggered, deprecations). */
  warn:  (...args) => { if (isDev) console.warn(...args); },

  /** Dev-only — informational logs (migrations, auto-advances, state changes). */
  info:  (...args) => { if (isDev) console.log(...args); },
};

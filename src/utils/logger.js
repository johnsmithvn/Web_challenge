/**
 * logger.js — Structured logging utility.
 *
 * Production: only `error()` outputs to console.
 * Development: all levels output.
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.error('[useUserTasks] fetch failed:', err);
 *   logger.info('[useSubscriptions] auto-advanced 3 subs');
 *   logger.warn('[useTags] linkTag: unknown entityType');
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /** Always fires — real errors that need attention even in production. */
  error: (...args) => console.error(...args),

  /** Dev-only — operational warnings (fallbacks triggered, deprecations). */
  warn:  (...args) => { if (isDev) console.warn(...args); },

  /** Dev-only — informational logs (migrations, auto-advances, state changes). */
  info:  (...args) => { if (isDev) console.log(...args); },

  /** Dev-only — verbose debug output with prefix. */
  debug: (...args) => { if (isDev) console.log('[DEBUG]', ...args); },
};

/**
 * Minimal structured logger.
 *
 * - `debug` output is suppressed outside development so we never leak
 *   internal details (tokens, payloads, SQL) into production logs.
 * - `info` / `warn` / `error` always emit.
 *
 * Swap the internals for pino/winston later without touching call sites.
 */
import { env } from './env.js';

const isDev = env.NODE_ENV === 'development';

function stamp(level: string): string {
  // ISO timestamp keeps logs greppable and ordered in aggregators.
  return `[${new Date().toISOString()}] ${level}`;
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(stamp('DEBUG'), ...args);
  },
  info: (...args: unknown[]) => {
    console.info(stamp('INFO'), ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(stamp('WARN'), ...args);
  },
  error: (...args: unknown[]) => {
    console.error(stamp('ERROR'), ...args);
  },
};

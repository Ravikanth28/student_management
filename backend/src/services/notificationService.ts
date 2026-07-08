/**
 * High-level push helpers. Everything here is fire-and-forget and never throws
 * — a failed push must never break the request that triggered it.
 */
import { fcmEnabled, sendPush, type PushMessage } from '../config/fcm.js';
import * as deviceRepo from '../repositories/deviceRepository.js';
import { logger } from '../config/logger.js';

/** Push to every registered device (optionally skipping the acting user's own). */
export async function notifyAll(msg: PushMessage, exceptUsername?: string | null): Promise<void> {
  if (!fcmEnabled()) return;
  try {
    const tokens = await deviceRepo.listTokens(exceptUsername ?? undefined);
    if (tokens.length === 0) return;
    const invalid = await sendPush(tokens, msg);
    if (invalid.length) await deviceRepo.deleteTokens(invalid);
  } catch (err) {
    logger.error('[notify] failed:', err);
  }
}

/** Fire-and-forget wrapper for use inside request handlers. */
export function notifyAllInBackground(msg: PushMessage, exceptUsername?: string | null): void {
  void notifyAll(msg, exceptUsername);
}

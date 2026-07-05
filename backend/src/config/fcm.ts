/**
 * Firebase Cloud Messaging (push notifications) setup.
 *
 * Initialised from the FCM_SERVICE_ACCOUNT env var (the full service-account
 * JSON as a string). If it isn't set, push is silently disabled so the rest of
 * the app keeps working — nothing here ever throws at import time.
 */
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { env } from './env.js';
import { logger } from './logger.js';

let messaging: Messaging | null = null;

try {
  if (env.FCM_SERVICE_ACCOUNT) {
    const creds = JSON.parse(env.FCM_SERVICE_ACCOUNT) as ServiceAccount;
    const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(creds) });
    messaging = getMessaging(app);
    logger.info('Firebase Cloud Messaging initialised.');
  } else {
    logger.warn('FCM_SERVICE_ACCOUNT not set — push notifications are disabled.');
  }
} catch (err) {
  logger.error('Failed to initialise FCM (push disabled):', err);
  messaging = null;
}

export const fcmEnabled = (): boolean => messaging !== null;

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push to many device tokens. Returns the list of tokens that are no
 * longer valid (unregistered / invalid) so the caller can delete them.
 */
export async function sendPush(tokens: string[], msg: PushMessage): Promise<string[]> {
  if (!messaging || tokens.length === 0) return [];

  const invalid: string[] = [];
  // FCM allows up to 500 tokens per multicast call.
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: msg.title, body: msg.body },
        data: msg.data ?? {},
        android: { priority: 'high', notification: { sound: 'default' } },
      });
      res.responses.forEach((r: { success: boolean; error?: { code?: string } }, idx: number) => {
        if (!r.success) {
          const code = r.error?.code ?? '';
          if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
            invalid.push(batch[idx]);
          }
        }
      });
    } catch (err) {
      logger.error('[FCM] send error:', err);
    }
  }
  return invalid;
}

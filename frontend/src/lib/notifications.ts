/**
 * Local (on-device) notifications for the installed Android app. These work
 * even when the app is closed because Android schedules them via AlarmManager.
 * On the web everything here is a no-op (guarded by isNativeApp()).
 *
 * The @capacitor/local-notifications plugin is imported lazily so it is never
 * pulled into the plain web path.
 */
import { isNativeApp } from './platform';

async function plugin() {
  const mod = await import('@capacitor/local-notifications');
  return mod.LocalNotifications;
}

/** Stable positive 31-bit integer id from a string seed (notification ids must be ints). */
export function idFrom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

/** Ask for notification permission (once). Returns true if granted. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const LN = await plugin();
    let perm = await LN.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
      perm = await LN.requestPermissions();
    }
    return perm.display === 'granted';
  } catch {
    return false;
  }
}

/** Show a notification right away. */
export async function notifyNow(title: string, body: string, seed?: string): Promise<void> {
  if (!(await ensureNotificationPermission())) return;
  try {
    const LN = await plugin();
    await LN.schedule({
      notifications: [{
        id: idFrom(seed ?? title + body),
        title,
        body,
        schedule: { at: new Date(Date.now() + 1500) },
      }],
    });
  } catch {
    /* ignore */
  }
}

/**
 * Schedule a notification for a future moment. Re-scheduling with the same
 * `seed` overwrites the previous one (so calling this repeatedly is safe).
 * No-op if `at` is in the past.
 */
export async function scheduleAt(seed: string, title: string, body: string, at: Date): Promise<void> {
  if (at.getTime() <= Date.now()) return;
  if (!(await ensureNotificationPermission())) return;
  try {
    const LN = await plugin();
    await LN.schedule({
      notifications: [{ id: idFrom(seed), title, body, schedule: { at } }],
    });
  } catch {
    /* ignore */
  }
}

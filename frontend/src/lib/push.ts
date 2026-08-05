/**
 * FCM push registration for the installed Android app. Registers the device,
 * gets its FCM token, and sends it to the backend so the server can push to it
 * (birthdays, late/achievement/placement, updates) even when the app is closed.
 *
 * No-op on the web. The plugin is imported lazily so it never loads in a browser.
 */
import { api } from '../api';
import { isNativeApp } from './platform';

let registered = false;

export async function registerPush(): Promise<void> {
  if (!isNativeApp() || registered) return;
  registered = true;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // checkPermissions itself can throw if Firebase isn't configured — catch it
    let perm;
    try {
      perm = await PushNotifications.checkPermissions();
    } catch {
      registered = false;
      return; // Firebase not set up — silently skip, do NOT crash
    }

    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      try {
        perm = await PushNotifications.requestPermissions();
      } catch {
        registered = false;
        return;
      }
    }
    if (perm.receive !== 'granted') { registered = false; return; }

    try {
      await PushNotifications.addListener('registration', (token: any) => {
        void api.post('/devices/register', { token: token.value, platform: 'android' }).catch(() => {});
      });
      await PushNotifications.addListener('registrationError', () => { registered = false; });
      await PushNotifications.register();
    } catch {
      registered = false; // Firebase not configured or registration failed — silent, no crash
    }
  } catch {
    registered = false;
  }
}

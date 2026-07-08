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

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') { registered = false; return; }

    // Send the token to the backend once we get it.
    await PushNotifications.addListener('registration', (token: any) => {
      void api.post('/devices/register', { token: token.value, platform: 'android' }).catch(() => {});
    });
    await PushNotifications.addListener('registrationError', () => { registered = false; });

    await PushNotifications.register();
  } catch {
    registered = false;
  }
}

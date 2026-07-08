import { useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../state/auth';
import { isNativeApp } from '../lib/platform';
import { notifyNow, scheduleAt } from '../lib/notifications';
import { registerPush } from '../lib/push';
import { getNativeAppVersion } from '../lib/platform';
import { APP_VERSION } from '../config';

type Bday = { id: number; name: string; section: string; department: string; next?: string };

/** YYYY-MM-DD in IST — matches how the backend decides "today". */
const todayKeyIST = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Runs inside the installed app: fires a notification for today's birthdays,
 * schedules upcoming birthdays ahead of time (so they alert even when the app
 * is closed), and flags a new app version. Renders nothing. No-op on the web.
 */
export function NotificationsManager() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !isNativeApp()) return;
    let cancelled = false;

    const run = async () => {
      // 0) Register this device for server push (birthdays, late/achievement/etc.)
      void registerPush();

      // 1) Today's birthdays — notify immediately, once per day.
      try {
        const res = await api.get<{ data: Bday[] }>('/students/birthdays');
        const list = res.data.data;
        const key = `notif-bday-${todayKeyIST()}`;
        if (list.length && !localStorage.getItem(key)) {
          const names = list.map((s) => s.name).join(', ');
          await notifyNow(
            '🎂 Birthday today',
            list.length === 1 ? `${names} has a birthday today. Wish them!` : `${list.length} students have birthdays today: ${names}`,
            `bday-today-${todayKeyIST()}`,
          );
          localStorage.setItem(key, '1');
        }
      } catch { /* ignore */ }

      // 2) Upcoming birthdays — schedule at 8 AM on the day so they fire even
      //    if the app is closed. Same seed per student ⇒ idempotent re-scheduling.
      try {
        const res = await api.get<{ data: Bday[] }>('/students/birthdays/upcoming', { params: { days: 60 } });
        for (const s of res.data.data) {
          if (cancelled || !s.next) continue;
          const [y, m, d] = s.next.split('-').map(Number);
          const at = new Date(y, m - 1, d, 8, 0, 0); // 8 AM device-local time
          await scheduleAt(
            `bday-${s.id}`,
            '🎂 Birthday today',
            `${s.name} (${s.department} · Sec ${s.section}) has a birthday today. Wish them!`,
            at,
          );
        }
      } catch { /* ignore */ }

      // 3) App update available — notify once per new version.
      try {
        const v = await getNativeAppVersion();
        if (v && v !== APP_VERSION) {
          const key = `notif-update-${APP_VERSION}`;
          if (!localStorage.getItem(key)) {
            await notifyNow('⬆️ App update available', `A newer version (v${APP_VERSION}) is available. Please update the app.`, key);
            localStorage.setItem(key, '1');
          }
        }
      } catch { /* ignore */ }
    };

    void run();

    // Re-check whenever the app is brought back to the foreground.
    let remove: (() => void) | undefined;
    void (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('resume', () => { if (!cancelled) void run(); });
        remove = () => { void handle.remove(); };
      } catch { /* ignore */ }
    })();

    return () => { cancelled = true; remove?.(); };
  }, [isAuthenticated]);

  return null;
}

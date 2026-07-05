/**
 * In-process daily birthday push. Fires once per day at/after 08:00 IST to all
 * registered devices, so birthdays reach everyone even if they never open the
 * app. A marker row in audit_logs makes it idempotent across restarts.
 *
 * The Render service is kept awake by the keep-awake cron, so this interval
 * keeps running.
 */
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';
import { logger } from '../config/logger.js';
import { fcmEnabled } from '../config/fcm.js';
import { notifyAll } from './notificationService.js';
import * as studentService from './studentService.js';

const MARK_ACTION = 'notify.birthday';

async function alreadySentToday(dateIST: string): Promise<boolean> {
  const [rows] = await pool.query<Array<{ c: number } & RowDataPacket>>(
    'SELECT COUNT(*) AS c FROM audit_logs WHERE action = ? AND details LIKE ?',
    [MARK_ACTION, `${dateIST}%`],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function markSent(dateIST: string, note: string): Promise<void> {
  await pool.query(
    'INSERT INTO audit_logs (action, entity, entity_id, actor, status, details) VALUES (?, ?, ?, ?, ?, ?)',
    [MARK_ACTION, 'system', null, 'system', 'success', dateIST + (note ? ` — ${note}` : '')],
  );
}

async function tick(): Promise<void> {
  try {
    if (!fcmEnabled()) return;
    const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    if (ist.getUTCHours() < 8) return; // wait until 8 AM IST
    const dateIST = ist.toISOString().slice(0, 10);
    if (await alreadySentToday(dateIST)) return;

    const bdays = await studentService.getTodaysBirthdays();
    // Mark before sending so a mid-send restart can't double-notify.
    await markSent(dateIST, `${bdays.length} birthday(s)`);
    if (bdays.length === 0) return;

    const names = bdays.map((s) => s.name).join(', ');
    await notifyAll({
      title: '🎂 Birthday today',
      body: bdays.length === 1
        ? `${names} has a birthday today. Wish them!`
        : `${bdays.length} students have birthdays today: ${names}`,
      data: { type: 'birthday' },
    });
    logger.info(`[birthday] pushed for ${bdays.length} student(s) on ${dateIST}`);
  } catch (err) {
    logger.error('[birthday scheduler] tick failed:', err);
  }
}

export function startBirthdayScheduler(): void {
  void tick();
  setInterval(() => void tick(), 10 * 60 * 1000).unref();
}

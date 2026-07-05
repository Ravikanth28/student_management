import * as repo from '../repositories/settingsRepository.js';
import { logger } from '../config/logger.js';

export type PeriodSchedule = {
  morning: string;
  morning_break: string;
  lunch: string;
  evening_break: string;
};

/** Fallback timings if none have been saved yet (the college's real defaults). */
export const DEFAULT_PERIOD_SCHEDULE: PeriodSchedule = {
  morning: '09:00',
  morning_break: '10:55',
  lunch: '13:15',
  evening_break: '15:10',
};

const KEY = 'period_schedule';
const HHMM = /^\d{2}:\d{2}$/;

/** Read the saved schedule (merged over defaults). Never throws. */
export async function getPeriodSchedule(): Promise<PeriodSchedule> {
  try {
    const raw = await repo.getSetting(KEY);
    if (!raw) return { ...DEFAULT_PERIOD_SCHEDULE };
    const saved = JSON.parse(raw) as Partial<PeriodSchedule>;
    return { ...DEFAULT_PERIOD_SCHEDULE, ...saved };
  } catch (err) {
    logger.error('[settings] getPeriodSchedule failed, using defaults:', err);
    return { ...DEFAULT_PERIOD_SCHEDULE };
  }
}

/** Validate + persist the schedule. Returns the stored value. */
export async function setPeriodSchedule(input: Partial<PeriodSchedule>): Promise<PeriodSchedule> {
  const merged = { ...DEFAULT_PERIOD_SCHEDULE, ...input };
  for (const [k, v] of Object.entries(merged)) {
    if (!HHMM.test(v)) throw new Error(`Invalid time for ${k}: "${v}" (expected HH:MM)`);
  }
  await repo.setSetting(KEY, JSON.stringify(merged));
  return merged;
}

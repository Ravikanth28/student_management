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

const KEY_DEFAULT = 'period_schedule';
const KEY_YEAR1 = 'period_schedule_year1';
const HHMM = /^\d{2}:\d{2}$/;

/** Read the saved schedule for a specific year (merged over defaults). Never throws. */
export async function getPeriodSchedule(year?: string | null): Promise<PeriodSchedule> {
  try {
    const isYear1 = year === '1' || year === 'I' || year === '1st';
    const key = isYear1 ? KEY_YEAR1 : KEY_DEFAULT;
    const raw = await repo.getSetting(key);
    if (!raw) {
      if (isYear1) {
        // Fall back to default schedule if Year 1 hasn't set distinct timings yet
        const defaultRaw = await repo.getSetting(KEY_DEFAULT);
        if (defaultRaw) return { ...DEFAULT_PERIOD_SCHEDULE, ...(JSON.parse(defaultRaw) as Partial<PeriodSchedule>) };
      }
      return { ...DEFAULT_PERIOD_SCHEDULE };
    }
    const saved = JSON.parse(raw) as Partial<PeriodSchedule>;
    return { ...DEFAULT_PERIOD_SCHEDULE, ...saved };
  } catch (err) {
    logger.error('[settings] getPeriodSchedule failed, using defaults:', err);
    return { ...DEFAULT_PERIOD_SCHEDULE };
  }
}

/** Get both 2nd-4th year and 1st year period schedules. */
export async function getAllPeriodSchedules(): Promise<{ default: PeriodSchedule; year1: PeriodSchedule }> {
  const defaultSched = await getPeriodSchedule('2');
  const year1Sched = await getPeriodSchedule('1');
  return { default: defaultSched, year1: year1Sched };
}

/** Validate + persist schedules. Returns the stored values. */
export async function setAllPeriodSchedules(input: {
  default?: Partial<PeriodSchedule>;
  year1?: Partial<PeriodSchedule>;
  morning?: string;
  morning_break?: string;
  lunch?: string;
  evening_break?: string;
}): Promise<{ default: PeriodSchedule; year1: PeriodSchedule }> {
  let defaultInput: Partial<PeriodSchedule> = input.default ?? {};
  let year1Input: Partial<PeriodSchedule> = input.year1 ?? {};

  // If flat object sent (legacy payload), update default and year1
  if (!input.default && !input.year1) {
    defaultInput = { ...input };
    year1Input = { ...input };
  }

  const mergedDefault = { ...DEFAULT_PERIOD_SCHEDULE, ...defaultInput };
  for (const [k, v] of Object.entries(mergedDefault)) {
    if (!HHMM.test(v)) throw new Error(`Invalid time for 2nd-4th year ${k}: "${v}" (expected HH:MM)`);
  }

  const mergedYear1 = { ...DEFAULT_PERIOD_SCHEDULE, ...year1Input };
  for (const [k, v] of Object.entries(mergedYear1)) {
    if (!HHMM.test(v)) throw new Error(`Invalid time for 1st year ${k}: "${v}" (expected HH:MM)`);
  }

  await repo.setSetting(KEY_DEFAULT, JSON.stringify(mergedDefault));
  await repo.setSetting(KEY_YEAR1, JSON.stringify(mergedYear1));

  return { default: mergedDefault, year1: mergedYear1 };
}

// ─── System Settings ────────────────────────────────────────────────────────

export type SessionTiming = { start: string; end: string };

export type SystemSettings = {
  attendance_full_time: boolean;
  session_timings: {
    fn: SessionTiming;
    fn_break: SessionTiming;
    an: SessionTiming;
    an_break: SessionTiming;
  };
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  attendance_full_time: false,
  session_timings: {
    fn: { start: '08:00', end: '09:15' },
    fn_break: { start: '10:40', end: '11:00' },
    an: { start: '12:35', end: '13:20' },
    an_break: { start: '14:55', end: '15:15' },
  }
};

const KEY_SYSTEM = 'system_settings';

export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const raw = await repo.getSetting(KEY_SYSTEM);
    if (!raw) return { ...DEFAULT_SYSTEM_SETTINGS };
    const saved = JSON.parse(raw) as Partial<SystemSettings>;
    
    // Ensure nested objects exist to avoid undefined errors if old DB state
    const merged = { ...DEFAULT_SYSTEM_SETTINGS, ...saved };
    merged.session_timings = { ...DEFAULT_SYSTEM_SETTINGS.session_timings, ...saved.session_timings };
    
    return merged;
  } catch (err) {
    logger.error('[settings] getSystemSettings failed, using defaults:', err);
    return { ...DEFAULT_SYSTEM_SETTINGS };
  }
}

export async function setSystemSettings(input: Partial<SystemSettings>): Promise<SystemSettings> {
  const current = await getSystemSettings();
  const merged = { ...current, ...input };
  if (input.session_timings) {
    merged.session_timings = { ...current.session_timings, ...input.session_timings };
  }
  await repo.setSetting(KEY_SYSTEM, JSON.stringify(merged));
  return merged;
}

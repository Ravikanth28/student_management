/**
 * Scheduled ("on-time") start time for each period, 24h HH:MM.
 * Minutes-late is computed as arrival − scheduled (never negative).
 *
 * ⚠️ Adjust these to your college's actual timings.
 */
export const PERIOD_SCHEDULE: Record<string, string> = {
  morning: '08:45',
  morning_break: '10:45',
  lunch: '13:00',
  evening_break: '15:00',
};

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function computeMinutesLate(scheduled: string, arrival: string): number {
  return Math.max(0, toMinutes(arrival) - toMinutes(scheduled));
}

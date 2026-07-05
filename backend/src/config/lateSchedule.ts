/**
 * Scheduled ("on-time") start time for each period, 24h HH:MM.
 * Minutes-late is computed as arrival − scheduled (never negative).
 *
 * ⚠️ Adjust these to your college's actual timings.
 */
// For breaks, the "on-time" cutoff is when the break ENDS (student must be back).
export const PERIOD_SCHEDULE: Record<string, string> = {
  morning: '09:00',       // class starts 9:00 AM
  morning_break: '10:55', // break 10:45–10:55
  lunch: '13:15',         // lunch 12:35–1:15
  evening_break: '15:10', // break 2:55–3:10
};

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function computeMinutesLate(scheduled: string, arrival: string): number {
  return Math.max(0, toMinutes(arrival) - toMinutes(scheduled));
}

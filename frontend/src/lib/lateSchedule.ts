// Mirrors backend/src/config/lateSchedule.ts — used only for the live preview
// while marking a student late. The backend recomputes and stores the values.
export const PERIOD_SCHEDULE: Record<string, string> = {
  morning: '09:00',       // class starts 9:00 AM
  morning_break: '10:55', // break 10:45–10:55
  lunch: '13:15',         // lunch 12:35–1:15
  evening_break: '15:10', // break 2:55–3:10
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesLate(scheduled: string, arrival: string): number {
  return Math.max(0, toMinutes(arrival) - toMinutes(scheduled));
}

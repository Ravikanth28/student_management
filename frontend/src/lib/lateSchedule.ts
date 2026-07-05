// Mirrors backend/src/config/lateSchedule.ts — used only for the live preview
// while marking a student late. The backend recomputes and stores the values.
export const PERIOD_SCHEDULE: Record<string, string> = {
  morning: '08:45',
  morning_break: '10:45',
  lunch: '13:00',
  evening_break: '15:00',
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesLate(scheduled: string, arrival: string): number {
  return Math.max(0, toMinutes(arrival) - toMinutes(scheduled));
}

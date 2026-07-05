import { z } from 'zod';

const optionalText = (max: number) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), z.string().trim().max(max).optional());

export const lateCreateSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  period: z.enum(['morning', 'morning_break', 'lunch', 'evening_break']),
  time: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:MM').optional()
  ),
});

export const achievementCreateSchema = z.object({
  event_type: z.enum(['hackathon', 'presentation', 'symposium', 'other']).default('other'),
  title: z.string().trim().min(2).max(200),
  venue: optionalText(200),
  duration: optionalText(120),
  result: z.enum(['participated', 'winner']).default('participated'),
  position: optionalText(60),
  prize: optionalText(200),
  event_date: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'event_date must be YYYY-MM-DD').optional()
  ),
  member_ids: z.array(z.coerce.number().int().positive()).min(1, 'At least one student is required'),
});

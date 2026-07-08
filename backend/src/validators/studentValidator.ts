import { z } from 'zod';

const optionalText = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).max(40).optional()
);

const optionalEmail = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().email().optional()
);

const optionalPhotoUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().url().optional()
);

const optionalBloodGroup = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().trim().max(8).optional()
);

const optionalDob = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dob must be YYYY-MM-DD').optional()
);

const optionalYear = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().trim().max(16).optional()
);

export const studentCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  register_number: z.string().trim().min(2).max(40),
  enrollment_number: z.string().trim().min(2).max(40),
  section: z.string().trim().min(1).max(40),
  year: optionalYear,
  department: z.string().trim().min(2).max(120),
  batch: z.string().trim().min(2).max(40),
  phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Phone number must contain 10 to 15 digits'),
  parent_phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Phone number must contain 10 to 15 digits'),
  address: z.string().trim().min(5).max(255),
  college_email: optionalEmail,
  personal_email: optionalEmail,
  photo_url: optionalPhotoUrl,
  blood_group: optionalBloodGroup,
  dob: optionalDob
});

export const studentUpdateSchema = studentCreateSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided'
});

export const studentSearchSchema = z.object({
  q: z.string().trim().min(1).max(120)
});

export const studentListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  batch: z.string().trim().max(40).optional(),
  section: z.string().trim().max(40).optional(),
  year: z.string().trim().max(16).optional(),
  page: z.preprocess((value) => Number(value ?? 1), z.number().int().min(1)).default(1),
  limit: z.preprocess((value) => Number(value ?? 10), z.number().int().min(1).max(100)).default(10)
});

import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

export const userCreateSchema = z.object({
  username: z.string().trim().min(3).max(120).regex(/^[A-Za-z0-9_.@-]+$/, 'Username may contain letters, numbers, and . _ - @'),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(200),
  role: z.enum(['superadmin', 'admin', 'user', 'cr']),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(['superadmin', 'admin', 'user', 'cr']).optional(),
  // Empty string → leave password unchanged.
  password: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().min(8).max(200).optional()),
}).refine((v) => v.name !== undefined || v.role !== undefined || v.password !== undefined, {
  message: 'Nothing to update',
});

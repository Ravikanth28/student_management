import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT:               z.coerce.number().default(4000),
  NODE_ENV:           z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN:        z.string().default('http://localhost:5173'),
  JWT_SECRET:         z.string().min(32),
  JWT_EXPIRES_IN:     z.string().default('8h'),
  DB_HOST:            z.string().optional(),
  DB_PORT:            z.coerce.number().default(3306),
  DB_USER:            z.string().optional(),
  DB_PASSWORD:        z.string().default(''),
  DB_NAME:            z.string().optional(),
  ADMIN_USERNAME:     z.string().min(1),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  ADMIN_PASSWORD:     z.string().min(1).optional(),
  TIDB_URL:           z.string().min(1).optional(),
  // Cloudinary
  CLOUDINARY_URL:        z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY:    z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  // Google Drive photo import
  GOOGLE_API_KEY:        z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast with a readable message instead of a cryptic runtime crash later.
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// ─── Production hardening: refuse to boot with insecure config ───
if (env.NODE_ENV === 'production') {
  const problems: string[] = [];

  // A DB connection must be configured one way or another.
  if (!env.TIDB_URL && !(env.DB_HOST && env.DB_USER && env.DB_NAME)) {
    problems.push('Set TIDB_URL, or DB_HOST + DB_USER + DB_NAME.');
  }

  // Passwords must be hashed in production — never a plaintext ADMIN_PASSWORD.
  if (!env.ADMIN_PASSWORD_HASH) {
    problems.push('ADMIN_PASSWORD_HASH is required in production (bcrypt hash). Do not use ADMIN_PASSWORD.');
  }
  if (env.ADMIN_PASSWORD) {
    problems.push('ADMIN_PASSWORD (plaintext) must not be set in production. Use ADMIN_PASSWORD_HASH.');
  }

  if (problems.length > 0) {
    console.error('❌ Refusing to start in production with insecure configuration:');
    for (const p of problems) console.error(`   • ${p}`);
    process.exit(1);
  }
}

/** True when Cloudinary credentials are fully configured */
export const cloudinaryEnabled =
  Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

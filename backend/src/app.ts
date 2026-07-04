import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRoutes } from './routes/authRoutes.js';
import { studentRoutes } from './routes/studentRoutes.js';
import { systemRoutes } from './routes/systemRoutes.js';
import { mediaRoutes } from './routes/mediaRoutes.js';
import { lateRoutes } from './routes/lateRoutes.js';
import { achievementRoutes } from './routes/achievementRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export const app = express();

// Behind a reverse proxy (Nginx / Render / Railway / Fly) so rate-limit and
// req.ip see the real client address from X-Forwarded-For.
app.set('trust proxy', 1);

app.use(helmet());

// Explicit allow-list only — never fall back to a wildcard while sending credentials.
// Bare hostnames (e.g. from a Render fromService reference) are upgraded to https://,
// and the native-app (Capacitor) WebView origins are always allowed so the APK works.
const configuredOrigins = env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean)
  .map((o) => (/^[a-z]+:\/\//i.test(o) ? o : `https://${o}`));
const nativeAppOrigins = ['https://localhost', 'capacitor://localhost'];
const allowedOrigins = [...new Set([...configuredOrigins, ...nativeAppOrigins])];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// Global limiter for the whole API.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

// Stricter limiter for auth to slow credential brute-forcing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'student-management-api' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/late-records', lateRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/users', userRoutes);

// ── Single-service deployment: serve the built frontend ──
// In production the web app is built into backend/dist/public. When that folder
// exists, serve it and fall back to index.html for client-side routes (anything
// that isn't /api/*). In development the folder is absent, so the web dev server
// and API run independently and this block is skipped.
const clientDir = fileURLToPath(new URL('./public', import.meta.url));
if (existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(join(clientDir, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

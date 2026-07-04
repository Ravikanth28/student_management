import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRoutes } from './routes/authRoutes.js';
import { studentRoutes } from './routes/studentRoutes.js';
import { systemRoutes } from './routes/systemRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export const app = express();

// Behind a reverse proxy (Nginx / Render / Railway / Fly) so rate-limit and
// req.ip see the real client address from X-Forwarded-For.
app.set('trust proxy', 1);

app.use(helmet());

// Explicit allow-list only — never fall back to a wildcard while sending credentials.
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
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

app.use(notFoundHandler);
app.use(errorHandler);

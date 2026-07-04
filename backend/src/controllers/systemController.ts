import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { pool } from '../config/db.js';
import { env, cloudinaryEnabled } from '../config/env.js';
import * as audit from '../services/auditService.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

const APP_VERSION = process.env.npm_package_version ?? '1.0.0';

// ─── GET /api/system/status ───────────────────────────────────
export const getSystemStatus = asyncWrap(async (_req, res) => {
  // Live DB connectivity probe + record counts.
  let dbConnected = false;
  let totalStudents = 0;
  let totalDepartments = 0;
  let totalBatches = 0;
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT
         (SELECT COUNT(*) FROM students) AS total,
         (SELECT COUNT(DISTINCT department) FROM students) AS depts,
         (SELECT COUNT(DISTINCT batch) FROM students) AS batches`
    );
    dbConnected = true;
    totalStudents = Number(rows[0]?.total ?? 0);
    totalDepartments = Number(rows[0]?.depts ?? 0);
    totalBatches = Number(rows[0]?.batches ?? 0);
  } catch {
    dbConnected = false;
  }

  return res.json({
    service: 'student-management-api',
    version: APP_VERSION,
    environment: env.NODE_ENV,
    serverTime: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    backend: 'Node.js + Express',
    frontend: 'React + Vite',
    database: {
      driver: 'TiDB Cloud (MySQL)',
      connected: dbConnected,
    },
    auth: {
      method: 'JWT + bcrypt',
      jwtExpiresIn: env.JWT_EXPIRES_IN,
    },
    features: {
      cloudinary: cloudinaryEnabled,
      googleDrive: Boolean(env.GOOGLE_API_KEY),
      bulkImport: true,
      export: true,
    },
    stats: { totalStudents, totalDepartments, totalBatches },
  });
});

// ─── GET /api/system/audit ────────────────────────────────────
export const getAuditLogs = asyncWrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const action = req.query.action ? String(req.query.action) : undefined;

  const result = await audit.getAuditLogs(page, limit, action);
  return res.json(result);
});

// ─── GET /api/system/audit/actions ────────────────────────────
export const getAuditActions = asyncWrap(async (_req, res) => {
  const actions = await audit.getAuditActions();
  return res.json({ actions });
});

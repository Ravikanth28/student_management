import type { NextFunction, Request, RequestHandler, Response } from 'express';
import * as settings from '../services/settingsService.js';
import * as audit from '../services/auditService.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

// GET /api/settings/period-schedule
export const getPeriodSchedule = asyncWrap(async (_req, res) => {
  const all = await settings.getAllPeriodSchedules();
  res.json({ ...all, schedule: all.default });
});

// PUT /api/settings/period-schedule  (superadmin)
export const updatePeriodSchedule = asyncWrap(async (req, res) => {
  try {
    const all = await settings.setAllPeriodSchedules(req.body ?? {});
    audit.record(req, { action: 'settings.period_schedule', entity: 'settings', details: JSON.stringify(all) });
    res.json({ ...all, schedule: all.default });
  } catch (err) {
    return res.status(400).json({ message: (err as Error).message });
  }
});

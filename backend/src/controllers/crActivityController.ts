import type { NextFunction, Request, RequestHandler, Response } from 'express';
import * as crActivityRepo from '../repositories/crActivityRepository.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

// GET /api/cr-activity?page=1&limit=25&year=&section=&from=YYYY-MM-DD&to=YYYY-MM-DD
export const listCRActivity = asyncWrap(async (req, res) => {
  const page  = Math.max(1, Number(req.query.page  ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
  const filters = {
    year:    req.query.year    ? String(req.query.year)    : undefined,
    section: req.query.section ? String(req.query.section) : undefined,
    from:    req.query.from    ? String(req.query.from)    : undefined,
    to:      req.query.to      ? String(req.query.to)      : undefined,
  };
  return res.json(await crActivityRepo.listCRActivity(page, limit, filters));
});

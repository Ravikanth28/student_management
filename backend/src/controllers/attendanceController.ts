import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../middleware/error.js';
import * as attendanceRepo from '../repositories/attendanceRepository.js';
import * as audit from '../services/auditService.js';
import { notifyAllInBackground } from '../services/notificationService.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

/** YYYY-MM-DD in IST. */
function today(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// GET /api/attendance/roster?year=&section=
export const getRoster = asyncWrap(async (req, res) => {
  const year = String(req.query.year ?? '').trim();
  const section = String(req.query.section ?? '').trim();
  if (!year || !section) throw new HttpError(400, 'year and section are required');
  return res.json({ data: await attendanceRepo.getRoster(year, section) });
});

// POST /api/attendance  { date?, year, section, absentee_ids: number[] }
export const saveAttendance = asyncWrap(async (req, res) => {
  const year = String(req.body?.year ?? '').trim();
  const section = String(req.body?.section ?? '').trim();
  const date = String(req.body?.date ?? '').trim() || today();
  const absenteeIds: number[] = Array.isArray(req.body?.absentee_ids)
    ? req.body.absentee_ids.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)
    : [];
  if (!year || !section) throw new HttpError(400, 'year and section are required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'date must be YYYY-MM-DD');

  const result = await attendanceRepo.saveDay(date, year, section, absenteeIds, req.user?.username ?? null);
  if (result.present === 0 && result.absent === 0) {
    throw new HttpError(404, 'No students found for that year and section');
  }

  audit.record(req, {
    action: 'attendance.save',
    entity: 'attendance',
    details: `${date} — Year ${year} Sec ${section}: ${result.present} present, ${result.absent} absent`,
  });

  notifyAllInBackground(
    {
      title: '📋 Attendance marked',
      body: `Year ${year} Sec ${section} · ${date} — ${result.present} present, ${result.absent} absent`,
      data: { type: 'attendance', date, year, section },
    },
    req.user?.username ?? null,
  );

  return res.status(201).json(result);
});

// DELETE /api/attendance?date=&year=&section=
export const deleteDay = asyncWrap(async (req, res) => {
  const date = String(req.query.date ?? '').trim();
  const year = String(req.query.year ?? '').trim();
  const section = String(req.query.section ?? '').trim();
  if (!date || !year || !section) throw new HttpError(400, 'date, year and section are required');
  const removed = await attendanceRepo.deleteDay(date, year, section);
  if (removed === 0) throw new HttpError(404, 'No attendance found for that class and date');
  audit.record(req, {
    action: 'attendance.delete',
    entity: 'attendance',
    details: `${date} — Year ${year} Sec ${section}: ${removed} record(s) removed`,
  });
  return res.json({ removed });
});

// GET /api/attendance/day?date=
export const getDay = asyncWrap(async (req, res) => {
  const date = String(req.query.date ?? '').trim() || today();
  return res.json({ date, data: await attendanceRepo.getDay(date) });
});

// GET /api/attendance/student/:id  (one student's attendance history)
export const getStudentAttendance = asyncWrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid student id');
  return res.json({ data: await attendanceRepo.listByStudent(id) });
});

// GET /api/attendance/summary?from=&to=&year=&section=
export const getSummary = asyncWrap(async (req, res) => {
  const rows = await attendanceRepo.summarize({
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
    year: req.query.year ? String(req.query.year) : undefined,
    section: req.query.section ? String(req.query.section) : undefined,
  });
  return res.json({ data: rows });
});

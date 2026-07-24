import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../middleware/error.js';
import { lateCreateSchema } from '../validators/activityValidator.js';
import * as lateRepo from '../repositories/lateRepository.js';
import * as studentRepo from '../repositories/studentRepository.js';
import * as audit from '../services/auditService.js';
import { notifyAllInBackground } from '../services/notificationService.js';
import { computeMinutesLate } from '../config/lateSchedule.js';
import { getPeriodSchedule } from '../services/settingsService.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

function parseId(raw: string | string[]) {
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

/** YYYY-MM-DD in India Standard Time (UTC+5:30), regardless of server timezone. */
function today(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const PERIOD_LABEL: Record<string, string> = {
  morning: 'Morning',
  morning_break: 'Morning break',
  lunch: 'Lunch',
  evening_break: 'Evening break',
};

// POST /api/late-records
export const createLateRecord = asyncWrap(async (req, res) => {
  const parsed = lateCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid late record', issues: parsed.error.flatten() });
  }
  const { student_id, period, time, date: bodyDate } = parsed.data;

  const student = await studentRepo.getStudentById(student_id);
  if (!student) throw new HttpError(404, 'Student not found');

  const date = bodyDate ?? today();
  // Arrival time (from the device, IST), or server-side IST time as a fallback.
  const lateTime = time ?? new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(11, 16);
  const schedule = await getPeriodSchedule(student.year);
  const scheduledTime = schedule[period as keyof typeof schedule] ?? null;
  const minutesLate = scheduledTime ? computeMinutesLate(scheduledTime, lateTime) : null;

  try {
    await lateRepo.createLate({
      studentId: student_id,
      period,
      scheduledTime,
      time: lateTime,
      minutesLate,
      date,
      markedBy: req.user?.username ?? null,
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, `${student.name} is already marked late for ${PERIOD_LABEL[period]} today.`);
    }
    throw err;
  }

  audit.record(req, {
    action: 'late.mark',
    entity: 'student',
    entity_id: String(student_id),
    details: `${student.name} (${student.register_number}) — ${PERIOD_LABEL[period]} at ${lateTime}${minutesLate != null ? ` (${minutesLate} min late)` : ''}`,
  });

  notifyAllInBackground(
    {
      title: '⏰ Late comer marked',
      body: `${student.name} — ${PERIOD_LABEL[period]} at ${lateTime}${minutesLate != null ? ` (${minutesLate} min late)` : ''}`,
      data: { type: 'late', studentId: String(student_id) },
    },
    req.user?.username ?? null,
  );

  return res.status(201).json({ message: 'Marked late', student, period, scheduledTime, time: lateTime, minutesLate, date });
});

// GET /api/late-records  (report, filterable)
export const listLateRecords = asyncWrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const result = await lateRepo.listLate({
    date: req.query.date ? String(req.query.date) : undefined,
    period: req.query.period ? String(req.query.period) : undefined,
    section: req.query.section ? String(req.query.section) : undefined,
    batch: req.query.batch ? String(req.query.batch) : undefined,
    year: req.query.year ? String(req.query.year) : undefined,
    q: req.query.q ? String(req.query.q) : undefined,
    page,
    limit,
  });
  return res.json(result);
});

// GET /api/late-records/summary  (per-student totals over a date range)
export const lateSummary = asyncWrap(async (req, res) => {
  const rows = await lateRepo.summarize({
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
    section: req.query.section ? String(req.query.section) : undefined,
    batch: req.query.batch ? String(req.query.batch) : undefined,
    year: req.query.year ? String(req.query.year) : undefined,
    q: req.query.q ? String(req.query.q) : undefined,
  });
  return res.json({ data: rows });
});

// DELETE /api/late-records/:id
export const deleteLateRecord = asyncWrap(async (req, res) => {
  const id = parseId(req.params.id);
  const ok = await lateRepo.deleteLate(id);
  if (!ok) throw new HttpError(404, 'Late record not found');
  audit.record(req, { action: 'late.delete', entity: 'late_record', entity_id: String(id) });
  return res.status(204).send();
});

// DELETE /api/late-records  (delete all late records)
export const deleteAllLateRecords = asyncWrap(async (req, res) => {
  const count = await lateRepo.deleteAllLate();
  audit.record(req, { action: 'late.delete_all', entity: 'late_records', details: `Cleared all ${count} late record(s)` });
  return res.json({ message: `Deleted all ${count} late record(s)`, deleted: count });
});

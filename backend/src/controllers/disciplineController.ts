import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../middleware/error.js';
import { disciplineCreateSchema } from '../validators/activityValidator.js';
import * as disciplineRepo from '../repositories/disciplineRepository.js';
import * as studentRepo from '../repositories/studentRepository.js';
import * as audit from '../services/auditService.js';
import { notifyAllInBackground } from '../services/notificationService.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

function parseId(raw: string | string[]) {
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

function today(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function currentTime(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(11, 16);
}

// POST /api/discipline-records
export const createDisciplineRecord = asyncWrap(async (req, res) => {
  const parsed = disciplineCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid discipline record', issues: parsed.error.flatten() });
  }
  const { student_id, reason, details, time, date: bodyDate } = parsed.data;

  const student = await studentRepo.getStudentById(student_id);
  if (!student) throw new HttpError(404, 'Student not found');

  const date = bodyDate ?? today();
  const recordTime = time ?? currentTime();

  const id = await disciplineRepo.createDiscipline({
    studentId: student_id,
    reason,
    details,
    date,
    time: recordTime,
    markedBy: req.user?.username ?? null,
  });

  audit.record(req, {
    action: 'discipline.mark',
    entity: 'student',
    entity_id: String(student_id),
    details: `${student.name} (${student.register_number}) — Reason: ${reason}${details ? ` (${details})` : ''}`,
  });

  notifyAllInBackground(
    {
      title: '⚠️ Discipline record added',
      body: `${student.name} — ${reason}`,
      data: { type: 'discipline', studentId: String(student_id) },
    },
    req.user?.username ?? null,
  );

  return res.status(201).json({ id, message: 'Discipline record logged', student, reason, details, date, time: recordTime });
});

// GET /api/discipline-records
export const listDisciplineRecords = asyncWrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const result = await disciplineRepo.listDiscipline({
    date: req.query.date ? String(req.query.date) : undefined,
    reason: req.query.reason ? String(req.query.reason) : undefined,
    section: req.query.section ? String(req.query.section) : undefined,
    batch: req.query.batch ? String(req.query.batch) : undefined,
    year: req.query.year ? String(req.query.year) : undefined,
    q: req.query.q ? String(req.query.q) : undefined,
    page,
    limit,
  });
  return res.json(result);
});

// GET /api/discipline-records/summary
export const disciplineSummary = asyncWrap(async (req, res) => {
  const rows = await disciplineRepo.summarizeDiscipline({
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
    section: req.query.section ? String(req.query.section) : undefined,
    batch: req.query.batch ? String(req.query.batch) : undefined,
    year: req.query.year ? String(req.query.year) : undefined,
    q: req.query.q ? String(req.query.q) : undefined,
  });
  return res.json({ data: rows });
});

// DELETE /api/discipline-records/:id
export const deleteDisciplineRecord = asyncWrap(async (req, res) => {
  const id = parseId(req.params.id);
  const ok = await disciplineRepo.deleteDiscipline(id);
  if (!ok) throw new HttpError(404, 'Discipline record not found');
  audit.record(req, { action: 'discipline.delete', entity: 'discipline_record', entity_id: String(id) });
  return res.status(204).send();
});

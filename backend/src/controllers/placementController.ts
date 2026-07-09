import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../middleware/error.js';
import { placementCreateSchema, placementUpdateSchema } from '../validators/activityValidator.js';
import * as placementRepo from '../repositories/placementRepository.js';
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

// POST /api/placements
export const createPlacement = asyncWrap(async (req, res) => {
  const parsed = placementCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid placement', issues: parsed.error.flatten() });
  }
  const { student_id, ...input } = parsed.data;
  const student = await studentRepo.getStudentById(student_id);
  if (!student) throw new HttpError(404, 'Student not found');

  const id = await placementRepo.createPlacement(student_id, input, req.user?.username ?? null);
  audit.record(req, {
    action: 'placement.create',
    entity: 'student',
    entity_id: String(student_id),
    details: `${student.name} → ${input.company}${input.package ? ` (${input.package})` : ''}`,
  });

  notifyAllInBackground(
    {
      title: '💼 New placement',
      body: `${student.name} placed at ${input.company}${input.package ? ` (${input.package})` : ''}`,
      data: { type: 'placement', studentId: String(student_id) },
    },
    req.user?.username ?? null,
  );

  return res.status(201).json({ message: 'Placement added', id });
});

// GET /api/placements
export const listPlacements = asyncWrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(10000, Math.max(1, Number(req.query.limit) || 20));
  const f = {
    q: req.query.q ? String(req.query.q) : undefined,
    year: req.query.year ? String(req.query.year) : undefined,
    batch: req.query.batch ? String(req.query.batch) : undefined,
    fromDate: req.query.fromDate ? String(req.query.fromDate) : undefined,
    toDate: req.query.toDate ? String(req.query.toDate) : undefined,
  };
  return res.json(await placementRepo.listPlacements(f, page, limit));
});

// PUT /api/placements/:id
export const updatePlacement = asyncWrap(async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = placementUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid placement', issues: parsed.error.flatten() });
  }
  const ok = await placementRepo.updatePlacement(id, parsed.data);
  if (!ok) throw new HttpError(404, 'Placement not found');
  audit.record(req, { action: 'placement.update', entity: 'placement', entity_id: String(id), details: parsed.data.company });
  return res.json({ message: 'Placement updated' });
});

// DELETE /api/placements/:id
export const deletePlacement = asyncWrap(async (req, res) => {
  const id = parseId(req.params.id);
  const ok = await placementRepo.deletePlacement(id);
  if (!ok) throw new HttpError(404, 'Placement not found');
  audit.record(req, { action: 'placement.delete', entity: 'placement', entity_id: String(id) });
  return res.status(204).send();
});

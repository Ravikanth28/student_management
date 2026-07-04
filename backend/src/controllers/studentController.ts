import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../middleware/error.js';
import { studentCreateSchema, studentListQuerySchema, studentSearchSchema, studentUpdateSchema } from '../validators/studentValidator.js';
import * as service from '../services/studentService.js';
import * as audit from '../services/auditService.js';

/** Wraps an async route handler so unhandled rejections go to Express error middleware */
function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

function parseId(rawId: string | string[]) {
  const value = Array.isArray(rawId) ? rawId[0] : rawId;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid student id');
  }

  return id;
}

export const listStudents = asyncWrap(async (req, res) => {
  const parsed = studentListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid query parameters', issues: parsed.error.flatten() });
  }
  const data = await service.filterStudents({
    page: parsed.data.page,
    limit: parsed.data.limit,
    name: parsed.data.q,
    department: parsed.data.department,
    batch: parsed.data.batch,
    section: parsed.data.section
  });
  return res.json(data);
});

export const getStudentById = asyncWrap(async (req, res) => {
  const student = await service.getStudent(parseId(req.params.id));
  return res.json(student);
});

export const createStudent = asyncWrap(async (req, res) => {
  const parsed = studentCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid student payload', issues: parsed.error.flatten() });
  }
  const student = await service.createStudent(parsed.data);
  audit.record(req, {
    action: 'student.create',
    entity: 'student',
    entity_id: String(student.id),
    details: `${student.name} (${student.register_number})`,
  });
  return res.status(201).json({ message: 'Student created', student });
});

export const updateStudent = asyncWrap(async (req, res) => {
  const parsed = studentUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid student payload', issues: parsed.error.flatten() });
  }
  const student = await service.updateStudent(parseId(req.params.id), parsed.data);
  audit.record(req, {
    action: 'student.update',
    entity: 'student',
    entity_id: String(student.id),
    details: `${student.name} (${student.register_number}) — fields: ${Object.keys(parsed.data).join(', ')}`,
  });
  return res.json({ message: 'Student updated', student });
});

export const deleteStudent = asyncWrap(async (req, res) => {
  const id = parseId(req.params.id);
  await service.deleteStudent(id);
  audit.record(req, {
    action: 'student.delete',
    entity: 'student',
    entity_id: String(id),
  });
  return res.status(204).send();
});

export const searchStudents = asyncWrap(async (req, res) => {
  const parsed = studentSearchSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid search query', issues: parsed.error.flatten() });
  }
  const students = await service.searchStudents(parsed.data.q);
  return res.json({ data: students, query: parsed.data.q });
});

export const getStats = asyncWrap(async (_req, res) => {
  const stats = await service.getDashboardStats();
  return res.json(stats);
});


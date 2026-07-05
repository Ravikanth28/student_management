import type { NextFunction, Request, RequestHandler, Response } from 'express';
import * as XLSX from 'xlsx';
import * as service from '../services/studentService.js';
import type { StudentRecord } from '../types/student.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

function parseOptionalInt(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// ─── GET /api/students/filter ─────────────────────────────────
export const filterStudents = asyncWrap(async (req, res) => {
  const result = await service.filterStudents({
    name:        req.query.name        ? String(req.query.name)        : undefined,
    department:  req.query.department  ? String(req.query.department)  : undefined,
    batch:       req.query.batch       ? String(req.query.batch)       : undefined,
    section:     req.query.section     ? String(req.query.section)     : undefined,
    blood_group: req.query.blood_group ? String(req.query.blood_group) : undefined,
    page:        parseOptionalInt(req.query.page,  1),
    limit:       parseOptionalInt(req.query.limit, 50),
  });
  return res.json(result);
});

// ─── GET /api/students/birthdays ──────────────────────────────
export const getBirthdays = asyncWrap(async (_req, res) => {
  const data = await service.getTodaysBirthdays();
  return res.json({ data });
});

// ─── GET /api/students/birthdays/upcoming?days=60 ─────────────
export const getUpcomingBirthdays = asyncWrap(async (req, res) => {
  const days = Math.min(366, Math.max(1, Number(req.query.days) || 60));
  const data = await service.getUpcomingBirthdays(days);
  return res.json({ data });
});

// ─── GET /api/students/meta ───────────────────────────────────
export const getFilterMeta = asyncWrap(async (_req, res) => {
  const meta = await service.getFilterMeta();
  return res.json(meta);
});

// ─── GET /api/students/export?format=csv|xlsx&... ────────────
export const exportStudents = asyncWrap(async (req, res) => {
  const format = String(req.query.format ?? 'xlsx').toLowerCase();
  if (!['csv', 'xlsx'].includes(format)) {
    return res.status(400).json({ message: 'format must be csv or xlsx' });
  }

  // Re-use filterStudents but fetch ALL matching rows (no pagination)
  const result = await service.filterStudents({
    name:       req.query.name       ? String(req.query.name)       : undefined,
    department: req.query.department ? String(req.query.department) : undefined,
    batch:      req.query.batch      ? String(req.query.batch)      : undefined,
    section:    req.query.section    ? String(req.query.section)    : undefined,
    page:  1,
    limit: 10_000, // practical maximum
  });

  const rows = result.data.map((s: StudentRecord) => ({
    'Name':               s.name,
    'Register Number':    s.register_number,
    'Enrollment Number':  s.enrollment_number,
    'Section':            s.section,
    'Department':         s.department,
    'Batch':              s.batch,
    'Phone':              s.phone,
    'Parent Phone':       s.parent_phone,
    'Address':            s.address,
    'College Email':      s.college_email    ?? '',
    'Personal Email':     s.personal_email   ?? '',
    'Photo URL':          s.photo_url        ?? '',
    'Added On':           new Date(s.created_at).toLocaleDateString('en-IN'),
  }));

  const wb  = XLSX.utils.book_new();
  const ws  = XLSX.utils.json_to_sheet(rows);

  // Auto column widths
  const colWidths = Object.keys(rows[0] ?? {}).map(k => ({ wch: Math.max(k.length + 2, 18) }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename   = `students_export_${timestamp}.${format}`;
  const bookType   = format as 'csv' | 'xlsx';
  const buffer     = XLSX.write(wb, { type: 'buffer', bookType });

  const mimeTypes: Record<string, string> = {
    csv:  'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', mimeTypes[format]);
  return res.send(buffer);
});

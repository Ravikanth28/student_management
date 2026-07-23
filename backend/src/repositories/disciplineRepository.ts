import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';

export interface DisciplineRecord {
  id: number;
  student_id: number;
  reason: string;
  details: string | null;
  record_date: string;
  record_time: string | null;
  marked_by: string | null;
  created_at: string;
  // Joined student fields
  name?: string;
  register_number?: string;
  enrollment_number?: string;
  section?: string;
  year?: string | null;
  department?: string;
  batch?: string;
}

export interface DisciplineListResult {
  data: DisciplineRecord[];
  meta: { page: number; limit: number; total: number };
}

export interface DisciplineSummaryRow {
  student_id: number;
  name: string;
  register_number: string;
  section: string;
  year: string | null;
  batch: string;
  total: number;
  reasons: string;
}

export async function createDiscipline(entry: {
  studentId: number;
  reason: string;
  details?: string | null;
  date: string;
  time?: string | null;
  markedBy?: string | null;
}): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO discipline_records (student_id, reason, details, record_date, record_time, marked_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      entry.studentId,
      entry.reason,
      entry.details ?? null,
      entry.date,
      entry.time ?? null,
      entry.markedBy ?? null,
    ]
  );
  return Number(result.insertId);
}

export async function deleteDiscipline(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM discipline_records WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function listDisciplineByStudent(studentId: number): Promise<DisciplineRecord[]> {
  const [rows] = await pool.query<Array<DisciplineRecord & RowDataPacket>>(
    `SELECT id, student_id, reason, details,
            DATE_FORMAT(record_date, '%Y-%m-%d') AS record_date, record_time, marked_by, created_at
     FROM discipline_records WHERE student_id = ? ORDER BY record_date DESC, id DESC`,
    [studentId]
  );
  return rows.map(normalize);
}

export interface DisciplineFilter {
  date?: string;
  reason?: string;
  section?: string;
  batch?: string;
  year?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export async function listDiscipline(f: DisciplineFilter): Promise<DisciplineListResult> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (f.date) {
    conditions.push('dr.record_date = ?');
    values.push(f.date);
  }
  if (f.reason) {
    conditions.push('dr.reason LIKE ?');
    values.push(`%${f.reason}%`);
  }
  if (f.section) {
    conditions.push('s.section = ?');
    values.push(f.section);
  }
  if (f.batch) {
    conditions.push('s.batch = ?');
    values.push(f.batch);
  }
  if (f.year) {
    conditions.push('s.year = ?');
    values.push(f.year);
  }
  if (f.q) {
    conditions.push('(s.name LIKE ? OR s.register_number LIKE ? OR s.enrollment_number LIKE ? OR dr.reason LIKE ? OR dr.details LIKE ?)');
    const term = `%${f.q.trim()}%`;
    values.push(term, term, term, term, term);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = Math.max(1, f.page ?? 1);
  const limit = Math.min(200, Math.max(1, f.limit ?? 50));
  const offset = (page - 1) * limit;

  const [rows] = await pool.query<Array<DisciplineRecord & RowDataPacket>>(
    `SELECT dr.id, dr.student_id, dr.reason, dr.details,
            DATE_FORMAT(dr.record_date, '%Y-%m-%d') AS record_date,
            dr.record_time, dr.marked_by, dr.created_at,
            s.name, s.register_number, s.enrollment_number, s.section, s.year, s.department, s.batch
     FROM discipline_records dr
     JOIN students s ON s.id = dr.student_id
     ${where}
     ORDER BY dr.record_date DESC, dr.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  const [countRows] = await pool.query<Array<{ total: number } & RowDataPacket>>(
    `SELECT COUNT(*) AS total FROM discipline_records dr JOIN students s ON s.id = dr.student_id ${where}`,
    values
  );

  return {
    data: rows.map(normalize),
    meta: { page, limit, total: Number(countRows[0]?.total ?? 0) },
  };
}

export async function summarizeDiscipline(f: {
  from?: string;
  to?: string;
  section?: string;
  batch?: string;
  year?: string;
  q?: string;
}): Promise<DisciplineSummaryRow[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (f.from) {
    conditions.push('dr.record_date >= ?');
    values.push(f.from);
  }
  if (f.to) {
    conditions.push('dr.record_date <= ?');
    values.push(f.to);
  }
  if (f.section) {
    conditions.push('s.section = ?');
    values.push(f.section);
  }
  if (f.batch) {
    conditions.push('s.batch = ?');
    values.push(f.batch);
  }
  if (f.year) {
    conditions.push('s.year = ?');
    values.push(f.year);
  }
  if (f.q) {
    conditions.push('(s.name LIKE ? OR s.register_number LIKE ?)');
    const term = `%${f.q.trim()}%`;
    values.push(term, term);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<Array<DisciplineSummaryRow & RowDataPacket>>(
    `SELECT s.id AS student_id, s.name, s.register_number, s.section, s.year, s.batch,
            COUNT(dr.id) AS total,
            GROUP_CONCAT(DISTINCT dr.reason SEPARATOR ', ') AS reasons
     FROM discipline_records dr
     JOIN students s ON s.id = dr.student_id
     ${where}
     GROUP BY s.id, s.name, s.register_number, s.section, s.year, s.batch
     ORDER BY total DESC, s.name ASC`,
    values
  );

  return rows.map((r) => ({
    student_id: Number(r.student_id),
    name: r.name,
    register_number: r.register_number,
    section: r.section,
    year: r.year ?? null,
    batch: r.batch,
    total: Number(r.total),
    reasons: r.reasons ?? '',
  }));
}

function normalize(row: DisciplineRecord & RowDataPacket): DisciplineRecord {
  return {
    ...row,
    id: Number(row.id),
    student_id: Number(row.student_id),
    record_date: String(row.record_date),
    record_time: row.record_time ?? null,
    details: row.details ?? null,
    marked_by: row.marked_by ?? null,
    year: row.year ?? null,
  };
}

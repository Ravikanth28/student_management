import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';

export const LATE_PERIODS = ['morning', 'morning_break', 'lunch', 'evening_break'] as const;
export type LatePeriod = (typeof LATE_PERIODS)[number];

export interface LateRecord {
  id: number;
  student_id: number;
  period: string;
  scheduled_time: string | null;
  late_time: string | null;
  minutes_late: number | null;
  late_date: string;
  marked_by: string | null;
  created_at: string;
  // Joined student fields (present in report/list queries)
  name?: string;
  register_number?: string;
  enrollment_number?: string;
  section?: string;
  department?: string;
  batch?: string;
}

export interface LateListResult {
  data: LateRecord[];
  meta: { page: number; limit: number; total: number };
}

/** Creates a late record. Throws ER_DUP_ENTRY if the student is already marked
 *  for that period today (handled by the caller). */
export async function createLate(entry: {
  studentId: number;
  period: string;
  scheduledTime: string | null;
  time: string | null;
  minutesLate: number | null;
  date: string;
  markedBy: string | null;
}): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO late_records (student_id, period, scheduled_time, late_time, minutes_late, late_date, marked_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entry.studentId, entry.period, entry.scheduledTime, entry.time, entry.minutesLate, entry.date, entry.markedBy]
  );
  return Number(result.insertId);
}

export async function deleteLate(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM late_records WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function listLateByStudent(studentId: number): Promise<LateRecord[]> {
  const [rows] = await pool.query<Array<LateRecord & RowDataPacket>>(
    `SELECT id, student_id, period, scheduled_time, late_time, minutes_late,
            DATE_FORMAT(late_date, '%Y-%m-%d') AS late_date, marked_by, created_at
     FROM late_records WHERE student_id = ? ORDER BY late_date DESC, id DESC`,
    [studentId]
  );
  return rows.map(normalize);
}

export interface LateFilter {
  date?: string;
  period?: string;
  section?: string;
  batch?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export async function listLate(f: LateFilter): Promise<LateListResult> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (f.date)    { conditions.push('lr.late_date = ?'); values.push(f.date); }
  if (f.period)  { conditions.push('lr.period = ?'); values.push(f.period); }
  if (f.section) { conditions.push('s.section = ?'); values.push(f.section); }
  if (f.batch)   { conditions.push('s.batch = ?'); values.push(f.batch); }
  if (f.q) {
    conditions.push('(s.name LIKE ? OR s.register_number LIKE ? OR s.enrollment_number LIKE ?)');
    const like = `%${f.q}%`;
    values.push(like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = f.page ?? 1;
  const limit = f.limit ?? 50;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query<Array<LateRecord & RowDataPacket>>(
    `SELECT lr.id, lr.student_id, lr.period, lr.scheduled_time, lr.late_time, lr.minutes_late,
            DATE_FORMAT(lr.late_date, '%Y-%m-%d') AS late_date, lr.marked_by, lr.created_at,
            s.name, s.register_number, s.enrollment_number, s.section, s.department, s.batch
     FROM late_records lr
     JOIN students s ON s.id = lr.student_id
     ${where}
     ORDER BY lr.late_date DESC, lr.id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );
  const [countRows] = await pool.query<Array<{ total: number } & RowDataPacket>>(
    `SELECT COUNT(*) AS total FROM late_records lr JOIN students s ON s.id = lr.student_id ${where}`,
    values
  );

  return {
    data: rows.map(normalize),
    meta: { page, limit, total: Number(countRows[0]?.total ?? 0) },
  };
}

function normalize(r: LateRecord & RowDataPacket): LateRecord {
  return {
    id: Number(r.id),
    student_id: Number(r.student_id),
    period: r.period,
    scheduled_time: r.scheduled_time ?? null,
    late_time: r.late_time ?? null,
    minutes_late: r.minutes_late == null ? null : Number(r.minutes_late),
    late_date: r.late_date,
    marked_by: r.marked_by ?? null,
    created_at: r.created_at,
    name: r.name,
    register_number: r.register_number,
    enrollment_number: r.enrollment_number,
    section: r.section,
    department: r.department,
    batch: r.batch,
  };
}

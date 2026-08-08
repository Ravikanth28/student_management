import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';

export interface RosterStudent {
  id: number;
  name: string;
  register_number: string;
  enrollment_number: string;
  section: string;
  year: string | null;
}

/** Students in a given year + section (the class roster for attendance). */
export async function getRoster(year: string, section: string): Promise<RosterStudent[]> {
  const [rows] = await pool.query<Array<RosterStudent & RowDataPacket>>(
    `SELECT id, name, register_number, enrollment_number, section, year
       FROM students WHERE year = ? AND section = ? ORDER BY name ASC`,
    [year, section],
  );
  return rows;
}

/**
 * Save a day's attendance for one class: everyone in the roster is marked
 * present except the given absentee ids. Upserts (re-saving a day overwrites it).
 */
export async function saveDay(
  date: string,
  year: string,
  section: string,
  session: string,
  absenteeIds: number[],
  markedBy: string | null,
): Promise<{ present: number; absent: number }> {
  const roster = await getRoster(year, section);
  if (roster.length === 0) return { present: 0, absent: 0 };

  const absentSet = new Set(absenteeIds.map(Number));
  const values = roster.map((s) => [
    s.id, date, session, absentSet.has(s.id) ? 'absent' : 'present', year, section, markedBy,
  ]);

  await pool.query<ResultSetHeader>(
    `INSERT INTO attendance (student_id, att_date, session, status, year, section, marked_by)
     VALUES ?
     ON DUPLICATE KEY UPDATE status = VALUES(status), year = VALUES(year), section = VALUES(section), marked_by = VALUES(marked_by)`,
    [values],
  );

  const absent = roster.filter((s) => absentSet.has(s.id)).length;
  return { present: roster.length - absent, absent };
}

/** Delete a class's attendance for one day. Returns rows removed. */
export async function deleteDay(date: string, year: string, section: string, session: string): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    'DELETE FROM attendance WHERE att_date = ? AND year = ? AND section = ? AND session = ?',
    [date, year, section, session],
  );
  return res.affectedRows;
}

export interface DaySection {
  year: string | null;
  section: string | null;
  present: number;
  absent: number;
  total: number;
  absentees: { id: number; name: string; register_number: string }[];
}

/** All attendance for a date, grouped by year → section, with the absentee list. */
export async function getDay(date: string, session: string): Promise<DaySection[]> {
  const [rows] = await pool.query<Array<{
    year: string | null; section: string | null; status: string;
    student_id: number; name: string; register_number: string;
  } & RowDataPacket>>(
    `SELECT a.year, a.section, a.status, a.student_id, s.name, s.register_number
       FROM attendance a JOIN students s ON s.id = a.student_id
      WHERE a.att_date = ? AND a.session = ?
      ORDER BY a.year ASC, a.section ASC, s.name ASC`,
    [date, session],
  );

  const map = new Map<string, DaySection>();
  for (const r of rows) {
    const key = `${r.year ?? ''}|${r.section ?? ''}`;
    let g = map.get(key);
    if (!g) {
      g = { year: r.year, section: r.section, present: 0, absent: 0, total: 0, absentees: [] };
      map.set(key, g);
    }
    g.total++;
    if (r.status === 'absent') {
      g.absent++;
      g.absentees.push({ id: r.student_id, name: r.name, register_number: r.register_number });
    } else {
      g.present++;
    }
  }
  return [...map.values()];
}

export interface StudentAttendanceRow {
  att_date: string;
  status: string;
  year: string | null;
  section: string | null;
}

/** One student's full attendance history (most recent first). */
export async function listByStudent(studentId: number): Promise<StudentAttendanceRow[]> {
  const [rows] = await pool.query<Array<StudentAttendanceRow & RowDataPacket>>(
    `SELECT DATE_FORMAT(att_date, '%Y-%m-%d') AS att_date, status, year, section
       FROM attendance WHERE student_id = ? ORDER BY att_date DESC`,
    [studentId],
  );
  return rows;
}

export interface AttendanceSummaryRow {
  student_id: number;
  name: string;
  register_number: string;
  section: string;
  year: string | null;
  days: number;
  present: number;
  absent: number;
  percentage: number;
}

/** Per-student attendance totals over an optional date range / class filter. */
export async function summarize(params: {
  from?: string; to?: string; year?: string; section?: string;
}): Promise<AttendanceSummaryRow[]> {
  const cond: string[] = [];
  const vals: unknown[] = [];
  if (params.from) { cond.push('a.att_date >= ?'); vals.push(params.from); }
  if (params.to) { cond.push('a.att_date <= ?'); vals.push(params.to); }
  if (params.year) { cond.push('s.year = ?'); vals.push(params.year); }
  if (params.section) { cond.push('s.section = ?'); vals.push(params.section); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

  const [rows] = await pool.query<Array<AttendanceSummaryRow & RowDataPacket>>(
    `SELECT s.id AS student_id, s.name, s.register_number, s.section, s.year,
            COUNT(a.id) AS days,
            SUM(a.status = 'present') AS present,
            SUM(a.status = 'absent') AS absent,
            ROUND(100 * SUM(a.status = 'present') / COUNT(a.id), 1) AS percentage
       FROM attendance a JOIN students s ON s.id = a.student_id
       ${where}
      GROUP BY s.id, s.name, s.register_number, s.section, s.year
      ORDER BY percentage ASC, s.name ASC`,
    vals,
  );
  return rows.map((r) => ({
    ...r,
    days: Number(r.days),
    present: Number(r.present),
    absent: Number(r.absent),
    percentage: Number(r.percentage),
  }));
}

export interface AttendanceRangeRow {
  att_date: string;
  student_id: number;
  name: string;
  register_number: string;
  enrollment_number: string;
  year: string | null;
  section: string | null;
  marked_by: string | null;
}

/** Detailed absentee list over a date range for Admin/Superadmin export. */
export async function getRangeReport(params: {
  from?: string; to?: string; year?: string; section?: string;
}): Promise<AttendanceRangeRow[]> {
  const cond: string[] = ["a.status = 'absent'"];
  const vals: unknown[] = [];
  if (params.from) { cond.push('a.att_date >= ?'); vals.push(params.from); }
  if (params.to) { cond.push('a.att_date <= ?'); vals.push(params.to); }
  if (params.year) { cond.push('a.year = ?'); vals.push(params.year); }
  if (params.section) { cond.push('a.section = ?'); vals.push(params.section); }
  const where = `WHERE ${cond.join(' AND ')}`;

  const [rows] = await pool.query<Array<AttendanceRangeRow & RowDataPacket>>(
    `SELECT DATE_FORMAT(a.att_date, '%Y-%m-%d') AS att_date, a.student_id, s.name, s.register_number, s.enrollment_number, a.year, a.section, a.marked_by
       FROM attendance a JOIN students s ON s.id = a.student_id
       ${where}
       ORDER BY a.att_date DESC, a.year ASC, a.section ASC, s.name ASC`,
    vals,
  );
  return rows.map((r) => ({
    ...r,
    student_id: Number(r.student_id),
  }));
}

/** Remove absent status for one or multiple student entries (updating status to present). */
export async function removeAbsentees(entries: { student_id: number; att_date: string }[]): Promise<number> {
  if (entries.length === 0) return 0;
  const conditions = entries.map(() => '(student_id = ? AND att_date = ?)').join(' OR ');
  const params = entries.flatMap((e) => [e.student_id, e.att_date]);
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE attendance SET status = 'present' WHERE status = 'absent' AND (${conditions})`,
    params,
  );
  return res.affectedRows;
}

export interface ExportDataRow {
  student_id: number;
  name: string;
  register_number: string;
  enrollment_number: string;
  section: string;
  att_date: string | null;
  status: string | null;
}

/** Fetches students and their attendance records for the Excel export. */
export async function getExportData(params: {
  from: string;
  to: string;
  year?: string;
  section?: string;
}): Promise<ExportDataRow[]> {
  const cond: string[] = [];
  const vals: unknown[] = [params.from, params.to];
  if (params.year) { cond.push('s.year = ?'); vals.push(params.year); }
  if (params.section) { cond.push('s.section = ?'); vals.push(params.section); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

  const [rows] = await pool.query<Array<ExportDataRow & RowDataPacket>>(
    `SELECT s.id AS student_id, s.name, s.register_number, s.enrollment_number, s.section, 
            DATE_FORMAT(a.att_date, '%Y-%m-%d') AS att_date, a.status
       FROM students s
       LEFT JOIN attendance a ON s.id = a.student_id AND a.att_date >= ? AND a.att_date <= ?
       ${where}
       ORDER BY s.section ASC, s.name ASC, a.att_date ASC`,
    vals,
  );
  
  return rows.map((r) => ({
    ...r,
    student_id: Number(r.student_id),
  }));
}

import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';
import type { StudentInput, StudentListResult, StudentRecord } from '../types/student.js';

type StudentRow = RowDataPacket & StudentRecord;

function rowToStudent(row: StudentRow): StudentRecord {
  return {
    id: Number(row.id),
    name: row.name,
    register_number: row.register_number,
    enrollment_number: row.enrollment_number,
    section: row.section,
    department: row.department,
    batch: row.batch,
    phone: row.phone,
    parent_phone: row.parent_phone,
    address: row.address,
    college_email: row.college_email ?? undefined,
    personal_email: row.personal_email ?? undefined,
    photo_url: row.photo_url ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function buildFilter(term?: string) {
  if (!term) {
    return { clause: '', params: [] as Array<string> };
  }

  const like = `%${term}%`;
  return {
    clause: 'WHERE name LIKE ? OR register_number LIKE ?',
    params: [like, like]
  };
}

export async function listStudents(page: number, limit: number, term?: string): Promise<StudentListResult> {
  const offset = (page - 1) * limit;
  const { clause, params } = buildFilter(term);

  const [rows] = await pool.query<StudentRow[]>(
    `SELECT * FROM students ${clause} ORDER BY register_number ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query<Array<{ total: number } & RowDataPacket>>(
    `SELECT COUNT(*) AS total FROM students ${clause}`,
    params
  );

  return {
    data: rows.map(rowToStudent),
    meta: {
      page,
      limit,
      total: Number(countRows[0]?.total ?? 0)
    }
  };
}

export async function getStudentById(id: number): Promise<StudentRecord | null> {
  const [rows] = await pool.query<StudentRow[]>('SELECT * FROM students WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? rowToStudent(rows[0]) : null;
}

export async function createStudent(input: StudentInput): Promise<StudentRecord> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO students
      (name, register_number, enrollment_number, section, department, batch, phone, parent_phone, address, college_email, personal_email, photo_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.register_number,
      input.enrollment_number,
      input.section,
      input.department,
      input.batch,
      input.phone,
      input.parent_phone,
      input.address,
      input.college_email ?? null,
      input.personal_email ?? null,
      input.photo_url ?? null
    ]
  );

  const created = await getStudentById(Number(result.insertId));
  if (!created) {
    throw new Error('Student creation failed');
  }

  return created;
}

export async function updateStudent(id: number, changes: Partial<StudentInput>): Promise<StudentRecord | null> {
  const entries = Object.entries(changes).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return getStudentById(id);
  }

  const setClause = entries.map(([field]) => `${field} = ?`).join(', ');
  const values = entries.map(([, value]) => value);
  await pool.query(`UPDATE students SET ${setClause} WHERE id = ?`, [...values, id]);
  return getStudentById(id);
}

export async function deleteStudent(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM students WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function searchStudents(term: string, limit = 6): Promise<StudentRecord[]> {
  const like = `%${term}%`;
  const [rows] = await pool.query<StudentRow[]>(
    `SELECT *
     FROM students
     WHERE name LIKE ? OR register_number LIKE ?
     ORDER BY
       CASE WHEN register_number LIKE ? THEN 0 ELSE 1 END,
       name ASC
     LIMIT ?`,
    [like, like, like, limit]
  );

  return rows.map(rowToStudent);
}

export async function getStudentByRegNumber(regNumber: string): Promise<StudentRecord | null> {
  const [rows] = await pool.query<StudentRow[]>(
    'SELECT * FROM students WHERE register_number = ? LIMIT 1',
    [regNumber]
  );
  return rows[0] ? rowToStudent(rows[0]) : null;
}

/** Lookup for the scanner: match a scanned code against enrollment OR register number. */
export async function getStudentByCode(code: string): Promise<StudentRecord | null> {
  const [rows] = await pool.query<StudentRow[]>(
    'SELECT * FROM students WHERE enrollment_number = ? OR register_number = ? ORDER BY (enrollment_number = ?) DESC LIMIT 1',
    [code, code, code]
  );
  return rows[0] ? rowToStudent(rows[0]) : null;
}

export interface FilterParams {
  name?:       string;
  department?: string;
  batch?:      string;
  section?:    string;
  page?:       number;
  limit?:      number;
}

export async function filterStudents(
  params: FilterParams
): Promise<StudentListResult> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.name) {
    conditions.push('(name LIKE ? OR register_number LIKE ? OR enrollment_number LIKE ?)');
    const like = `%${params.name}%`;
    values.push(like, like, like);
  }
  if (params.department) {
    conditions.push('department = ?');
    values.push(params.department);
  }
  if (params.batch) {
    conditions.push('batch = ?');
    values.push(params.batch);
  }
  if (params.section) {
    conditions.push('section = ?');
    values.push(params.section);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const page  = params.page  ?? 1;
  const limit = params.limit ?? 50;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query<StudentRow[]>(
    `SELECT * FROM students ${where} ORDER BY register_number ASC LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );
  const [countRows] = await pool.query<Array<{ total: number } & RowDataPacket>>(
    `SELECT COUNT(*) AS total FROM students ${where}`,
    values
  );

  return {
    data: rows.map(rowToStudent),
    meta: { page, limit, total: Number(countRows[0]?.total ?? 0) },
  };
}

/** Returns distinct department & batch values for filter dropdowns */
export async function getFilterMeta(): Promise<{ departments: string[]; batches: string[] }> {
  const [[deptRows], [batchRows]] = await Promise.all([
    pool.query<Array<{ department: string } & RowDataPacket>>(
      'SELECT DISTINCT department FROM students ORDER BY department ASC'
    ),
    pool.query<Array<{ batch: string } & RowDataPacket>>(
      'SELECT DISTINCT batch FROM students ORDER BY batch DESC'
    ),
  ]);
  return {
    departments: (deptRows as Array<{ department: string } & RowDataPacket>).map(r => r.department),
    batches:     (batchRows as Array<{ batch: string } & RowDataPacket>).map(r => r.batch),
  };
}

export async function getDashboardStats(): Promise<{
  totalStudents: number;
  totalDepartments: number;
  totalBatches: number;
  recentStudents: StudentRecord[];
}> {
  const [[countRows], [deptRows], [batchRows], [recentRows]] = await Promise.all([
    pool.query<Array<{ total: number } & RowDataPacket>>(
      'SELECT COUNT(*) AS total FROM students'
    ),
    pool.query<Array<{ dept_count: number } & RowDataPacket>>(
      'SELECT COUNT(DISTINCT department) AS dept_count FROM students'
    ),
    pool.query<Array<{ batch_count: number } & RowDataPacket>>(
      'SELECT COUNT(DISTINCT batch) AS batch_count FROM students'
    ),
    pool.query<StudentRow[]>(
      'SELECT * FROM students ORDER BY created_at DESC, id DESC LIMIT 5'
    ),
  ]);

  return {
    totalStudents:    Number(countRows[0]?.total ?? 0),
    totalDepartments: Number(deptRows[0]?.dept_count ?? 0),
    totalBatches:     Number(batchRows[0]?.batch_count ?? 0),
    recentStudents:   (recentRows as StudentRow[]).map(rowToStudent),
  };
}


import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';
import type { StudentInput, StudentListResult, StudentRecord } from '../types/student.js';
import { toDateString } from '../lib/studentFields.js';

type StudentRow = RowDataPacket & StudentRecord;

function rowToStudent(row: StudentRow): StudentRecord {
  return {
    id: Number(row.id),
    name: row.name,
    register_number: row.register_number,
    enrollment_number: row.enrollment_number,
    section: row.section,
    year: row.year ?? undefined,
    department: row.department,
    batch: row.batch,
    phone: row.phone,
    parent_phone: row.parent_phone,
    address: row.address,
    college_email: row.college_email ?? undefined,
    personal_email: row.personal_email ?? undefined,
    photo_url: row.photo_url ?? undefined,
    blood_group: row.blood_group ?? undefined,
    dob: toDateString(row.dob),
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
      (name, register_number, enrollment_number, section, year, department, batch, phone, parent_phone, address, college_email, personal_email, photo_url, blood_group, dob)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.register_number,
      input.enrollment_number,
      input.section,
      input.year ?? null,
      input.department,
      input.batch,
      input.phone,
      input.parent_phone,
      input.address,
      input.college_email ?? null,
      input.personal_email ?? null,
      input.photo_url ?? null,
      input.blood_group ?? null,
      input.dob ?? null
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
     WHERE name LIKE ? OR register_number LIKE ? OR enrollment_number LIKE ?
     ORDER BY
       CASE WHEN register_number = ? OR enrollment_number = ? THEN 0 ELSE 1 END,
       name ASC
     LIMIT ?`,
    [like, like, like, term, term, limit]
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
  name?:        string;
  department?:  string;
  batch?:       string;
  section?:     string;
  year?:        string;
  blood_group?: string;
  page?:        number;
  limit?:       number;
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
  if (params.blood_group) {
    conditions.push('blood_group = ?');
    values.push(params.blood_group);
  }
  if (params.year) {
    conditions.push('year = ?');
    values.push(params.year);
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

/** Returns distinct department, batch, blood-group, year & section values for filter dropdowns */
export async function getFilterMeta(): Promise<{ departments: string[]; batches: string[]; bloodGroups: string[]; years: string[]; sections: string[] }> {
  const [[deptRows], [batchRows], [bloodRows], [yearRows], [sectionRows]] = await Promise.all([
    pool.query<Array<{ department: string } & RowDataPacket>>(
      'SELECT DISTINCT department FROM students ORDER BY department ASC'
    ),
    pool.query<Array<{ batch: string } & RowDataPacket>>(
      'SELECT DISTINCT batch FROM students ORDER BY batch DESC'
    ),
    pool.query<Array<{ blood_group: string } & RowDataPacket>>(
      "SELECT DISTINCT blood_group FROM students WHERE blood_group IS NOT NULL AND blood_group <> '' ORDER BY blood_group ASC"
    ),
    pool.query<Array<{ year: string } & RowDataPacket>>(
      "SELECT DISTINCT year FROM students WHERE year IS NOT NULL AND year != '' ORDER BY year ASC"
    ),
    pool.query<Array<{ section: string } & RowDataPacket>>(
      "SELECT DISTINCT section FROM students WHERE section IS NOT NULL AND section != '' ORDER BY section ASC"
    ),
  ]);
  return {
    departments: (deptRows as Array<{ department: string } & RowDataPacket>).map(r => r.department),
    batches:     (batchRows as Array<{ batch: string } & RowDataPacket>).map(r => r.batch),
    bloodGroups: (bloodRows as Array<{ blood_group: string } & RowDataPacket>).map(r => r.blood_group),
    years:       (yearRows as Array<{ year: string } & RowDataPacket>).map(r => r.year),
    sections:    (sectionRows as Array<{ section: string } & RowDataPacket>).map(r => r.section),
  };
}

/** Students whose date of birth falls on the given month/day (for the birthday widget). */
export async function getBirthdaysByDay(month: number, day: number): Promise<StudentRecord[]> {
  const [rows] = await pool.query<StudentRow[]>(
    `SELECT * FROM students
     WHERE dob IS NOT NULL AND MONTH(dob) = ? AND DAYOFMONTH(dob) = ?
     ORDER BY name ASC`,
    [month, day]
  );
  return rows.map(rowToStudent);
}

/** Current count of students in each year value (for the promotion preview). */
export async function getYearCounts(): Promise<Record<string, number>> {
  const [rows] = await pool.query<Array<{ year: string | null; c: number } & RowDataPacket>>(
    'SELECT year, COUNT(*) AS c FROM students GROUP BY year'
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.year ?? 'unset'] = Number(r.c);
  return out;
}

export interface LastPromotion {
  id: number;
  created_by: string | null;
  promoted_count: number;
  created_at: string;
}

/** The most recent promotion that hasn't been reverted (for the undo button). */
export async function getLastPromotion(): Promise<LastPromotion | null> {
  const [rows] = await pool.query<Array<LastPromotion & RowDataPacket>>(
    `SELECT id, created_by, promoted_count, created_at
       FROM promotion_batches WHERE reverted = 0
       ORDER BY id DESC LIMIT 1`
  );
  return rows[0] ?? null;
}

/**
 * Year rollover: IΓåÆII, IIΓåÆIII, IIIΓåÆIV, IVΓåÆAlumni. Snapshots each changed
 * student's previous year into promotion_changes so it can be undone precisely
 * (genuine Alumni are never touched). Returns the number of rows changed.
 */
export async function promoteYears(createdBy: string | null): Promise<number> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [affected] = await conn.query<StudentRow[]>(
      "SELECT id, year FROM students WHERE year IN ('1','2','3','4')"
    );
    if (affected.length === 0) {
      await conn.commit();
      return 0;
    }

    const [batchRes] = await conn.query<ResultSetHeader>(
      'INSERT INTO promotion_batches (created_by, promoted_count) VALUES (?, ?)',
      [createdBy, affected.length]
    );
    const batchId = batchRes.insertId;

    await conn.query(
      'INSERT INTO promotion_changes (batch_id, student_id, from_year) VALUES ?',
      [affected.map((r) => [batchId, r.id, r.year])]
    );

    await conn.query(
      `UPDATE students
         SET year = CASE year
           WHEN '1' THEN '2'
           WHEN '2' THEN '3'
           WHEN '3' THEN '4'
           WHEN '4' THEN 'Alumni'
           ELSE year END
       WHERE year IN ('1','2','3','4')`
    );

    await conn.commit();
    return affected.length;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Undo the most recent (non-reverted) promotion, restoring each student's prior year. */
export async function revertLastPromotion(): Promise<{ reverted: number }> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [batches] = await conn.query<Array<{ id: number } & RowDataPacket>>(
      'SELECT id FROM promotion_batches WHERE reverted = 0 ORDER BY id DESC LIMIT 1'
    );
    const batchId = batches[0]?.id;
    if (!batchId) {
      await conn.commit();
      return { reverted: 0 };
    }

    const [changes] = await conn.query<Array<{ student_id: number; from_year: string | null } & RowDataPacket>>(
      'SELECT student_id, from_year FROM promotion_changes WHERE batch_id = ?',
      [batchId]
    );
    for (const c of changes) {
      await conn.query('UPDATE students SET year = ? WHERE id = ?', [c.from_year, c.student_id]);
    }

    await conn.query('UPDATE promotion_batches SET reverted = 1, reverted_at = CURRENT_TIMESTAMP WHERE id = ?', [batchId]);

    await conn.commit();
    return { reverted: changes.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** All students that have a date of birth (used to compute upcoming birthdays). */
export async function getStudentsWithDob(): Promise<StudentRecord[]> {
  const [rows] = await pool.query<StudentRow[]>(
    "SELECT * FROM students WHERE dob IS NOT NULL ORDER BY name ASC"
  );
  return rows.map(rowToStudent);
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

/** Returns distinct sections that exist within a filtered set of students.
 *  Used by the frontend to make the Section dropdown context-aware. */
export async function getFilteredSections(
  params: Pick<FilterParams, 'department' | 'batch' | 'year'>
): Promise<string[]> {
  const conditions: string[] = ["section IS NOT NULL", "section != ''"];
  const values: unknown[] = [];
  if (params.department) { conditions.push('department = ?'); values.push(params.department); }
  if (params.batch)      { conditions.push('batch = ?');      values.push(params.batch); }
  if (params.year)       { conditions.push('year = ?');       values.push(params.year); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const [rows] = await pool.query<Array<{ section: string } & RowDataPacket>>(
    `SELECT DISTINCT section FROM students ${where} ORDER BY section ASC`,
    values
  );
  return rows.map(r => r.section);
}

export async function exportStudents(
  params: FilterParams & { id?: number },
  options: { includeLate?: boolean; includeAchievements?: boolean; includePlacements?: boolean }
): Promise<any[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.id) {
    conditions.push('id = ?');
    values.push(params.id);
  }
  if (params.name) {
    conditions.push('(name LIKE ? OR register_number LIKE ? OR enrollment_number LIKE ?)');
    const like = `%${params.name}%`;
    values.push(like, like, like);
  }
  if (params.department) { conditions.push('department = ?'); values.push(params.department); }
  if (params.batch) { conditions.push('batch = ?'); values.push(params.batch); }
  if (params.section) { conditions.push('section = ?'); values.push(params.section); }
  if (params.blood_group) { conditions.push('blood_group = ?'); values.push(params.blood_group); }
  if (params.year) { conditions.push('year = ?'); values.push(params.year); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<StudentRow[]>(
    `SELECT * FROM students ${where} ORDER BY register_number ASC`,
    values
  );

  if (rows.length === 0) return [];

  const studentIds = rows.map(r => r.id);
  const students = rows.map(rowToStudent) as any[];

  // Fetch optional data
  const dataMap = new Map<number, any>();
  for (const s of students) dataMap.set(s.id, { ...s });

  if (options.includeLate) {
    const [lateRows] = await pool.query<Array<{ student_id: number; late_count: number } & RowDataPacket>>(
      `SELECT student_id, COUNT(*) as late_count FROM late_records WHERE student_id IN (?) GROUP BY student_id`,
      [studentIds]
    );
    for (const r of lateRows) {
      if (dataMap.has(r.student_id)) dataMap.get(r.student_id)!.late_count = Number(r.late_count);
    }
  }

  if (options.includeAchievements) {
    const [achRows] = await pool.query<Array<{ student_id: number; ach_count: number; win_count: number } & RowDataPacket>>(
      `SELECT am.student_id, COUNT(*) as ach_count, SUM(IF(a.result = 'winner', 1, 0)) as win_count 
       FROM achievement_members am JOIN achievements a ON a.id = am.achievement_id 
       WHERE am.student_id IN (?) GROUP BY am.student_id`,
      [studentIds]
    );
    for (const r of achRows) {
      if (dataMap.has(r.student_id)) {
        dataMap.get(r.student_id)!.ach_count = Number(r.ach_count);
        dataMap.get(r.student_id)!.win_count = Number(r.win_count);
      }
    }
  }

  if (options.includePlacements) {
    const [placeRows] = await pool.query<Array<{ student_id: number; companies: string; packages: string } & RowDataPacket>>(
      `SELECT student_id, GROUP_CONCAT(company SEPARATOR ', ') as companies, GROUP_CONCAT(IFNULL(package, '') SEPARATOR ', ') as packages 
       FROM placements WHERE student_id IN (?) GROUP BY student_id`,
      [studentIds]
    );
    for (const r of placeRows) {
      if (dataMap.has(r.student_id)) {
        dataMap.get(r.student_id)!.placed_companies = r.companies;
        dataMap.get(r.student_id)!.placed_packages = r.packages;
      }
    }
  }

  return Array.from(dataMap.values());
}

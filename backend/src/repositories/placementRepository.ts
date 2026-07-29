import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';

export interface Placement {
  id: number;
  student_id: number;
  company: string;
  position: string | null;
  package: string | null;
  placement_type: string;
  offer_type: string | null;
  location: string | null;
  placed_date: string | null;
  created_by: string | null;
  created_at: string;
  offer_letter_url?: string | null;
  // joined student fields (list queries)
  name?: string;
  register_number?: string;
  section?: string;
  batch?: string;
}

export interface PlacementInput {
  company: string;
  position?: string | null;
  package?: string | null;
  placement_type: string;
  offer_type?: string | null;
  location?: string | null;
  placed_date?: string | null;
  offer_letter_url?: string | null;
}

export interface PlacementListResult {
  data: Placement[];
  meta: { page: number; limit: number; total: number };
}

const SELECT_COLS = `p.id, p.student_id, p.company, p.position, p.package, p.placement_type, p.offer_type,
  p.location, DATE_FORMAT(p.placed_date, '%Y-%m-%d') AS placed_date, p.offer_letter_url, p.created_by, p.created_at,
  s.name, s.register_number, s.section, s.batch`;

function normalize(r: Placement & RowDataPacket): Placement {
  return {
    id: Number(r.id),
    student_id: Number(r.student_id),
    company: r.company,
    position: r.position ?? null,
    package: r.package ?? null,
    placement_type: r.placement_type,
    offer_type: r.offer_type ?? null,
    location: r.location ?? null,
    placed_date: r.placed_date ?? null,
    offer_letter_url: r.offer_letter_url ?? null,
    created_by: r.created_by ?? null,
    created_at: r.created_at,
    name: r.name,
    register_number: r.register_number,
    section: r.section,
    batch: r.batch,
  };
}

export async function createPlacement(studentId: number, input: PlacementInput, createdBy: string | null): Promise<number> {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO placements (student_id, company, position, package, placement_type, offer_type, location, placed_date, created_by, offer_letter_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        input.company,
        input.position ?? null,
        input.package ?? null,
        input.placement_type,
        input.offer_type ?? null,
        input.location ?? null,
        input.placed_date ?? null,
        createdBy,
        input.offer_letter_url ?? null,
      ]
    );
    return Number(result.insertId);
  } finally {
    conn.release();
  }
}

export async function updatePlacement(id: number, input: PlacementInput): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    const [res] = await conn.query<ResultSetHeader>(
      `UPDATE placements
       SET company = ?, position = ?, package = ?, placement_type = ?, offer_type = ?, location = ?, placed_date = ?, offer_letter_url = COALESCE(?, offer_letter_url)
       WHERE id = ?`,
      [
        input.company,
        input.position ?? null,
        input.package ?? null,
        input.placement_type,
        input.offer_type ?? null,
        input.location ?? null,
        input.placed_date ?? null,
        input.offer_letter_url !== undefined ? input.offer_letter_url : null,
        id,
      ]
    );
    return res.affectedRows > 0;
  } finally {
    conn.release();
  }
}

export async function deletePlacement(id: number): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>('DELETE FROM placements WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

export async function deleteBatchPlacements(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const [res] = await pool.query<ResultSetHeader>('DELETE FROM placements WHERE id IN (?)', [ids]);
  return res.affectedRows;
}

export interface PlacementFilters {
  q?: string;
  year?: string;
  batch?: string;
  fromDate?: string;
  toDate?: string;
}

export async function listPlacements(f: PlacementFilters, page: number, limit: number): Promise<PlacementListResult> {
  const conds: string[] = [];
  const params: unknown[] = [];

  if (f.q) {
    conds.push('(p.company LIKE ? OR s.name LIKE ? OR s.register_number LIKE ?)');
    params.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`);
  }
  if (f.year) {
    conds.push('s.year = ?');
    params.push(f.year);
  }
  if (f.batch) {
    conds.push('s.batch = ?');
    params.push(f.batch);
  }
  if (f.fromDate) {
    conds.push('p.placed_date >= ?');
    params.push(f.fromDate);
  }
  if (f.toDate) {
    conds.push('p.placed_date <= ?');
    params.push(f.toDate);
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [rows] = await pool.query<Array<Placement & RowDataPacket>>(
    `SELECT ${SELECT_COLS} FROM placements p JOIN students s ON s.id = p.student_id ${where}
     ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query<Array<{ total: number } & RowDataPacket>>(
    `SELECT COUNT(*) AS total FROM placements p JOIN students s ON s.id = p.student_id ${where}`,
    params
  );

  return { data: rows.map(normalize), meta: { page, limit, total: Number(countRows[0]?.total ?? 0) } };
}

export async function listByStudent(studentId: number): Promise<Placement[]> {
  const [rows] = await pool.query<Array<Placement & RowDataPacket>>(
    `SELECT ${SELECT_COLS} FROM placements p JOIN students s ON s.id = p.student_id
     WHERE p.student_id = ? ORDER BY p.created_at DESC, p.id DESC`,
    [studentId]
  );
  return rows.map(normalize);
}

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
}

export interface PlacementListResult {
  data: Placement[];
  meta: { page: number; limit: number; total: number };
}

const SELECT_COLS = `p.id, p.student_id, p.company, p.position, p.package, p.placement_type, p.offer_type,
  p.location, DATE_FORMAT(p.placed_date, '%Y-%m-%d') AS placed_date, p.created_by, p.created_at,
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
    created_by: r.created_by ?? null,
    created_at: r.created_at,
    name: r.name,
    register_number: r.register_number,
    section: r.section,
    batch: r.batch,
  };
}

export async function createPlacement(studentId: number, input: PlacementInput, createdBy: string | null): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO placements (student_id, company, position, package, placement_type, offer_type, location, placed_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [studentId, input.company, input.position ?? null, input.package ?? null, input.placement_type, input.offer_type ?? null, input.location ?? null, input.placed_date ?? null, createdBy]
  );
  return Number(result.insertId);
}

export async function updatePlacement(id: number, input: PlacementInput): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE placements SET company=?, position=?, package=?, placement_type=?, offer_type=?, location=?, placed_date=? WHERE id=?`,
    [input.company, input.position ?? null, input.package ?? null, input.placement_type, input.offer_type ?? null, input.location ?? null, input.placed_date ?? null, id]
  );
  return res.affectedRows > 0;
}

export async function deletePlacement(id: number): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>('DELETE FROM placements WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

export async function listPlacements(q: string | undefined, page: number, limit: number): Promise<PlacementListResult> {
  const where = q ? 'WHERE p.company LIKE ? OR s.name LIKE ? OR s.register_number LIKE ?' : '';
  const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
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

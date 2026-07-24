import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';

export interface CircularRecord {
  id: number;
  title: string;
  content: string;
  target_audience: string;
  priority: string;
  created_by: string;
  created_at: string;
}

export async function findAllCirculars(): Promise<CircularRecord[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, title, content, target_audience, priority, created_by, created_at FROM circulars ORDER BY created_at DESC'
  );
  return rows as CircularRecord[];
}

export async function createCircular(
  title: string,
  content: string,
  target_audience: string,
  priority: string,
  created_by: string
): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    'INSERT INTO circulars (title, content, target_audience, priority, created_by) VALUES (?, ?, ?, ?, ?)',
    [title, content, target_audience, priority, created_by]
  );
  return res.insertId;
}

export async function deleteCircular(id: number): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>(
    'DELETE FROM circulars WHERE id = ?',
    [id]
  );
  return res.affectedRows > 0;
}

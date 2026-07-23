import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';

export type Role = 'superadmin' | 'admin' | 'user' | 'cr';

export interface UserRecord {
  id: number;
  username: string;
  name: string | null;
  role: Role;
  created_by: string | null;
  created_at: string;
}

interface UserWithHash extends UserRecord {
  password_hash: string;
}

function toRecord(r: UserRecord & RowDataPacket): UserRecord {
  return { id: Number(r.id), username: r.username, name: r.name ?? null, role: r.role, created_by: r.created_by ?? null, created_at: r.created_at };
}

export async function findByUsername(username: string): Promise<UserWithHash | null> {
  const [rows] = await pool.query<Array<UserWithHash & RowDataPacket>>(
    'SELECT id, username, name, password_hash, role, created_by, created_at FROM users WHERE username = ? LIMIT 1',
    [username]
  );
  return rows[0] ?? null;
}

export async function createUser(username: string, name: string | null, passwordHash: string, role: Role, createdBy: string | null): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO users (username, name, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?)',
    [username, name, passwordHash, role, createdBy]
  );
  return Number(result.insertId);
}

export async function listUsers(): Promise<UserRecord[]> {
  const [rows] = await pool.query<Array<UserRecord & RowDataPacket>>(
    'SELECT id, username, name, role, created_by, created_at FROM users ORDER BY created_at ASC, id ASC'
  );
  return rows.map(toRecord);
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  const [rows] = await pool.query<Array<UserRecord & RowDataPacket>>(
    'SELECT id, username, name, role, created_by, created_at FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function updateUser(
  id: number,
  fields: { name?: string; role?: Role; passwordHash?: string }
): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.name !== undefined) { sets.push('name = ?'); vals.push(fields.name); }
  if (fields.role !== undefined) { sets.push('role = ?'); vals.push(fields.role); }
  if (fields.passwordHash !== undefined) { sets.push('password_hash = ?'); vals.push(fields.passwordHash); }
  if (sets.length === 0) return;
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
}

export async function deleteUser(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function countByRole(role: Role): Promise<number> {
  const [rows] = await pool.query<Array<{ c: number } & RowDataPacket>>(
    'SELECT COUNT(*) AS c FROM users WHERE role = ?',
    [role]
  );
  return Number(rows[0]?.c ?? 0);
}

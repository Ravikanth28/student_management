import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';

export async function getSetting(name: string): Promise<string | null> {
  const [rows] = await pool.query<Array<{ value: string | null } & RowDataPacket>>(
    'SELECT value FROM app_settings WHERE name = ? LIMIT 1',
    [name],
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(name: string, value: string): Promise<void> {
  await pool.query(
    `INSERT INTO app_settings (name, value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [name, value],
  );
}

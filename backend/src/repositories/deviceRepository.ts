import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';

/** Upsert a device push token, tagging it with the current user + role. */
export async function upsertToken(
  token: string,
  username: string | null,
  role: string | null,
  platform: string | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO device_tokens (token, username, role, platform)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE username = VALUES(username), role = VALUES(role), platform = VALUES(platform)`,
    [token, username, role, platform],
  );
}

/** All registered tokens, optionally excluding one user's own devices. */
export async function listTokens(exceptUsername?: string | null): Promise<string[]> {
  const [rows] = exceptUsername
    ? await pool.query<Array<{ token: string } & RowDataPacket>>(
        'SELECT token FROM device_tokens WHERE username IS NULL OR username <> ?',
        [exceptUsername],
      )
    : await pool.query<Array<{ token: string } & RowDataPacket>>('SELECT token FROM device_tokens');
  return rows.map((r) => r.token);
}

export async function deleteTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await pool.query('DELETE FROM device_tokens WHERE token IN (?)', [tokens]);
}

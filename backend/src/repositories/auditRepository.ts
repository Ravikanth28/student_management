import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';

export interface AuditEntry {
  action: string;
  entity?: string | null;
  entity_id?: string | null;
  actor?: string | null;
  status?: 'success' | 'failure';
  details?: string | null;
  ip?: string | null;
}

export interface AuditRecord extends AuditEntry {
  id: number;
  status: 'success' | 'failure';
  created_at: string;
}

export interface AuditListResult {
  data: AuditRecord[];
  meta: { page: number; limit: number; total: number };
}

type AuditRow = RowDataPacket & AuditRecord;

export async function insertAudit(entry: AuditEntry): Promise<void> {
  await pool.query<ResultSetHeader>(
    `INSERT INTO audit_logs (action, entity, entity_id, actor, status, details, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.action,
      entry.entity ?? null,
      entry.entity_id ?? null,
      entry.actor ?? null,
      entry.status ?? 'success',
      entry.details ?? null,
      entry.ip ?? null,
    ]
  );
}

export async function listAudit(
  page: number,
  limit: number,
  action?: string
): Promise<AuditListResult> {
  const offset = (page - 1) * limit;
  const where = action ? 'WHERE action = ?' : '';
  const filterParams = action ? [action] : [];

  const [rows] = await pool.query<AuditRow[]>(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...filterParams, limit, offset]
  );
  const [countRows] = await pool.query<Array<{ total: number } & RowDataPacket>>(
    `SELECT COUNT(*) AS total FROM audit_logs ${where}`,
    filterParams
  );

  return {
    data: rows.map((r) => ({
      id: Number(r.id),
      action: r.action,
      entity: r.entity ?? null,
      entity_id: r.entity_id ?? null,
      actor: r.actor ?? null,
      status: r.status,
      details: r.details ?? null,
      ip: r.ip ?? null,
      created_at: r.created_at,
    })),
    meta: { page, limit, total: Number(countRows[0]?.total ?? 0) },
  };
}

/** Distinct action names, for the filter dropdown. */
export async function listAuditActions(): Promise<string[]> {
  const [rows] = await pool.query<Array<{ action: string } & RowDataPacket>>(
    'SELECT DISTINCT action FROM audit_logs ORDER BY action ASC'
  );
  return rows.map((r) => r.action);
}

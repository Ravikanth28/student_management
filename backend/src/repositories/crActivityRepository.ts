import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';

// ─── Simple built-in UA parser (no external dependency) ─────────
function parseUA(ua: string): { browser: string; os: string; device_type: string } {
  let browser = 'Unknown';
  let os = 'Unknown';
  let device_type = 'Desktop';

  // Device type
  if (/Mobile|iPhone|iPod|Android(?!.*Tablet)/i.test(ua)) device_type = 'Mobile';
  else if (/iPad|Tablet/i.test(ua)) device_type = 'Tablet';

  // Browser — order matters: Edge & OPR must precede Chrome, Safari
  if (/Edg\//i.test(ua)) {
    const m = ua.match(/Edg\/([\d]+)/);
    browser = `Edge ${m?.[1] ?? ''}`.trim();
  } else if (/OPR\//i.test(ua)) {
    const m = ua.match(/OPR\/([\d]+)/);
    browser = `Opera ${m?.[1] ?? ''}`.trim();
  } else if (/Firefox\/([\d]+)/i.test(ua)) {
    const m = ua.match(/Firefox\/([\d]+)/);
    browser = `Firefox ${m?.[1] ?? ''}`.trim();
  } else if (/Chrome\/([\d]+)/i.test(ua)) {
    const m = ua.match(/Chrome\/([\d]+)/);
    browser = `Chrome ${m?.[1] ?? ''}`.trim();
  } else if (/Version\/[\d.]+ Safari\//i.test(ua)) {
    browser = 'Safari';
  }

  // OS
  if (/Windows NT 10/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6\.3/i.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6\.1/i.test(ua)) os = 'Windows 7';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android ([\d.]+)/i.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    os = `Android ${m?.[1] ?? ''}`.trim();
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS';
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  return { browser, os, device_type };
}

// ─── Types ───────────────────────────────────────────────────────
export interface CRActivityRecord {
  id: number;
  submitted_at: string;
  att_date: string;
  year: string;
  section: string;
  absent_count: number;
  absent_names: string | null;
  ip_address: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
}

export interface CRActivityListResult {
  data: CRActivityRecord[];
  meta: { page: number; limit: number; total: number };
}

// ─── Helpers ─────────────────────────────────────────────────────
async function getStudentNamesByIds(ids: number[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query<Array<{ name: string } & RowDataPacket>>(
    `SELECT name FROM students WHERE id IN (${placeholders}) ORDER BY name ASC`,
    ids
  );
  return rows.map((r) => r.name);
}

// ─── Repository Functions ─────────────────────────────────────────

/** Fire-and-forget: insert a CR activity log entry. */
export async function insertCRActivity(params: {
  att_date: string;
  year: string;
  section: string;
  absentIds: number[];
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const names = await getStudentNamesByIds(params.absentIds);
  const parsed = params.userAgent
    ? parseUA(params.userAgent)
    : { browser: null, os: null, device_type: null };

  await pool.query<ResultSetHeader>(
    `INSERT INTO cr_activity_log
       (att_date, year, section, absent_count, absent_names,
        ip_address, user_agent, browser, os, device_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.att_date,
      params.year,
      params.section,
      params.absentIds.length,
      names.length > 0 ? names.join(', ') : null,
      params.ip,
      params.userAgent,
      parsed.browser,
      parsed.os,
      parsed.device_type,
    ]
  );
}

/** Paginated list of CR activity logs with optional filters. */
export async function listCRActivity(
  page: number,
  limit: number,
  filters: { year?: string; section?: string; from?: string; to?: string }
): Promise<CRActivityListResult> {
  const offset = (page - 1) * limit;
  const cond: string[] = [];
  const vals: unknown[] = [];

  if (filters.from)    { cond.push('DATE(submitted_at) >= ?'); vals.push(filters.from); }
  if (filters.to)      { cond.push('DATE(submitted_at) <= ?'); vals.push(filters.to); }
  if (filters.year)    { cond.push('year = ?');                vals.push(filters.year); }
  if (filters.section) { cond.push('section = ?');             vals.push(filters.section); }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

  const [rows] = await pool.query<Array<CRActivityRecord & RowDataPacket>>(
    `SELECT id, submitted_at, att_date, year, section, absent_count,
            absent_names, ip_address, browser, os, device_type
     FROM cr_activity_log ${where}
     ORDER BY submitted_at DESC
     LIMIT ? OFFSET ?`,
    [...vals, limit, offset]
  );
  const [countRows] = await pool.query<Array<{ total: number } & RowDataPacket>>(
    `SELECT COUNT(*) AS total FROM cr_activity_log ${where}`,
    vals
  );

  return {
    data: rows.map((r) => ({
      id: Number(r.id),
      submitted_at: String(r.submitted_at),
      att_date: String(r.att_date),
      year: r.year,
      section: r.section,
      absent_count: Number(r.absent_count),
      absent_names: r.absent_names ?? null,
      ip_address: r.ip_address ?? null,
      browser: r.browser ?? null,
      os: r.os ?? null,
      device_type: r.device_type ?? null,
    })),
    meta: { page, limit, total: Number(countRows[0]?.total ?? 0) },
  };
}

import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';

export interface AchievementMember {
  student_id: number;
  name: string;
  register_number: string;
  section: string;
  year: string | null;
  batch: string;
}

export interface Achievement {
  id: number;
  event_type: string | null;
  title: string;
  venue: string | null;
  duration: string | null;
  result: string;
  position: string | null;
  prize: string | null;
  event_date: string | null;
  created_by: string | null;
  created_at: string;
  members: AchievementMember[];
}

export interface AchievementInput {
  event_type?: string | null;
  title: string;
  venue?: string | null;
  duration?: string | null;
  result: string;
  position?: string | null;
  prize?: string | null;
  event_date?: string | null;
}

export interface AchievementListResult {
  data: Achievement[];
  meta: { page: number; limit: number; total: number };
}

export async function createAchievement(
  input: AchievementInput,
  memberIds: number[],
  createdBy: string | null
): Promise<number> {
  const conn: PoolConnection = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO achievements (event_type, title, venue, duration, result, position, prize, event_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.event_type ?? null,
        input.title,
        input.venue ?? null,
        input.duration ?? null,
        input.result,
        input.position ?? null,
        input.prize ?? null,
        input.event_date ?? null,
        createdBy,
      ]
    );
    const achievementId = Number(result.insertId);

    const uniqueIds = [...new Set(memberIds)];
    if (uniqueIds.length > 0) {
      await conn.query(
        `INSERT INTO achievement_members (achievement_id, student_id) VALUES ${uniqueIds.map(() => '(?, ?)').join(', ')}`,
        uniqueIds.flatMap((id) => [achievementId, id])
      );
    }

    await conn.commit();
    return achievementId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Attach member lists to a set of achievements. */
async function attachMembers(achievements: Array<Achievement & RowDataPacket>): Promise<Achievement[]> {
  if (achievements.length === 0) return [];
  const ids = achievements.map((a) => Number(a.id));
  const [memberRows] = await pool.query<Array<{ achievement_id: number } & AchievementMember & RowDataPacket>>(
    `SELECT am.achievement_id, s.id AS student_id, s.name, s.register_number, s.section, s.year, s.batch
     FROM achievement_members am
     JOIN students s ON s.id = am.student_id
     WHERE am.achievement_id IN (${ids.map(() => '?').join(', ')})
     ORDER BY s.name ASC`,
    ids
  );

  const byAchievement = new Map<number, AchievementMember[]>();
  for (const m of memberRows) {
    const list = byAchievement.get(Number(m.achievement_id)) ?? [];
    list.push({
      student_id: Number(m.student_id),
      name: m.name,
      register_number: m.register_number,
      section: m.section,
      year: m.year ?? null,
      batch: m.batch,
    });
    byAchievement.set(Number(m.achievement_id), list);
  }

  return achievements.map((a) => normalize(a, byAchievement.get(Number(a.id)) ?? []));
}

export interface AchievementFilters {
  q?: string;
  year?: string;
  batch?: string;
  fromDate?: string;
  toDate?: string;
}

export async function listAchievements(f: AchievementFilters, page: number, limit: number): Promise<AchievementListResult> {
  const conds: string[] = [];
  const params: unknown[] = [];

  if (f.q) {
    conds.push('(title LIKE ? OR venue LIKE ?)');
    params.push(`%${f.q}%`, `%${f.q}%`);
  }
  if (f.fromDate) {
    conds.push('event_date >= ?');
    params.push(f.fromDate);
  }
  if (f.toDate) {
    conds.push('event_date <= ?');
    params.push(f.toDate);
  }
  
  if (f.year || f.batch) {
    let subConds = [];
    if (f.year) { subConds.push('s.year = ?'); params.push(f.year); }
    if (f.batch) { subConds.push('s.batch = ?'); params.push(f.batch); }
    conds.push(`EXISTS (SELECT 1 FROM achievement_members am JOIN students s ON s.id = am.student_id WHERE am.achievement_id = achievements.id AND ${subConds.join(' AND ')})`);
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [rows] = await pool.query<Array<Achievement & RowDataPacket>>(
    `SELECT id, event_type, title, venue, duration, result, position, prize,
            DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date, created_by, created_at
     FROM achievements ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query<Array<{ total: number } & RowDataPacket>>(
    `SELECT COUNT(*) AS total FROM achievements ${where}`,
    params
  );

  return {
    data: await attachMembers(rows),
    meta: { page, limit, total: Number(countRows[0]?.total ?? 0) },
  };
}

export interface AchievementSummaryRow {
  student_id: number;
  name: string;
  register_number: string;
  section: string;
  year: string | null;
  total: number;
  wins: number;
  participated: number;
}

/** Per-student achievement totals (wins vs participated), most achievements first. */
export async function summarizeByStudent(f: { year?: string; section?: string; batch?: string; fromDate?: string; toDate?: string; q?: string }): Promise<AchievementSummaryRow[]> {
  const conds: string[] = [];
  const vals: unknown[] = [];
  if (f.year) { conds.push('s.year = ?'); vals.push(f.year); }
  if (f.section) { conds.push('s.section = ?'); vals.push(f.section); }
  if (f.batch) { conds.push('s.batch = ?'); vals.push(f.batch); }
  if (f.fromDate) { conds.push('a.event_date >= ?'); vals.push(f.fromDate); }
  if (f.toDate) { conds.push('a.event_date <= ?'); vals.push(f.toDate); }
  if (f.q) { conds.push('(s.name LIKE ? OR s.register_number LIKE ?)'); vals.push(`%${f.q}%`, `%${f.q}%`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const [rows] = await pool.query<Array<AchievementSummaryRow & RowDataPacket>>(
    `SELECT s.id AS student_id, s.name, s.register_number, s.section, s.year,
            COUNT(*) AS total,
            SUM(a.result = 'winner') AS wins,
            SUM(a.result = 'participated') AS participated
       FROM achievement_members am
       JOIN achievements a ON a.id = am.achievement_id
       JOIN students s ON s.id = am.student_id
       ${where}
      GROUP BY s.id, s.name, s.register_number, s.section, s.year
      ORDER BY total DESC, s.name ASC`,
    vals,
  );
  return rows.map((r) => ({
    student_id: Number(r.student_id),
    name: r.name,
    register_number: r.register_number,
    section: r.section,
    year: r.year ?? null,
    total: Number(r.total),
    wins: Number(r.wins),
    participated: Number(r.participated),
  }));
}

export async function listAchievementsByStudent(studentId: number): Promise<Achievement[]> {
  const [rows] = await pool.query<Array<Achievement & RowDataPacket>>(
    `SELECT a.id, a.event_type, a.title, a.venue, a.duration, a.result, a.position, a.prize,
            DATE_FORMAT(a.event_date, '%Y-%m-%d') AS event_date, a.created_by, a.created_at
     FROM achievements a
     JOIN achievement_members am ON am.achievement_id = a.id
     WHERE am.student_id = ?
     ORDER BY a.created_at DESC, a.id DESC`,
    [studentId]
  );
  return attachMembers(rows);
}

export async function updateAchievement(
  id: number,
  input: AchievementInput,
  memberIds: number[]
): Promise<boolean> {
  const conn: PoolConnection = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.query<ResultSetHeader>(
      `UPDATE achievements
       SET event_type = ?, title = ?, venue = ?, duration = ?, result = ?, position = ?, prize = ?, event_date = ?
       WHERE id = ?`,
      [
        input.event_type ?? null,
        input.title,
        input.venue ?? null,
        input.duration ?? null,
        input.result,
        input.position ?? null,
        input.prize ?? null,
        input.event_date ?? null,
        id,
      ]
    );
    if (res.affectedRows === 0) { await conn.rollback(); return false; }

    // Replace the member set.
    await conn.query('DELETE FROM achievement_members WHERE achievement_id = ?', [id]);
    const uniqueIds = [...new Set(memberIds)];
    if (uniqueIds.length > 0) {
      await conn.query(
        `INSERT INTO achievement_members (achievement_id, student_id) VALUES ${uniqueIds.map(() => '(?, ?)').join(', ')}`,
        uniqueIds.flatMap((sid) => [id, sid])
      );
    }
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Remove one student from an achievement. If no members remain afterwards,
 *  the achievement itself is deleted. */
export async function removeMember(
  achievementId: number,
  studentId: number
): Promise<{ removed: boolean; achievementDeleted: boolean }> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.query<ResultSetHeader>(
      'DELETE FROM achievement_members WHERE achievement_id = ? AND student_id = ?',
      [achievementId, studentId]
    );
    let achievementDeleted = false;
    if (res.affectedRows > 0) {
      const [countRows] = await conn.query<Array<{ c: number } & RowDataPacket>>(
        'SELECT COUNT(*) AS c FROM achievement_members WHERE achievement_id = ?',
        [achievementId]
      );
      if (Number(countRows[0]?.c ?? 0) === 0) {
        await conn.query('DELETE FROM achievements WHERE id = ?', [achievementId]);
        achievementDeleted = true;
      }
    }
    await conn.commit();
    return { removed: res.affectedRows > 0, achievementDeleted };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteAchievement(id: number): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM achievement_members WHERE achievement_id = ?', [id]);
    const [res] = await conn.query<ResultSetHeader>('DELETE FROM achievements WHERE id = ?', [id]);
    await conn.commit();
    return res.affectedRows > 0;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function normalize(a: Achievement & RowDataPacket, members: AchievementMember[]): Achievement {
  return {
    id: Number(a.id),
    event_type: a.event_type ?? null,
    title: a.title,
    venue: a.venue ?? null,
    duration: a.duration ?? null,
    result: a.result,
    position: a.position ?? null,
    prize: a.prize ?? null,
    event_date: a.event_date ?? null,
    created_by: a.created_by ?? null,
    created_at: a.created_at,
    members,
  };
}

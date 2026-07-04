import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';

export interface AchievementMember {
  student_id: number;
  name: string;
  register_number: string;
  section: string;
  batch: string;
}

export interface Achievement {
  id: number;
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
      `INSERT INTO achievements (title, venue, duration, result, position, prize, event_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
    `SELECT am.achievement_id, s.id AS student_id, s.name, s.register_number, s.section, s.batch
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
      batch: m.batch,
    });
    byAchievement.set(Number(m.achievement_id), list);
  }

  return achievements.map((a) => normalize(a, byAchievement.get(Number(a.id)) ?? []));
}

export async function listAchievements(q: string | undefined, page: number, limit: number): Promise<AchievementListResult> {
  const where = q ? 'WHERE title LIKE ? OR venue LIKE ?' : '';
  const params = q ? [`%${q}%`, `%${q}%`] : [];
  const offset = (page - 1) * limit;

  const [rows] = await pool.query<Array<Achievement & RowDataPacket>>(
    `SELECT * FROM achievements ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
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

export async function listAchievementsByStudent(studentId: number): Promise<Achievement[]> {
  const [rows] = await pool.query<Array<Achievement & RowDataPacket>>(
    `SELECT a.* FROM achievements a
     JOIN achievement_members am ON am.achievement_id = a.id
     WHERE am.student_id = ?
     ORDER BY a.created_at DESC, a.id DESC`,
    [studentId]
  );
  return attachMembers(rows);
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

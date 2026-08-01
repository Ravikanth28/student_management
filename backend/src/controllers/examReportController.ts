import type { Request, Response } from 'express';
import { pool } from '../config/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export const getTestReport = async (req: Request, res: Response) => {
  const { testId } = req.params;
  try {
    // Get year of the exam card via test -> subject -> card
    const [cardRows] = await pool.query<RowDataPacket[]>(
      `SELECT ec.year_assigned 
       FROM exam_tests et
       JOIN exam_subjects es ON et.subject_id = es.id
       JOIN exam_cards ec ON es.card_id = ec.id
       WHERE et.id = ?`,
      [testId]
    );

    if (!cardRows.length) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const yearAssigned = cardRows[0].year_assigned;

    // Fetch all students in that year, their teacher mark, and aggregate student marks
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        s.id AS student_id,
        s.name,
        s.enrollment_number,
        s.register_number,
        s.section,
        tm.teacher_score,
        (
          SELECT SUM(esm.score) 
          FROM exam_student_marks esm
          JOIN exam_mark_splits ems ON esm.split_id = ems.id
          WHERE ems.test_id = ? AND esm.student_id = s.id
        ) AS student_total
      FROM students s
      LEFT JOIN exam_teacher_marks tm ON tm.student_id = s.id AND tm.test_id = ?
      WHERE s.year = ?
      ORDER BY s.name ASC
    `, [testId, testId, yearAssigned]);

    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching test report:', error);
    res.status(500).json({ error: 'Failed to fetch test report' });
  }
};

export const uploadTeacherMarks = async (req: Request, res: Response) => {
  const { testId } = req.params;
  // expects body: { marks: { enrollment_number: string, mark: number }[] }
  const { marks } = req.body;

  if (!marks || !Array.isArray(marks)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const entry of marks) {
      const { enrollment_number, mark } = entry;
      // Get student_id from enrollment_number
      const [students] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM students WHERE enrollment_number = ? LIMIT 1`,
        [enrollment_number]
      );

      if (students.length > 0) {
        const studentId = students[0].id;
        await conn.query(
          `INSERT INTO exam_teacher_marks (test_id, student_id, teacher_score)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE teacher_score = VALUES(teacher_score)`,
          [testId, studentId, mark]
        );
      }
    }

    await conn.commit();
    res.json({ message: 'Marks uploaded successfully' });
  } catch (error) {
    await conn.rollback();
    console.error('Error uploading marks:', error);
    res.status(500).json({ error: 'Failed to upload marks' });
  } finally {
    conn.release();
  }
};

export const updateManualMark = async (req: Request, res: Response) => {
  const { testId } = req.params;
  const { student_id, mark } = req.body;

  if (!student_id || mark === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await pool.query(
      `INSERT INTO exam_teacher_marks (test_id, student_id, teacher_score)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE teacher_score = VALUES(teacher_score)`,
      [testId, student_id, mark]
    );

    res.json({ message: 'Mark updated successfully' });
  } catch (error) {
    console.error('Error updating mark manually:', error);
    res.status(500).json({ error: 'Failed to update mark' });
  }
};

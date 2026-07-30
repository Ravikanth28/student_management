import type { Request, Response } from 'express';
import { pool } from '../config/db.js';
import { logger } from '../config/logger.js';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Submit feedback (student only).
 */
export async function submitFeedback(req: Request, res: Response) {
  try {
    const studentId = req.user?.student_id;
    if (!studentId || req.user?.role !== 'student') {
      return res.status(403).json({ message: 'Only students can submit feedback.' });
    }

    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ message: 'Feedback content is required.' });
    }

    await pool.query(
      'INSERT INTO feedback (student_id, content) VALUES (?, ?)',
      [studentId, content.trim()]
    );

    res.status(201).json({ message: 'Feedback submitted successfully.' });
  } catch (err) {
    logger.error('Error submitting feedback:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

/**
 * Get all feedback (superadmin only).
 */
export async function getFeedback(req: Request, res: Response) {
  try {
    // Left join with students to get student details
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        f.id, 
        f.content, 
        f.created_at, 
        s.id AS student_id,
        s.name AS student_name, 
        s.register_number, 
        s.department, 
        s.year, 
        s.section,
        s.photo_url
      FROM feedback f
      LEFT JOIN students s ON f.student_id = s.id
      ORDER BY f.created_at DESC
    `);
    
    res.json({ data: rows });
  } catch (err) {
    logger.error('Error fetching feedback:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

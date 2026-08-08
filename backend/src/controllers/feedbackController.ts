import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { HttpError } from '../middleware/error.js';
import * as audit from '../services/auditService.js';
import { getStaffById, getStaffByUserId } from '../repositories/staffRepository.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

// 1. Submit general feedback (Student)
const submitSchema = z.object({
  content: z.string().min(1, 'Feedback content is required'),
});

export const submitFeedback = asyncWrap(async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.errors[0]?.message || 'Invalid data');
  }
  const { content } = parsed.data;
  const studentId = req.user?.role === 'student' ? (req.user as any).student_id : null;

  const [result] = await pool.query<any>(
    'INSERT INTO feedbacks (student_id, content) VALUES (?, ?)',
    [studentId, content]
  );
  
  await pool.query(
    'INSERT INTO feedback_messages (feedback_id, sender_type, sender_id, message) VALUES (?, ?, ?, ?)',
    [result.insertId, 'student', studentId, content]
  );

  audit.record(req, {
    action: 'feedback.submit',
    entity: 'feedback',
    entity_id: result.insertId.toString(),
  });

  return res.status(201).json({ id: result.insertId, message: 'Feedback submitted successfully' });
});

// 1a. Get student's own feedback
export const getStudentMyFeedback = asyncWrap(async (req, res) => {
  const studentId = req.user?.role === 'student' ? (req.user as any).student_id : null;
  if (!studentId) throw new HttpError(403, 'Unauthorized');

  const [rows] = await pool.query<any>(`
    SELECT id, content, status, created_at
    FROM feedbacks f
    WHERE student_id = ?
    ORDER BY COALESCE((SELECT MAX(created_at) FROM feedback_messages WHERE feedback_id = f.id), f.created_at) DESC
  `, [studentId]);
  
  return res.json(rows);
});

// 2. Get pending feedback (Superadmin)
export const getPendingFeedback = asyncWrap(async (req, res) => {
  const [rows] = await pool.query<any>(`
    SELECT f.*, s.name as student_name, s.department as student_department, s.batch as student_batch, s.enrollment_number as student_enrollment_number, s.photo_url as student_photo
    FROM feedbacks f
    LEFT JOIN students s ON f.student_id = s.id
    WHERE f.status = 'pending'
    ORDER BY COALESCE((SELECT MAX(created_at) FROM feedback_messages WHERE feedback_id = f.id), f.created_at) DESC
  `);
  return res.json(rows);
});

// 3. Forward feedback to staff (Superadmin)
const forwardSchema = z.object({
  staff_id: z.number(),
});

export const forwardFeedback = asyncWrap(async (req, res) => {
  const { id } = req.params;
  const parsed = forwardSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, 'staff_id is required');
  }

  const { staff_id } = parsed.data;

  // Verify staff exists
  const staff = await getStaffById(staff_id);
  if (!staff) {
    throw new HttpError(404, 'Staff member not found');
  }

  const [rows] = await pool.query<any>('SELECT student_id, content FROM feedbacks WHERE id = ?', [id]);
  if (rows.length === 0) {
    throw new HttpError(404, 'Feedback not found');
  }

  const { student_id, content } = rows[0];

  await pool.query(
    'INSERT INTO feedbacks (student_id, staff_id, content, status) VALUES (?, ?, ?, ?)',
    [student_id, staff_id, content, 'forwarded']
  );

  audit.record(req, {
    action: 'feedback.forward',
    entity: 'feedback',
    entity_id: id as string,
    details: `Forwarded to staff ${staff_id}`
  });

  return res.json({ message: 'Feedback forwarded successfully' });
});

// 4. Discard/Delete feedback (Superadmin & Admin)
export const deleteFeedback = asyncWrap(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  if (user?.role === 'admin') {
    const profile = (user as any).staff_profile;
    if (!profile) throw new HttpError(403, 'Unauthorized');
    
    const [rows] = await pool.query<any>('SELECT staff_id FROM feedbacks WHERE id = ?', [id]);
    if (rows.length === 0) throw new HttpError(404, 'Feedback not found');
    if (rows[0].staff_id !== profile.id) throw new HttpError(403, 'Unauthorized to delete this feedback');
  }

  await pool.query('DELETE FROM feedbacks WHERE id = ?', [id]);

  audit.record(req, {
    action: 'feedback.delete',
    entity: 'feedback',
    entity_id: id as string,
  });

  return res.status(204).send();
});

// 5. Get My Feedback (Teacher)
export const getMyFeedback = asyncWrap(async (req, res) => {
  const user = req.user;
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    throw new HttpError(403, 'Unauthorized');
  }
  
  // We need the staff profile ID of the logged in user
  const profile = (user as any).staff_profile;
  if (!profile) {
     return res.json([]); // No profile = no feedback
  }

  const [rows] = await pool.query<any>(`
    SELECT id, content, staff_reply, status, created_at 
    FROM feedbacks f
    WHERE staff_id = ? AND status IN ('forwarded', 'replied')
    ORDER BY COALESCE((SELECT MAX(created_at) FROM feedback_messages WHERE feedback_id = f.id), f.created_at) DESC
  `, [profile.id]);
  
  console.log('[DEBUG] getMyFeedback rows:', rows);

  return res.json(rows);
});

// 5a. Get Messages for a Feedback Thread
export const getFeedbackMessages = asyncWrap(async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  
  const [feedbackRows] = await pool.query<any>('SELECT student_id, staff_id FROM feedbacks WHERE id = ?', [id]);
  if (feedbackRows.length === 0) throw new HttpError(404, 'Feedback not found');
  const feedback = feedbackRows[0];
  
  if (user?.role === 'student') {
    const studentId = (user as any).student_id;
    if (feedback.student_id !== studentId) throw new HttpError(403, 'Unauthorized');
  } else if (user?.role === 'admin') {
    const profile = (user as any).staff_profile;
    if (feedback.staff_id !== profile?.id) throw new HttpError(403, 'Unauthorized');
  }
  
  const [messages] = await pool.query<any>(`
    SELECT id, sender_type, sender_id, message, created_at
    FROM feedback_messages
    WHERE feedback_id = ?
    ORDER BY created_at ASC
  `, [id]);
  
  return res.json(messages);
});

// 5b. Post a Message to a Feedback Thread
const messageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
});

export const postFeedbackMessage = asyncWrap(async (req, res) => {
  const { id } = req.params;
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.errors[0]?.message || 'Invalid data');
  const { message } = parsed.data;
  
  const user = req.user;
  let senderType = 'student';
  let senderId = null;

  const [feedbackRows] = await pool.query<any>('SELECT student_id, staff_id FROM feedbacks WHERE id = ?', [id]);
  if (feedbackRows.length === 0) throw new HttpError(404, 'Feedback not found');
  const feedback = feedbackRows[0];

  if (user?.role === 'student') {
    senderId = (user as any).student_id;
    if (feedback.student_id !== senderId) throw new HttpError(403, 'Unauthorized');
    senderType = 'student';
  } else if (user?.role === 'admin') {
    senderId = (user as any).staff_profile?.id;
    if (feedback.staff_id !== senderId) throw new HttpError(403, 'Unauthorized');
    senderType = 'staff';
    
    // Update feedback status to replied if staff is replying
    await pool.query('UPDATE feedbacks SET status = ?, staff_reply = ? WHERE id = ?', ['replied', message, id]);
  } else if (user?.role === 'superadmin') {
     senderType = 'superadmin';
     senderId = user.sub;
  } else {
    throw new HttpError(403, 'Unauthorized');
  }

  const [result] = await pool.query<any>(
    'INSERT INTO feedback_messages (feedback_id, sender_type, sender_id, message) VALUES (?, ?, ?, ?)',
    [id, senderType, senderId, message]
  );
  
  audit.record(req, {
    action: 'feedback.message',
    entity: 'feedback',
    entity_id: id as string,
    details: `Sender: ${senderType}`
  });

  return res.status(201).json({ id: result.insertId, message: 'Message sent successfully' });
});

// 6. Get Staff List (Superadmin)
export const getStaffList = asyncWrap(async (req, res) => {
  const [rows] = await pool.query<any>('SELECT id, name, department, emp_id, photo_url FROM staff ORDER BY name ASC');
  return res.json(rows);
});

// 7. Get Replied Feedback (Superadmin)
export const getRepliedFeedback = asyncWrap(async (req, res) => {
  const [rows] = await pool.query<any>(`
    SELECT f.*, 
           s.name as student_name, s.department as student_department, s.batch as student_batch, s.enrollment_number as student_enrollment_number, s.photo_url as student_photo,
           st.name as staff_name, st.department as staff_department, st.photo_url as staff_photo
    FROM feedbacks f
    LEFT JOIN students s ON f.student_id = s.id
    LEFT JOIN staff st ON f.staff_id = st.id
    WHERE f.status = 'replied'
    ORDER BY COALESCE((SELECT MAX(created_at) FROM feedback_messages WHERE feedback_id = f.id), f.created_at) DESC
  `);
  return res.json(rows);
});

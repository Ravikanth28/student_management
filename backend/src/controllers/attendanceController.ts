import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../middleware/error.js';
import * as attendanceRepo from '../repositories/attendanceRepository.js';
import * as audit from '../services/auditService.js';
import { notifyAllInBackground } from '../services/notificationService.js';
import { pool } from '../config/db.js';
import type { RowDataPacket } from 'mysql2/promise';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

/** YYYY-MM-DD in IST. */
function today(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// GET /api/attendance/roster?year=&section=
export const getRoster = asyncWrap(async (req, res) => {
  const year = String(req.query.year ?? '').trim();
  const section = String(req.query.section ?? '').trim();
  if (!year || !section) throw new HttpError(400, 'year and section are required');
  return res.json({ data: await attendanceRepo.getRoster(year, section) });
});

// POST /api/attendance  { date?, year, section, absentee_ids: number[] }
export const saveAttendance = asyncWrap(async (req, res) => {
  const year = String(req.body?.year ?? '').trim();
  const section = String(req.body?.section ?? '').trim();
  const date = String(req.body?.date ?? '').trim() || today();
  const absenteeIds: number[] = Array.isArray(req.body?.absentee_ids)
    ? req.body.absentee_ids.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)
    : [];
  if (!year || !section) throw new HttpError(400, 'year and section are required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'date must be YYYY-MM-DD');

  const result = await attendanceRepo.saveDay(date, year, section, absenteeIds, req.user?.username ?? null);
  if (result.present === 0 && result.absent === 0) {
    throw new HttpError(404, 'No students found for that year and section');
  }

  audit.record(req, {
    action: 'attendance.save',
    entity: 'attendance',
    details: `${date} — Year ${year} Sec ${section}: ${result.present} present, ${result.absent} absent`,
  });

  notifyAllInBackground(
    {
      title: '📋 Attendance marked',
      body: `Year ${year} Sec ${section} · ${date} — ${result.present} present, ${result.absent} absent`,
      data: { type: 'attendance', date, year, section },
    },
    req.user?.username ?? null,
  );

  return res.status(201).json(result);
});

// DELETE /api/attendance?date=&year=&section=
export const deleteDay = asyncWrap(async (req, res) => {
  const date = String(req.query.date ?? '').trim();
  const year = String(req.query.year ?? '').trim();
  const section = String(req.query.section ?? '').trim();
  if (!date || !year || !section) throw new HttpError(400, 'date, year and section are required');
  const removed = await attendanceRepo.deleteDay(date, year, section);
  if (removed === 0) throw new HttpError(404, 'No attendance found for that class and date');
  audit.record(req, {
    action: 'attendance.delete',
    entity: 'attendance',
    details: `${date} — Year ${year} Sec ${section}: ${removed} record(s) removed`,
  });
  return res.json({ removed });
});

// GET /api/attendance/day?date=
export const getDay = asyncWrap(async (req, res) => {
  const date = String(req.query.date ?? '').trim() || today();
  return res.json({ date, data: await attendanceRepo.getDay(date) });
});

// GET /api/attendance/student/:id  (one student's attendance history)
export const getStudentAttendance = asyncWrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid student id');
  return res.json({ data: await attendanceRepo.listByStudent(id) });
});

// GET /api/attendance/summary?from=&to=&year=&section=
export const getSummary = asyncWrap(async (req, res) => {
  const rows = await attendanceRepo.summarize({
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
    year: req.query.year ? String(req.query.year) : undefined,
    section: req.query.section ? String(req.query.section) : undefined,
  });
  return res.json({ data: rows });
});


// GET /api/attendance/range?from=&to=&year=&section=  (Detailed absentee range export report)
export const getAttendanceRangeReport = asyncWrap(async (req, res) => {
  const rows = await attendanceRepo.getRangeReport({
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
    year: req.query.year ? String(req.query.year) : undefined,
    section: req.query.section ? String(req.query.section) : undefined,
  });
  return res.json({ data: rows });
});

// GET /api/attendance/export-data?from=&to=&year=&section= (Export data for excel)
export const exportAttendanceData = asyncWrap(async (req, res) => {
  const from = req.query.from ? String(req.query.from).trim() : '';
  const to = req.query.to ? String(req.query.to).trim() : '';
  
  if (!from || !to) throw new HttpError(400, 'from and to dates are required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new HttpError(400, 'dates must be YYYY-MM-DD');
  }

  const rows = await attendanceRepo.getExportData({
    from,
    to,
    year: req.query.year ? String(req.query.year).trim() : undefined,
    section: req.query.section ? String(req.query.section).trim() : undefined,
  });

  // Transform rows to return an array of students with an attendance map
  // Group by student_id
  const studentMap = new Map<number, any>();
  for (const r of rows) {
    if (!studentMap.has(r.student_id)) {
      studentMap.set(r.student_id, {
        student_id: r.student_id,
        name: r.name,
        register_number: r.register_number,
        enrollment_number: r.enrollment_number,
        section: r.section,
        attendance: {}
      });
    }
    if (r.att_date && r.status) {
      studentMap.get(r.student_id).attendance[r.att_date] = r.status;
    }
  }

  return res.json({ data: Array.from(studentMap.values()) });
});

// POST /api/attendance/remove-absentees  { entries: Array<{ student_id: number; att_date: string }> }
export const removeAbsentees = asyncWrap(async (req, res) => {
  const rawEntries = req.body?.entries;
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    throw new HttpError(400, 'entries array is required');
  }
  const entries = rawEntries
    .map((e: { student_id?: unknown; att_date?: unknown }) => ({
      student_id: Number(e.student_id),
      att_date: String(e.att_date || '').trim(),
    }))
    .filter((e) => Number.isInteger(e.student_id) && e.student_id > 0 && /^\d{4}-\d{2}-\d{2}$/.test(e.att_date));

  if (entries.length === 0) throw new HttpError(400, 'No valid entries provided');

  const removed = await attendanceRepo.removeAbsentees(entries);
  audit.record(req, {
    action: 'attendance.remove_absentees',
    entity: 'attendance',
    details: `Removed absent record for ${removed} entry/entries`,
  });
  return res.json({ removed });
});

// --- NEW CONTROLLERS ---

// GET /api/attendance/my-attendance/roster
export const getStudentYearRoster = asyncWrap(async (req, res) => {
  // Get student ID from token (assumes user is linked to a student profile if role=student)
  // Or fallback to user logic. Wait, the frontend might not pass student ID if they just login.
  // Actually, we can fetch all students for the student's year. 
  // Let's assume req.user has the info, or we can look up the student based on req.user.id
  // We need to fetch the student's year first.
  const studentId = req.user?.student_id;
  if (!studentId) {
    throw new HttpError(403, 'No linked student profile found');
  }

  const [students] = await pool.query<RowDataPacket[]>(
    `SELECT year FROM students WHERE id = ? LIMIT 1`,
    [studentId]
  );

  if (!students.length) throw new HttpError(404, 'Student not found');
  const year = students[0].year;
  
  if (!year) throw new HttpError(400, 'Student year is not set');

  const currentDate = today();
  // Fetch all students in that year and whether they have attendance for today
  const [roster] = await pool.query<RowDataPacket[]>(
    `SELECT s.id, s.name, s.section, s.year, s.register_number, s.enrollment_number,
            IF(a.status = 'present', true, false) as pooled
     FROM students s
     LEFT JOIN attendance a ON s.id = a.student_id AND a.att_date = ?
     WHERE s.year = ? 
     ORDER BY s.section ASC, s.name ASC`,
    [currentDate, year]
  );

  res.json({ roster });
});

// POST /api/attendance/my-attendance/verify-phone
export const verifyPhone = asyncWrap(async (req, res) => {
  const studentId = req.user?.student_id;
  if (!studentId) {
    throw new HttpError(403, 'No linked student profile found');
  }

  const { phone_number } = req.body;
  if (!phone_number) {
    throw new HttpError(400, 'Phone number is required');
  }

  const [students] = await pool.query<RowDataPacket[]>(
    `SELECT phone, enrollment_number FROM students WHERE id = ? LIMIT 1`,
    [studentId]
  );

  if (!students.length) throw new HttpError(404, 'Student not found');
  
  if (students[0].phone !== phone_number) {
    throw new HttpError(400, 'Phone number does not match our records');
  }

  res.json({ success: true, enrollment_number: students[0].enrollment_number });
});

// POST /api/attendance/my-attendance/mark
export const markSelfAttendance = asyncWrap(async (req, res) => {
  const studentId = req.user?.student_id;
  if (!studentId) {
    throw new HttpError(403, 'No linked student profile found');
  }

  const userId = req.user?.sub;
  if (!userId) throw new HttpError(401, 'Unauthorized');

  const { phone_number, enrollment_number, latitude, longitude } = req.body;
  if (!phone_number || !enrollment_number || latitude == null || longitude == null) {
    throw new HttpError(400, 'Missing required fields');
  }

  // Validate student exists and matches phone/enrollment
  const [students] = await pool.query<RowDataPacket[]>(
    `SELECT phone, enrollment_number, year, section FROM students WHERE id = ? LIMIT 1`,
    [studentId]
  );
  if (!students.length) throw new HttpError(404, 'Student not found');

  const student = students[0];
  if (student.phone !== phone_number) {
    throw new HttpError(400, 'Phone number mismatch');
  }
  if (student.enrollment_number !== enrollment_number) {
    throw new HttpError(400, 'Enrollment number mismatch');
  }

  // Location validation (SMVEC approx 11.9126650, 79.6350549, 100m radius)
  // Distance using Haversine
  const toRad = (v: number) => v * Math.PI / 180;
  const lat1 = 11.9126650;
  const lon1 = 79.6350549;
  const lat2 = Number(latitude);
  const lon2 = Number(longitude);
  const R = 6371e3; // metres
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  if (distance > 100) {
    throw new HttpError(400, 'Location is outside the permitted radius');
  }

  // Mark attendance
  const currentDate = today();
  await pool.query(
    `INSERT INTO attendance (student_id, att_date, status, year, section, marked_by)
     VALUES (?, ?, 'present', ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = 'present'`,
    [studentId, currentDate, student.year, student.section, userId]
  );

  res.json({ success: true, message: 'Attendance marked successfully' });
});

// GET /api/attendance/class-summary?year=&date=
export const getAttendanceClassSummary = asyncWrap(async (req, res) => {
  const year = String(req.query.year ?? '').trim();
  const date = String(req.query.date ?? today()).trim();
  
  if (!year) throw new HttpError(400, 'year is required');

  // We need to group by class (section), count present, absent, and get list of absentees.
  // Using LEFT JOIN to ensure all students for the year are accounted for,
  // even if they did not post their attendance yet.
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.section, a.status, s.id as student_id, s.name, s.register_number
     FROM students s
     LEFT JOIN attendance a ON s.id = a.student_id AND a.att_date = ?
     WHERE s.year = ?
     ORDER BY s.section ASC, s.name ASC`,
    [date, year]
  );

  const summaryMap = new Map<string, any>();
  for (const r of rows) {
    const sec = r.section || 'Unassigned';
    if (!summaryMap.has(sec)) {
      summaryMap.set(sec, { class: sec, present: 0, absent: 0, absentees: [], present_students: [] });
    }
    const classData = summaryMap.get(sec);
    if (r.status === 'present') {
      classData.present += 1;
      classData.present_students.push({ id: r.student_id, name: r.name, register_number: r.register_number });
    } else {
      classData.absent += 1;
      classData.absentees.push({ id: r.student_id, name: r.name, register_number: r.register_number });
    }
  }

  res.json({ data: Array.from(summaryMap.values()) });
});

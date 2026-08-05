import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getRoster,
  saveAttendance,
  getDay,
  getSummary,
  deleteDay,
  getStudentAttendance,
  getAttendanceRangeReport,
  removeAbsentees,
  getStudentYearRoster,
  verifyPhone,
  markSelfAttendance,
  getAttendanceClassSummary,
  exportAttendanceData
} from '../controllers/attendanceController.js';

export const attendanceRoutes = Router();
attendanceRoutes.use(requireAuth);

const staff = requireRole('superadmin', 'admin');
const studentOrStaff = requireRole('student', 'superadmin', 'admin');

// Student routes
attendanceRoutes.get('/my-attendance/roster', studentOrStaff, getStudentYearRoster);
attendanceRoutes.post('/my-attendance/verify-phone', studentOrStaff, verifyPhone);
attendanceRoutes.post('/my-attendance/mark', studentOrStaff, markSelfAttendance);

// Admin routes
attendanceRoutes.get('/roster', staff, getRoster);
attendanceRoutes.get('/class-summary', staff, getAttendanceClassSummary);

attendanceRoutes.get('/day', staff, getDay);
attendanceRoutes.get('/summary', staff, getSummary);
attendanceRoutes.get('/range', staff, getAttendanceRangeReport);
attendanceRoutes.get('/export-data', staff, exportAttendanceData);
attendanceRoutes.get('/student/:id', staff, getStudentAttendance);
attendanceRoutes.post('/', staff, saveAttendance);
attendanceRoutes.post('/remove-absentees', staff, removeAbsentees);
attendanceRoutes.delete('/', staff, deleteDay);


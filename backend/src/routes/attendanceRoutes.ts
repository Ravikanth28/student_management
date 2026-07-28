import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getRoster,
  saveAttendance,
  getDay,
  getSummary,
  deleteDay,
  getStudentAttendance,
  submitCRAttendance,
  getAttendanceRangeReport,
} from '../controllers/attendanceController.js';

export const attendanceRoutes = Router();
attendanceRoutes.use(requireAuth);

const staff = requireRole('superadmin', 'admin');
const staffAndCR = requireRole('superadmin', 'admin', 'cr');

attendanceRoutes.get('/roster', staffAndCR, getRoster);
attendanceRoutes.post('/cr-submit', staffAndCR, submitCRAttendance);

attendanceRoutes.get('/day', staff, getDay);
attendanceRoutes.get('/summary', staff, getSummary);
attendanceRoutes.get('/range', staff, getAttendanceRangeReport);
attendanceRoutes.get('/student/:id', staff, getStudentAttendance);
attendanceRoutes.post('/', staff, saveAttendance);
attendanceRoutes.delete('/', staff, deleteDay);

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
} from '../controllers/attendanceController.js';

export const attendanceRoutes = Router();
attendanceRoutes.use(requireAuth);

const staff = requireRole('superadmin', 'admin');

attendanceRoutes.get('/roster', staff, getRoster);

attendanceRoutes.get('/day', staff, getDay);
attendanceRoutes.get('/summary', staff, getSummary);
attendanceRoutes.get('/range', staff, getAttendanceRangeReport);
attendanceRoutes.get('/student/:id', staff, getStudentAttendance);
attendanceRoutes.post('/', staff, saveAttendance);
attendanceRoutes.post('/remove-absentees', staff, removeAbsentees);
attendanceRoutes.delete('/', staff, deleteDay);


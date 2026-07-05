import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getRoster, saveAttendance, getDay, getSummary, deleteDay } from '../controllers/attendanceController.js';

// Attendance is managed by staff (superadmin + admin).
export const attendanceRoutes = Router();
attendanceRoutes.use(requireAuth, requireRole('superadmin', 'admin'));

attendanceRoutes.get('/roster', getRoster);
attendanceRoutes.get('/day', getDay);
attendanceRoutes.get('/summary', getSummary);
attendanceRoutes.post('/', saveAttendance);
attendanceRoutes.delete('/', deleteDay);

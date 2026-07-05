import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createLateRecord, listLateRecords, lateSummary, deleteLateRecord } from '../controllers/lateController.js';

// Attendance/achievements are for staff (superadmin + admin), not view-only users.
export const lateRoutes = Router();
lateRoutes.use(requireAuth, requireRole('superadmin', 'admin'));

lateRoutes.post('/', createLateRecord);
lateRoutes.get('/summary', lateSummary);
lateRoutes.get('/', listLateRecords);
lateRoutes.delete('/:id', deleteLateRecord);

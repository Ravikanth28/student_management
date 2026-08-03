import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getTestReport,
  uploadTeacherMarks,
  updateManualMark,
  getDefaultReport,
} from '../controllers/examReportController.js';

export const examReportRoutes = Router();
examReportRoutes.use(requireAuth);

const adminOnly = requireRole('superadmin', 'admin');

// Routes for fetching and updating exam reports
examReportRoutes.get('/default', adminOnly, getDefaultReport);
examReportRoutes.get('/:testId', adminOnly, getTestReport);
examReportRoutes.post('/upload/:testId', adminOnly, uploadTeacherMarks);
examReportRoutes.post('/manual/:testId', adminOnly, updateManualMark);

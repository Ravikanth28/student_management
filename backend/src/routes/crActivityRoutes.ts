import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listCRActivity } from '../controllers/crActivityController.js';

export const crActivityRoutes = Router();
crActivityRoutes.use(requireAuth);
crActivityRoutes.get('/', requireRole('superadmin', 'admin'), listCRActivity);

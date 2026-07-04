import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getSystemStatus, getAuditLogs, getAuditActions } from '../controllers/systemController.js';

// Settings + audit log are superadmin-only.
export const systemRoutes = Router();
systemRoutes.use(requireAuth, requireRole('superadmin'));

systemRoutes.get('/status', getSystemStatus);
systemRoutes.get('/audit', getAuditLogs);
systemRoutes.get('/audit/actions', getAuditActions);

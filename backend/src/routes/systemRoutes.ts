import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSystemStatus, getAuditLogs, getAuditActions } from '../controllers/systemController.js';

export const systemRoutes = Router();
systemRoutes.use(requireAuth);

systemRoutes.get('/status', getSystemStatus);
systemRoutes.get('/audit', getAuditLogs);
systemRoutes.get('/audit/actions', getAuditActions);

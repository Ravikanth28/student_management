import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getPeriodSchedule, updatePeriodSchedule, getSystemSettings, updateSystemSettings } from '../controllers/settingsController.js';

export const settingsRoutes = Router();
settingsRoutes.use(requireAuth);

// Any authenticated user can read the timings (the late-marking modal needs them).
settingsRoutes.get('/period-schedule', getPeriodSchedule);
// Only a superadmin can change them.
settingsRoutes.put('/period-schedule', requireRole('superadmin'), updatePeriodSchedule);

// System settings (e.g. attendance full-time toggle)
settingsRoutes.get('/system', getSystemSettings);
settingsRoutes.put('/system', requireRole('superadmin'), updateSystemSettings);

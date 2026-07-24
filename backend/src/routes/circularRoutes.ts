import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as circularController from '../controllers/circularController.js';

const router = Router();

// All authenticated users (including CRs) can view circulars
router.get('/', requireAuth, circularController.listCirculars);

// Only admin & superadmin can broadcast circulars
router.post('/', requireAuth, requireRole('admin', 'superadmin'), circularController.createCircular);

// Only admin & superadmin can delete circulars
router.delete('/:id', requireAuth, requireRole('admin', 'superadmin'), circularController.deleteCircular);

export default router;

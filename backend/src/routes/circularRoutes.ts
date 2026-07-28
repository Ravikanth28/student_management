import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as circularController from '../controllers/circularController.js';

const router = Router();

// All authenticated users (including CRs) can view circulars
router.get('/', requireAuth, circularController.listCirculars);

// Only admin & superadmin can broadcast circulars
router.post('/', requireAuth, requireRole('admin', 'superadmin'), circularController.createCircular);

// Batch delete circulars
router.post('/batch-delete', requireAuth, requireRole('admin', 'superadmin'), circularController.deleteBatchCirculars);

// Only admin & superadmin can delete circulars
router.delete('/:id', requireAuth, requireRole('admin', 'superadmin'), circularController.deleteCircular);

// Clear ALL circulars — superadmin only
router.delete('/', requireAuth, requireRole('superadmin', 'admin'), circularController.clearAllCirculars);

export default router;

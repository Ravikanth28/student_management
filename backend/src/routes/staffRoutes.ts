import { Router } from 'express';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as staffController from '../controllers/staffController.js';
import { importStaff } from '../controllers/importController.js';
import { logger } from '../config/logger.js';

export const staffRoutes = Router();

const importMulter = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

function importUpload(req: Request, res: Response, next: NextFunction) {
  importMulter.single('file')(req, res, (err) => {
    if (err) {
      logger.warn('[Import] Multer error:', err);
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          message: err.code === 'LIMIT_FILE_SIZE'
            ? 'File too large. Maximum allowed size is 15 MB.'
            : `Upload error: ${err.message}`,
        });
      }
      return res.status(400).json({ message: `File upload error: ${(err as Error).message}` });
    }
    next();
  });
}

staffRoutes.post('/import', requireAuth, requireRole('superadmin'), importUpload, importStaff);


const adminOnly = [requireAuth, requireRole('admin', 'superadmin')];

staffRoutes.get('/', adminOnly, staffController.getAllStaff);
staffRoutes.get('/:id', adminOnly, staffController.getStaffById);
staffRoutes.post('/', adminOnly, staffController.createStaff);
staffRoutes.put('/:id', adminOnly, staffController.updateStaff);
staffRoutes.delete('/:id', requireAuth, requireRole('superadmin'), staffController.deleteStaff);

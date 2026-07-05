import { Router } from 'express';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadMiddleware } from '../middleware/upload.js';
import {
  createStudent,
  deleteStudent,
  getStats,
  getStudentById,
  listStudents,
  searchStudents,
  updateStudent,
  lookupStudent,
  getStudentLateRecords,
  getStudentAchievements,
  getStudentPlacements,
} from '../controllers/studentController.js';
import { importStudents, importPhotosFromDrive, getImportProgress, getImportHistory, deleteImportHistory } from '../controllers/importController.js';
import { uploadStudentPhoto, deleteStudentPhoto } from '../controllers/photoController.js';
import { filterStudents, exportStudents, getFilterMeta, getBirthdays, getUpcomingBirthdays } from '../controllers/filterController.js';
import { logger } from '../config/logger.js';

/**
 * Multer for bulk import: 15 MB, memory storage, NO fileFilter restriction.
 * XLSX files are ZIP archives — browsers may send them as:
 *   application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *   application/zip
 *   application/octet-stream
 * We validate by extension in importController instead.
 */
const importMulter = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

// Wrapper that catches multer errors and returns clean JSON
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

export const studentRoutes = Router();
studentRoutes.use(requireAuth);

// Staff = superadmin + admin. View-only "user" role can read but not mutate.
const staff = requireRole('superadmin', 'admin');

// ── Aggregate / special routes (MUST be before /:id) ──────────
studentRoutes.get('/stats',   getStats);
studentRoutes.get('/lookup',  staff, lookupStudent);           // scanner
studentRoutes.get('/search',  searchStudents);
studentRoutes.get('/filter',  filterStudents);
studentRoutes.get('/birthdays/upcoming', getUpcomingBirthdays);
studentRoutes.get('/birthdays', getBirthdays);
studentRoutes.get('/export',  exportStudents);
studentRoutes.get('/meta',    getFilterMeta);
studentRoutes.post('/import', staff, importUpload, importStudents);
studentRoutes.post('/import-photos-drive', staff, importPhotosFromDrive);
studentRoutes.get('/import-history', staff, getImportHistory);
studentRoutes.delete('/import-history/:id', staff, deleteImportHistory);
studentRoutes.get('/import-progress/:id', staff, getImportProgress);

// ── CRUD ──────────────────────────────────────────────────────
studentRoutes.get('/',         listStudents);
studentRoutes.post('/',        staff, createStudent);
studentRoutes.get('/:id',      getStudentById);
studentRoutes.put('/:id',      staff, updateStudent);
studentRoutes.delete('/:id',   staff, deleteStudent);
studentRoutes.get('/:id/late-records',  getStudentLateRecords);
studentRoutes.get('/:id/achievements',  getStudentAchievements);
studentRoutes.get('/:id/placements',     staff, getStudentPlacements);

// ── Photo (Cloudinary) ────────────────────────────────────────
studentRoutes.post('/:id/photo',   staff, uploadMiddleware, uploadStudentPhoto);
studentRoutes.delete('/:id/photo', staff, deleteStudentPhoto);

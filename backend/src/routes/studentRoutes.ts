import { Router } from 'express';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole, requireSelfOrStaff } from '../middleware/auth.js';
import { uploadMiddleware } from '../middleware/upload.js';
import {
  createStudent,
  deleteStudent,
  getStats,
  getYearCounts,
  promoteStudents,
  revertPromotion,
  getStudentById,
  listStudents,
  searchStudents,
  updateStudent,
  lookupStudent,
  getStudentLateRecords,
  getStudentAchievements,
  getStudentPlacements,
  getStudentDisciplineRecords,
  updateGithubUsername,
  getGithubAnalytics,
  getStudentGithubProfile,
} from '../controllers/studentController.js';
import { importStudents, importPhotosFromDrive, getImportProgress, getImportHistory, deleteImportHistory } from '../controllers/importController.js';
import { uploadStudentPhoto, deleteStudentPhoto } from '../controllers/photoController.js';
import { filterStudents, exportStudents, getFilterMeta, getFilteredSections, getBirthdays, getUpcomingBirthdays } from '../controllers/filterController.js';
import { logger } from '../config/logger.js';

/**
 * Multer for bulk import: 15 MB, memory storage, NO fileFilter restriction.
 * XLSX files are ZIP archives ΓÇö browsers may send them as:
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
const superadmin = requireRole('superadmin');
const anyStaff = requireRole('superadmin', 'admin', 'user', 'cr');

// ΓöÇΓöÇ Aggregate / special routes (MUST be before /:id) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
studentRoutes.get('/stats',   anyStaff, getStats);
studentRoutes.get('/year-counts',      superadmin, getYearCounts);
studentRoutes.post('/promote',         superadmin, promoteStudents);
studentRoutes.post('/promote/revert',  superadmin, revertPromotion);
studentRoutes.get('/lookup',  staff, lookupStudent);           // scanner
studentRoutes.get('/search',  anyStaff, searchStudents);
studentRoutes.get('/filter',  anyStaff, filterStudents);
studentRoutes.get('/birthdays/upcoming', anyStaff, getUpcomingBirthdays);
studentRoutes.get('/birthdays', anyStaff, getBirthdays);
studentRoutes.get('/export',  anyStaff, exportStudents);
studentRoutes.get('/meta',    anyStaff, getFilterMeta);
studentRoutes.get('/meta/sections', anyStaff, getFilteredSections);
studentRoutes.post('/import', staff, importUpload, importStudents);
studentRoutes.post('/import-photos-drive', staff, importPhotosFromDrive);
studentRoutes.get('/import-history', staff, getImportHistory);
studentRoutes.delete('/import-history/:id', staff, deleteImportHistory);
studentRoutes.get('/import-progress/:id', staff, getImportProgress);
studentRoutes.get('/github/analytics', staff, getGithubAnalytics);

// ΓöÇΓöÇ CRUD ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
studentRoutes.get('/',         anyStaff, listStudents);
studentRoutes.post('/',        staff, createStudent);
studentRoutes.get('/:id',      requireSelfOrStaff, getStudentById);
studentRoutes.put('/:id',      staff, updateStudent);
studentRoutes.delete('/:id',   staff, deleteStudent);
studentRoutes.get('/:id/late-records',  requireSelfOrStaff, getStudentLateRecords);
studentRoutes.get('/:id/achievements',  requireSelfOrStaff, getStudentAchievements);
studentRoutes.get('/:id/placements',    requireSelfOrStaff, getStudentPlacements);
studentRoutes.get('/:id/discipline-records', requireSelfOrStaff, getStudentDisciplineRecords);

// GitHub Analytics
studentRoutes.post('/:id/github', requireSelfOrStaff, updateGithubUsername);
studentRoutes.get('/:id/github/profile', requireSelfOrStaff, getStudentGithubProfile);

// ΓöÇΓöÇ Photo (Cloudinary) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
studentRoutes.post('/:id/photo',   staff, uploadMiddleware, uploadStudentPhoto);
studentRoutes.delete('/:id/photo', staff, deleteStudentPhoto);

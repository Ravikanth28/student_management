import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { processBulkImport } from '../services/bulkImportService.js';
import { logger } from '../config/logger.js';
import * as audit from '../services/auditService.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

export const importStudents = asyncWrap(async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      message: 'No file uploaded. Send a CSV or Excel file with field name "file".',
    });
  }

  // Validate by extension — xlsx is a ZIP so MIME type varies per browser
  const isValidExt = /\.(csv|xlsx|xls)$/i.test(file.originalname);
  if (!isValidExt) {
    return res.status(400).json({
      message: `Unsupported file: "${file.originalname}". Only .csv, .xlsx and .xls are accepted.`,
    });
  }

  try {
    const result = await processBulkImport(file.buffer, file.mimetype);
    audit.record(req, {
      action: 'import.bulk',
      entity: 'student',
      details: `${file.originalname} — mode=${result.mode}, imported=${result.imported}, updated=${result.updated}, skipped=${result.skipped}`,
    });
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Import failed due to an unexpected error.';
    logger.error('[Import] Error:', err);
    return res.status(400).json({ message });
  }
});

import { processDrivePhotos, importProgressMap } from '../services/bulkDriveImportService.js';
import { pool } from '../config/db.js';

export const importPhotosFromDrive = asyncWrap(async (req, res) => {
  const { driveFolderUrl, importId } = req.body;
  if (!driveFolderUrl || typeof driveFolderUrl !== 'string') {
    return res.status(400).json({ message: 'A Google Drive folder URL is required.' });
  }
  if (!importId) {
    return res.status(400).json({ message: 'importId is required.' });
  }

  try {
    const result = await processDrivePhotos(driveFolderUrl, importId);
    audit.record(req, {
      action: 'import.drive_photos',
      entity: 'student',
      details: `updated=${result.updated}, skipped=${result.skipped}`,
    });
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Drive import failed.';
    logger.error('[Drive Import] Error:', err);
    return res.status(400).json({ message });
  }
});

export const getImportProgress = asyncWrap(async (req, res) => {
  const id = String(req.params.id);
  const progress = importProgressMap.get(id);
  if (!progress) {
    return res.status(404).json({ message: 'Progress not found' });
  }
  return res.json(progress);
});

export const getImportHistory = asyncWrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM photo_import_history ORDER BY created_at DESC');
  return res.json(rows);
});

export const deleteImportHistory = asyncWrap(async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM photo_import_history WHERE id = ?', [id]);
  return res.status(204).send();
});

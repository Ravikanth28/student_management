import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../middleware/error.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../middleware/upload.js';
import { cloudinaryEnabled } from '../config/env.js';
import * as service from '../services/studentService.js';
import * as audit from '../services/auditService.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

function parseId(rawId: string | string[]) {
  const value = Array.isArray(rawId) ? rawId[0] : rawId;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid student id');
  return id;
}

export const uploadStudentPhoto = asyncWrap(async (req, res) => {
  if (!cloudinaryEnabled) {
    return res.status(503).json({ message: 'Cloudinary is not enabled on this server' });
  }
  const id   = parseId(req.params.id);
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No image file provided' });

  const student = await service.getStudent(id);
  if (student.photo_url) await deleteFromCloudinary(student.photo_url);

  const photoUrl = await uploadToCloudinary(file.buffer, student.register_number);
  const updated  = await service.updateStudent(id, { photo_url: photoUrl });

  audit.record(req, {
    action: 'student.photo.upload',
    entity: 'student',
    entity_id: String(id),
    details: `${student.name} (${student.register_number})`,
  });
  return res.json({ message: 'Photo uploaded successfully', photo_url: photoUrl, student: updated });
});

export const deleteStudentPhoto = asyncWrap(async (req, res) => {
  const id = parseId(req.params.id);
  const student = await service.getStudent(id);
  if (student.photo_url) await deleteFromCloudinary(student.photo_url);
  const updated = await service.updateStudent(id, { photo_url: undefined });
  audit.record(req, {
    action: 'student.photo.delete',
    entity: 'student',
    entity_id: String(id),
    details: `${student.name} (${student.register_number})`,
  });
  return res.json({ message: 'Photo removed', student: updated });
});

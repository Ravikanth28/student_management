import multer from 'multer';
import type { Request } from 'express';
import { cloudinaryEnabled } from '../config/env.js';
import { cloudinary } from '../config/cloudinary.js';
import { HttpError } from './error.js';
import { logger } from '../config/logger.js';

// ─── Allowed MIME types ───────────────────────────────────────
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Memory-based multer (buffers file before upload) ─────────
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req: Request, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed') as unknown as null, false);
    }
  },
}).single('photo');

// ─── Upload buffer → Cloudinary ───────────────────────────────
export async function uploadToCloudinary(
  buffer: Buffer,
  studentRegisterNumber: string
): Promise<string> {
  if (!cloudinaryEnabled) {
    throw new HttpError(503, 'Cloudinary is not configured on this server');
  }

  return new Promise((resolve, reject) => {
    // public_id is relative to `folder` — do NOT prefix it with the folder,
    // or Cloudinary produces a duplicated path (student-portal/students/student-portal/...).
    const publicId = studentRegisterNumber.replace(/\s+/g, '_');

    const stream = cloudinary.uploader.upload_stream(
      {
        folder:         'student-portal/students',
        public_id:      publicId,
        overwrite:      true,        // replace old photo on re-upload
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto:good', fetch_format: 'auto' },
        ],
        resource_type: 'image',
      },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error('Cloudinary upload returned empty result'));
        } else {
          resolve(result.secure_url);
        }
      }
    );

    stream.end(buffer);
  });
}

/** Delete a photo from Cloudinary by its full URL (best-effort, never throws) */
export async function deleteFromCloudinary(photoUrl: string): Promise<void> {
  if (!cloudinaryEnabled || !photoUrl) return;
  try {
    // Extract public_id from the URL (everything between /upload/ and the extension)
    const match = photoUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    if (match?.[1]) {
      await cloudinary.uploader.destroy(match[1]);
    }
  } catch {
    // Non-fatal: log only
    logger.warn('[cloudinary] deleteFromCloudinary failed');
  }
}

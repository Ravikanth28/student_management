import multer from 'multer';
import type { Request } from 'express';
import { cloudinaryEnabled } from '../config/env.js';
import { cloudinary } from '../config/cloudinary.js';
import { HttpError } from './error.js';

// ─── Allowed MIME types ───────────────────────────────────────
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/pdf'
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Memory-based multer ─────────
export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req: Request, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and PDF files are allowed') as unknown as null, false);
    }
  },
});

export const multiPhotoUploadMiddleware = documentUpload.array('photos', 5); // max 5 photos
export const singleDocumentUploadMiddleware = documentUpload.single('file');

export async function uploadDocumentToCloudinary(
  buffer: Buffer,
  folder: string,
  filename: string
): Promise<string> {
  if (!cloudinaryEnabled) {
    throw new HttpError(503, 'Cloudinary is not configured on this server');
  }

  return new Promise((resolve, reject) => {
    // Generate a unique ID (timestamp + random string) to avoid collisions if multiple are uploaded
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    // For PDFs and other files, cloudinary uses `auto` resource_type nicely.
    // If it's a PDF, Cloudinary treats it as an image for generation, but we can store it as raw or image.
    // resource_type: 'auto' is safest.
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${filename}_${uniqueId}`,
        resource_type: 'auto',
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

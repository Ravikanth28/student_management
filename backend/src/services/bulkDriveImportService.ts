import { google } from 'googleapis';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { uploadToCloudinary } from '../middleware/upload.js';
import axios from 'axios';

export const importProgressMap = new Map<string, { current: number, total: number, status: string }>();

// Drop a progress entry after this long so the map doesn't grow unbounded.
const PROGRESS_TTL_MS = 10 * 60 * 1000;
function scheduleProgressCleanup(importId: string) {
  const t = setTimeout(() => importProgressMap.delete(importId), PROGRESS_TTL_MS);
  t.unref();
}

export async function processDrivePhotos(folderUrl: string, importId: string) {
  importProgressMap.set(importId, { current: 0, total: 0, status: 'fetching_files' });

  // 1. Extract folder ID from URL
  // e.g. https://drive.google.com/drive/folders/1hSmWjWWws3YyB5e331ApFDjR3SCg_4OB
  let folderId = '';
  const folderMatch = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
  const idMatch = folderUrl.match(/id=([a-zA-Z0-9_-]+)/);
  if (folderMatch) {
    folderId = folderMatch[1];
  } else if (idMatch) {
    folderId = idMatch[1];
  } else {
    folderId = folderUrl.trim();
  }

  if (!folderId || folderId.length < 15) {
    throw new Error('Invalid Google Drive folder URL or ID.');
  }

  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is not configured on the server. Please add it to your .env file.');
  }

  const drive = google.drive({ version: 'v3', auth: apiKey });

  // 2. Fetch all image files from the folder
  const files: any[] = [];
  let pageToken: string | undefined = undefined;

  try {
    do {
      const res: any = await drive.files.list({
        q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType)',
        pageToken,
        pageSize: 100,
      });
      if (res.data.files) {
        files.push(...res.data.files);
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  } catch (err: any) {
    throw new Error('Failed to fetch from Google Drive. Ensure the folder is "Anyone with the link can view" and your API key is valid. ' + err.message);
  }

  if (files.length === 0) {
    importProgressMap.set(importId, { current: 0, total: 0, status: 'error' });
    scheduleProgressCleanup(importId);
    throw new Error('No images found in the provided Google Drive folder.');
  }

  importProgressMap.set(importId, { current: 0, total: files.length, status: 'processing' });

  // 3. Fetch all students from DB to map enrollment numbers to student IDs
  const [rows] = await pool.query('SELECT id, enrollment_number, register_number, name, photo_url FROM students');
  const students = rows as Array<{ id: number; enrollment_number: string; register_number: string; name: string; photo_url: string }>;

  let imported = 0;
  let skipped = 0;
  let updated = 0;
  const errors: { row: number; register_number: string; reason: string }[] = [];
  const successes: { student_id: number; name: string; register_number: string; enrollment_number: string; photo_url: string }[] = [];

  // 4. Process each file
  for (let i = 0; i < files.length; i++) {
    importProgressMap.set(importId, { current: i, total: files.length, status: 'processing' });
    const file = files[i];
    const fileName = file.name || '';

    // Tokenize the filename (drop extension, split on non-alphanumerics) and
    // match a WHOLE token — prevents "101" from matching a file for "1012".
    const tokens = new Set(
      fileName
        .replace(/\.[^.]+$/, '')
        .toUpperCase()
        .split(/[^A-Z0-9]+/)
        .filter(Boolean)
    );
    const matchedStudent = students.find(s =>
      (s.enrollment_number && tokens.has(s.enrollment_number.toUpperCase())) ||
      (s.register_number && tokens.has(s.register_number.toUpperCase()))
    );

    if (!matchedStudent) {
      skipped++;
      errors.push({
        row: i + 1,
        register_number: fileName,
        reason: 'Could not match any enrollment/register number to this filename.'
      });
      continue;
    }

    if (matchedStudent.photo_url) {
      skipped++;
      errors.push({
        row: i + 1,
        register_number: fileName,
        reason: 'Already exists (Skipped to prevent duplicate)'
      });
      continue;
    }

    try {
      // 5. Download file from Google Drive as arraybuffer using axios to avoid 403 API Key restrictions
      const downloadRes = await axios.get<ArrayBuffer>(
        `https://drive.google.com/uc?export=download&id=${file.id}`,
        {
          responseType: 'arraybuffer',
          timeout: 25000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StudentPortal/1.0)' },
          maxRedirects: 5,
        }
      );

      const buffer = Buffer.from(downloadRes.data);

      // 6. Upload to Cloudinary using existing function
      const cloudinaryUrl = await uploadToCloudinary(buffer, matchedStudent.enrollment_number || String(matchedStudent.id));

      // 7. Update DB
      await pool.query(
        'UPDATE students SET photo_url = ? WHERE id = ?',
        [cloudinaryUrl, matchedStudent.id]
      );
      
      matchedStudent.photo_url = cloudinaryUrl; // Update local state for subsequent files if duplicate checking

      updated++;
      imported++;
      successes.push({
        student_id: matchedStudent.id,
        name: matchedStudent.name,
        register_number: matchedStudent.register_number,
        enrollment_number: matchedStudent.enrollment_number,
        photo_url: cloudinaryUrl
      });
    } catch (err: any) {
      skipped++;
      let msg = err.message || 'Error downloading or uploading image.';
      if (err.response?.status === 403) {
        msg = 'Access denied (403). Check if the file is fully public.';
      } else if (err.response?.status === 404) {
        msg = 'File not found (404).';
      }
      errors.push({
        row: i + 1,
        register_number: fileName,
        reason: msg
      });
    }
  }

  importProgressMap.set(importId, { current: files.length, total: files.length, status: 'completed' });
  scheduleProgressCleanup(importId);

  // Save history to db
  await pool.query(
    'INSERT INTO photo_import_history (id, folder_url, successes, errors) VALUES (?, ?, ?, ?)',
    [importId, folderUrl, JSON.stringify(successes), JSON.stringify(errors)]
  );

  return {
    mode: 'photo_update',
    imported,
    updated,
    skipped,
    successes,
    errors,
    importId
  };
}

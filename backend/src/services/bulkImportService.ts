/**
 * Bulk Import Service — supports TWO modes in a single file upload:
 *
 * MODE 1 – Full Student Import
 *   Required columns: name, register_number, enrollment_number, section, department, batch, phone, parent_phone, address
 *   Optional: college_email, personal_email, photo_url
 *   → Creates new student records in TiDB.
 *   → If register_number already exists → skipped (duplicate).
 *   → If photo_url is a Google Drive link → auto-downloaded and uploaded to Cloudinary.
 *
 * MODE 2 – Photo-Only Update (Map by Register Number)
 *   Required columns: register_number, photo_url
 *   Only these two columns present (no name/department/etc.)
 *   → Finds existing student by register_number.
 *   → Downloads photo from Google Drive / direct URL.
 *   → Uploads to Cloudinary, updates student record in TiDB.
 *   → Photo then appears in Student Records automatically.
 */

import axios from 'axios';
import * as XLSX from 'xlsx';
import { cloudinary, cloudinaryEnabled } from '../config/cloudinary.js';
import * as repository from '../repositories/studentRepository.js';
import { logger } from '../config/logger.js';
import { normalizeBloodGroup, parseDob } from '../lib/studentFields.js';

// ─── Column aliases ───────────────────────────────────────────
const ALIASES: Record<string, string> = {
  // name
  'name': 'name', 'student name': 'name', 'full name': 'name', 'student_name': 'name', 'fullname': 'name',
  // register_number
  'register_number': 'register_number', 'register number': 'register_number', 'reg no': 'register_number',
  'reg number': 'register_number', 'register no': 'register_number', 'roll number': 'register_number',
  'roll no': 'register_number', 'registration number': 'register_number', 'reg_no': 'register_number',
  'regno': 'register_number',
  // enrollment_number
  'enrollment_number': 'enrollment_number', 'enrollment number': 'enrollment_number',
  'enroll no': 'enrollment_number', 'enrollment no': 'enrollment_number', 'enrolment number': 'enrollment_number',
  // department
  'department': 'department', 'dept': 'department', 'branch': 'department', 'stream': 'department',
  // batch
  'batch': 'batch', 'year': 'batch', 'batch year': 'batch', 'academic year': 'batch', 'year of joining': 'batch',
  // section
  'section': 'section', 'sec': 'section', 'class': 'section', 'division': 'section',
  // phone
  'phone': 'phone', 'mobile': 'phone', 'mobile number': 'phone', 'phone number': 'phone',
  'contact': 'phone', 'contact number': 'phone', 'student phone': 'phone', 'student mobile': 'phone',
  // parent_phone
  'parent_phone': 'parent_phone', 'parent mobile': 'parent_phone', 'parent phone number': 'parent_phone',
  'father mobile': 'parent_phone', 'mother mobile': 'parent_phone', 'guardian phone': 'parent_phone',
  'parent contact': 'parent_phone', 'parent phone': 'parent_phone',
  // address
  'address': 'address', 'home address': 'address', 'residential address': 'address', 'permanent address': 'address',
  // college_email
  'college_email': 'college_email', 'college email': 'college_email', 'college mail': 'college_email',
  'college email id': 'college_email', 'institutional email': 'college_email', 'institution email': 'college_email',
  // personal_email
  'personal_email': 'personal_email', 'personal email': 'personal_email', 'personal mail': 'personal_email',
  'personal email id': 'personal_email', 'gmail': 'personal_email', 'email id': 'personal_email', 'email': 'personal_email',
  // photo_url
  'photo_url': 'photo_url', 'photo': 'photo_url', 'image': 'photo_url', 'photo link': 'photo_url',
  'drive link': 'photo_url', 'photo url': 'photo_url', 'image url': 'photo_url', 'image link': 'photo_url',
  'google drive': 'photo_url', 'drive photo': 'photo_url', 'photo_link': 'photo_url',
  // blood_group
  'blood_group': 'blood_group', 'blood group': 'blood_group', 'blood grp': 'blood_group',
  'bloodgroup': 'blood_group', 'blood': 'blood_group', 'bg': 'blood_group', 'blood type': 'blood_group',
  // dob
  'dob': 'dob', 'd o b': 'dob', 'date of birth': 'dob', 'birth date': 'dob', 'birthdate': 'dob', 'birthday': 'dob',
};

function normalizeHeader(raw: string): string {
  const lower = raw.trim().toLowerCase().replace(/[.\-_]+/g, ' ').replace(/\s+/g, ' ');
  return ALIASES[lower] ?? lower.replace(/\s+/g, '_');
}

// ─── Parse sheet → rows with normalized keys ──────────────────
function parseSheet(sheet: XLSX.WorkSheet): Record<string, string>[] {
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });

  let headerRowIndex = 0;
  let bestHeaders: string[] = [];

  // Find the row that has the most matching known aliases (to skip title rows/blank rows at top)
  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const candidateHeaders = (rawRows[r] as unknown[]).map(h => normalizeHeader(String(h ?? '')));
    const knownCount = candidateHeaders.filter(h => Object.values(ALIASES).includes(h)).length;
    
    // If we found a row with at least 2 known headers (e.g. reg_no and name), it's probably the header row
    if (knownCount >= 1 || knownCount > bestHeaders.filter(h => Object.values(ALIASES).includes(h)).length) {
      bestHeaders = candidateHeaders;
      headerRowIndex = r;
    }
  }

  const headers = bestHeaders;
  logger.debug(`[Bulk Import] Detected header row at index ${headerRowIndex}, ${headers.length} columns`);

  const dataRows = rawRows.slice(headerRowIndex + 1);

  return dataRows
    .map((row) => {
      const arr = row as unknown[];
      const out: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (!h) return;
        const raw = arr[i];
        if (raw === undefined || raw === null || raw === '') {
          out[h] = '';
        } else if (typeof raw === 'number') {
          out[h] = String(raw);
        } else {
          out[h] = String(raw).trim();
        }
      });
      return out;
    })
    .filter(row => Object.values(row).some(v => v !== ''));
}

// ─── Google Drive → direct download URL ──────────────────────
function driveToDirectUrl(url: string): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();

  if (!u.includes('drive.google.com') && !u.includes('docs.google.com')) {
    return u; // already a direct URL
  }

  const viewMatch = u.match(/\/file\/d\/([^/?\s]+)/);
  if (viewMatch) return `https://drive.google.com/uc?export=download&id=${viewMatch[1]}`;

  const openMatch = u.match(/[?&]id=([^&\s]+)/);
  if (openMatch) return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;

  return null;
}

// ─── Download image buffer ────────────────────────────────────
async function downloadImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 25_000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StudentPortal/1.0)' },
      maxRedirects: 5,
    });
    const contentType = (response.headers['content-type'] as string) ?? '';
    if (!contentType.startsWith('image/')) return null;
    return Buffer.from(response.data);
  } catch {
    return null;
  }
}

// ─── Upload buffer → Cloudinary ──────────────────────────────
async function uploadToCloudinary(buffer: Buffer, publicId: string): Promise<string | null> {
  if (!cloudinaryEnabled) return null;
  return new Promise<string | null>((resolve) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'student-portal/students',
        // public_id is relative to `folder`; prefixing it duplicates the path.
        public_id: publicId.replace(/\s+/g, '_'),
        overwrite: true,
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto:good', fetch_format: 'auto' },
        ],
      },
      (err, result) => resolve(err || !result ? null : result.secure_url)
    );
    stream.end(buffer);
  });
}

// ─── Process a photo URL: download + upload → return CDN URL ─
async function processPhoto(rawUrl: string, regNumber: string): Promise<string | null> {
  if (!rawUrl) return null;
  const directUrl = driveToDirectUrl(rawUrl);
  if (!directUrl) return null;
  const buf = await downloadImageBuffer(directUrl);
  if (!buf) return null;
  return uploadToCloudinary(buf, regNumber);
}

// ─── Exported types ───────────────────────────────────────────
export interface BulkImportResult {
  mode:     'full_import' | 'photo_update' | 'details_update';
  imported: number;
  updated:  number;
  skipped:  number;
  errors:   { row: number; register_number: string; reason: string }[];
}

// ─── Main Entry Point ─────────────────────────────────────────
export async function processBulkImport(
  fileBuffer: Buffer,
  _mimeType: string
): Promise<BulkImportResult> {
  let rows: Record<string, string>[];

  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false, cellText: true });
    if (!workbook.SheetNames.length) throw new Error('No sheets found');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = parseSheet(sheet);
  } catch (e) {
    logger.error('[Import] parse error:', e);
    throw new Error(
      'Could not read the file. Make sure it is a valid .xlsx, .xls, or .csv file and is not password-protected.'
    );
  }

  if (rows.length === 0) {
    throw new Error('The file has no data rows. Make sure the first row contains column headers.');
  }

  // ── Detect mode ──────────────────────────────────────────────
  // If ALL rows have register_number + photo_url but NO name/department
  // → Photo-update mode (map by reg number, update Cloudinary photo)
  // Otherwise → Full import mode (create students)
  const hasFullFields  = rows.some(r => r.name && r.department && r.batch);
  const hasPhotoField  = rows.some(r => r.photo_url);
  const hasRegField    = rows.some(r => r.register_number);
  const hasEnrollField = rows.some(r => r.enrollment_number);
  const hasDetailField = rows.some(r => r.blood_group || r.dob);

  // Details-update: a partial sheet keyed by reg/enroll number that only carries
  // blood group / DOB (and maybe a photo). Updates existing students in place.
  if (!hasFullFields && (hasRegField || hasEnrollField) && hasDetailField) {
    return processDetailsUpdate(rows);
  }

  // Photo-only update: reg number + photo_url, nothing else.
  if (!hasFullFields && hasRegField && hasPhotoField) {
    return processPhotoUpdate(rows);
  }

  return processFullImport(rows);
}

// ─── MODE 3: Details update (blood group / DOB / photo) by reg or enroll no ──
async function processDetailsUpdate(rows: Record<string, string>[]): Promise<BulkImportResult> {
  const result: BulkImportResult = { mode: 'details_update', imported: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const regNum = row.register_number?.trim() ?? '';
    const enrollNum = row.enrollment_number?.trim() ?? '';
    const code = regNum || enrollNum;

    if (!code) {
      result.errors.push({ row: rowNum, register_number: '', reason: 'Missing register_number / enrollment_number' });
      result.skipped++;
      continue;
    }

    const existing = await repository.getStudentByCode(code);
    if (!existing) {
      result.errors.push({ row: rowNum, register_number: code, reason: `No student found for "${code}"` });
      result.skipped++;
      continue;
    }

    const changes: Record<string, string> = {};
    const bg = normalizeBloodGroup(row.blood_group);
    if (bg) changes.blood_group = bg;
    const dob = parseDob(row.dob);
    if (dob) changes.dob = dob;
    if (row.photo_url) {
      const photoUrl = await processPhoto(row.photo_url, existing.register_number);
      if (photoUrl) changes.photo_url = photoUrl;
    }

    if (Object.keys(changes).length === 0) {
      result.errors.push({ row: rowNum, register_number: code, reason: 'No blood group / DOB / photo to update' });
      result.skipped++;
      continue;
    }

    await repository.updateStudent(existing.id, changes);
    result.updated++;
  }

  return result;
}

// ─── MODE 1: Full student import ─────────────────────────────
async function processFullImport(rows: Record<string, string>[]): Promise<BulkImportResult> {
  const result: BulkImportResult = { mode: 'full_import', imported: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const regNum = row.register_number?.trim() ?? '';

    // Validate required
    const missing: string[] = [];
    if (!row.name)              missing.push('name');
    if (!regNum)                missing.push('register_number');
    if (!row.enrollment_number) missing.push('enrollment_number');
    if (!row.section)           missing.push('section');
    if (!row.department)        missing.push('department');
    if (!row.batch)             missing.push('batch');
    if (!row.phone)             missing.push('phone');
    if (!row.parent_phone)      missing.push('parent_phone');
    if (!row.address)           missing.push('address');

    if (missing.length > 0) {
      result.errors.push({ row: rowNum, register_number: regNum, reason: `Missing: ${missing.join(', ')}` });
      result.skipped++;
      continue;
    }

    // Process photo
    const photoUrl = await processPhoto(row.photo_url ?? '', regNum);

    try {
      await repository.createStudent({
        name:              row.name,
        register_number:   regNum,
        enrollment_number: row.enrollment_number,
        section:           row.section,
        department:        row.department,
        batch:             row.batch,
        phone:             row.phone,
        parent_phone:      row.parent_phone,
        address:           row.address,
        college_email:     row.college_email  || undefined,
        personal_email:    row.personal_email || undefined,
        photo_url:         photoUrl ?? undefined,
        blood_group:       normalizeBloodGroup(row.blood_group),
        dob:               parseDob(row.dob),
      });
      result.imported++;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'ER_DUP_ENTRY') {
        // Duplicate → if photo available, update existing photo too
        if (photoUrl) {
          const existing = await repository.getStudentByRegNumber(regNum);
          if (existing) {
            await repository.updateStudent(existing.id, { photo_url: photoUrl });
            result.errors.push({ row: rowNum, register_number: regNum, reason: `Already exists — photo updated to Cloudinary` });
          } else {
            result.errors.push({ row: rowNum, register_number: regNum, reason: `Register number "${regNum}" already exists — skipped` });
          }
        } else {
          result.errors.push({ row: rowNum, register_number: regNum, reason: `Register number "${regNum}" already exists — skipped` });
        }
        result.skipped++;
      } else {
        result.errors.push({ row: rowNum, register_number: regNum, reason: `DB error: ${(err as Error).message}` });
        result.skipped++;
      }
    }
  }

  return result;
}

// ─── MODE 2: Photo-only update (map by register number) ──────
async function processPhotoUpdate(rows: Record<string, string>[]): Promise<BulkImportResult> {
  const result: BulkImportResult = { mode: 'photo_update', imported: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const regNum = row.register_number?.trim() ?? '';

    if (!regNum) {
      result.errors.push({ row: rowNum, register_number: '', reason: 'Missing register_number' });
      result.skipped++;
      continue;
    }
    if (!row.photo_url) {
      result.errors.push({ row: rowNum, register_number: regNum, reason: 'Missing photo_url' });
      result.skipped++;
      continue;
    }

    // Find existing student
    const existing = await repository.getStudentByRegNumber(regNum);
    if (!existing) {
      result.errors.push({ row: rowNum, register_number: regNum, reason: `No student found with register number "${regNum}"` });
      result.skipped++;
      continue;
    }

    // Download + upload to Cloudinary
    const cloudUrl = await processPhoto(row.photo_url, regNum);
    if (!cloudUrl) {
      result.errors.push({ row: rowNum, register_number: regNum, reason: 'Could not download or upload photo (check the Drive link)' });
      result.skipped++;
      continue;
    }

    // Update student record
    await repository.updateStudent(existing.id, { photo_url: cloudUrl });
    result.updated++;
  }

  return result;
}

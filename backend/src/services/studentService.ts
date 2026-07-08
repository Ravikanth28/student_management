import { HttpError } from '../middleware/error.js';
import type { StudentInput, StudentListResult, StudentRecord } from '../types/student.js';
import * as repository from '../repositories/studentRepository.js';

function clean(value?: string) {
  return value?.trim();
}

function normalizeInput(input: Partial<StudentInput>): Partial<StudentInput> {
  const normalized: Partial<StudentInput> = {};

  if (input.name !== undefined) normalized.name = clean(input.name) ?? '';
  if (input.register_number !== undefined) normalized.register_number = clean(input.register_number) ?? '';
  if (input.enrollment_number !== undefined) normalized.enrollment_number = clean(input.enrollment_number) ?? '';
  if (input.section !== undefined) normalized.section = clean(input.section) ?? '';
  if (input.department !== undefined) normalized.department = clean(input.department) ?? '';
  if (input.batch !== undefined) normalized.batch = clean(input.batch) ?? '';
  if (input.phone !== undefined) normalized.phone = clean(input.phone) ?? '';
  if (input.parent_phone !== undefined) normalized.parent_phone = clean(input.parent_phone) ?? '';
  if (input.address !== undefined) normalized.address = clean(input.address) ?? '';
  if (input.college_email !== undefined) normalized.college_email = clean(input.college_email);
  if (input.personal_email !== undefined) normalized.personal_email = clean(input.personal_email);
  if (input.photo_url !== undefined) normalized.photo_url = clean(input.photo_url);

  return normalized;
}

function mapDatabaseError(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ER_DUP_ENTRY'
  ) {
    throw new HttpError(409, 'Register number already exists');
  }

  throw error instanceof HttpError ? error : new HttpError(500, 'Unexpected database error');
}

export async function getStudents(page: number, limit: number, q?: string): Promise<StudentListResult> {
  return repository.listStudents(page, limit, q?.trim() || undefined);
}

export async function getStudent(id: number): Promise<StudentRecord> {
  const student = await repository.getStudentById(id);
  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  return student;
}

export async function createStudent(input: StudentInput): Promise<StudentRecord> {
  try {
    return await repository.createStudent(normalizeInput(input) as StudentInput);
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function updateStudent(id: number, input: Partial<StudentInput>): Promise<StudentRecord> {
  const updated = await repository.updateStudent(id, normalizeInput(input));
  if (!updated) {
    throw new HttpError(404, 'Student not found');
  }

  return updated;
}

export async function deleteStudent(id: number): Promise<void> {
  const deleted = await repository.deleteStudent(id);
  if (!deleted) {
    throw new HttpError(404, 'Student not found');
  }
}

export async function searchStudents(q: string): Promise<StudentRecord[]> {
  return repository.searchStudents(q.trim(), 8);
}

/** Returns aggregate stats for the dashboard. */
export async function getDashboardStats(): Promise<{
  totalStudents: number;
  totalDepartments: number;
  totalBatches: number;
  recentStudents: StudentRecord[];
}> {
  return repository.getDashboardStats();
}

export async function filterStudents(
  params: repository.FilterParams
): Promise<StudentListResult> {
  return repository.filterStudents(params);
}

export async function getFilterMeta(): Promise<{ departments: string[]; batches: string[]; years: string[]; sections: string[] }> {
  return repository.getFilterMeta();
}

export async function getFilteredSections(
  params: { department?: string; batch?: string; year?: string }
): Promise<string[]> {
  return repository.getFilteredSections(params);
}

export async function getYearStats(): Promise<Record<string, number>> {
  return repository.getYearStats();
}

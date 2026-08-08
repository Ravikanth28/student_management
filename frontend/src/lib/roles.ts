import type { Role } from '../types';

export const isStaff = (r?: Role | null): boolean => r === 'superadmin' || r === 'admin';
export const isSuperadmin = (r?: Role | null): boolean => r === 'superadmin';
export const isStudent = (r?: Role | null): boolean => r === 'student';

/** Roles allowed to open each route/nav path. */
export const PATH_ROLES: Record<string, Role[]> = {
  '/dashboard':     ['superadmin', 'admin', 'user', 'student'],
  '/staff':         ['superadmin'],
  '/staff/:id':     ['superadmin'],
  '/staff-profile': ['superadmin', 'admin'],
  '/students':      ['superadmin', 'admin', 'user'],
  '/blood-groups':  ['superadmin', 'admin', 'user'],
  '/students/new':  ['superadmin', 'admin'],
  '/students/:id/edit': ['superadmin', 'admin'],
  '/scanner':       ['superadmin', 'admin'],
  '/attendance':    ['superadmin', 'admin'],
  '/circulars':     ['superadmin', 'admin', 'user'],
  '/student-reports': ['superadmin', 'admin'],
  '/import':        ['superadmin', 'admin'],
  '/audit':         ['superadmin'],
  '/settings':      ['superadmin'],
  '/users':         ['superadmin'],
  '/feedback':      ['superadmin', 'admin', 'student'],
  '/exams':         ['superadmin', 'admin'],
  '/exams/cards':   ['superadmin'],
  '/my-exam-marks': ['student'],
  '/github-analytics': ['superadmin', 'admin'],
};

export function canAccess(path: string, role?: Role | null): boolean {
  const allowed = PATH_ROLES[path];
  if (!allowed) return true; // unlisted paths (e.g. detail views) — any authenticated user
  return !!role && allowed.includes(role);
}

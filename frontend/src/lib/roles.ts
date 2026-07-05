import type { Role } from '../types';

export const isStaff = (r?: Role | null): boolean => r === 'superadmin' || r === 'admin';
export const isSuperadmin = (r?: Role | null): boolean => r === 'superadmin';

/** Roles allowed to open each route/nav path. */
export const PATH_ROLES: Record<string, Role[]> = {
  '/dashboard':     ['superadmin', 'admin', 'user'],
  '/students':      ['superadmin', 'admin', 'user'],
  '/students/new':  ['superadmin', 'admin'],
  '/students/:id/edit': ['superadmin', 'admin'],
  '/scanner':       ['superadmin', 'admin'],
  '/late-comers':   ['superadmin', 'admin'],
  '/achievements':  ['superadmin', 'admin'],
  '/placements':    ['superadmin', 'admin'],
  '/import':        ['superadmin', 'admin'],
  '/audit':         ['superadmin'],
  '/settings':      ['superadmin'],
  '/users':         ['superadmin'],
};

export function canAccess(path: string, role?: Role | null): boolean {
  const allowed = PATH_ROLES[path];
  if (!allowed) return true; // unlisted paths (e.g. detail views) — any authenticated user
  return !!role && allowed.includes(role);
}

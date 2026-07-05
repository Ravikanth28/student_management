import type { NextFunction, Request, RequestHandler, Response } from 'express';
import bcrypt from 'bcrypt';
import { HttpError } from '../middleware/error.js';
import { userCreateSchema, userUpdateSchema } from '../validators/authValidator.js';
import * as userRepo from '../repositories/userRepository.js';
import type { Role } from '../repositories/userRepository.js';
import * as audit from '../services/auditService.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

function parseId(raw: string | string[]) {
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

// GET /api/users
export const listUsers = asyncWrap(async (_req, res) => {
  const users = await userRepo.listUsers();
  return res.json({ data: users });
});

// POST /api/users
export const createUser = asyncWrap(async (req, res) => {
  const parsed = userCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid user payload', issues: parsed.error.flatten() });
  }
  const { username, name, password, role } = parsed.data;

  if (await userRepo.findByUsername(username)) {
    throw new HttpError(409, `Username "${username}" is already taken`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = await userRepo.createUser(username, name, passwordHash, role, req.user?.username ?? null);

  audit.record(req, { action: 'user.create', entity: 'user', entity_id: String(id), details: `${name} (${username}, ${role})` });
  return res.status(201).json({ message: 'User created', user: { id, username, name, role } });
});

// PUT /api/users/:id  (reset password / change name or role)
export const updateUser = asyncWrap(async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid update', issues: parsed.error.flatten() });
  }
  const target = await userRepo.getUserById(id);
  if (!target) throw new HttpError(404, 'User not found');

  // Never demote the last superadmin.
  if (parsed.data.role && parsed.data.role !== 'superadmin' && target.role === 'superadmin' && (await userRepo.countByRole('superadmin')) <= 1) {
    throw new HttpError(400, 'Cannot change the role of the last superadmin');
  }

  const fields: { name?: string; role?: Role; passwordHash?: string } = {};
  if (parsed.data.name !== undefined) fields.name = parsed.data.name;
  if (parsed.data.role !== undefined) fields.role = parsed.data.role;
  if (parsed.data.password) fields.passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await userRepo.updateUser(id, fields);
  audit.record(req, {
    action: 'user.update',
    entity: 'user',
    entity_id: String(id),
    details: `${target.username}${fields.role ? ` role→${fields.role}` : ''}${fields.passwordHash ? ' (password reset)' : ''}`,
  });
  return res.json({ message: 'User updated' });
});

// DELETE /api/users/:id
export const deleteUser = asyncWrap(async (req, res) => {
  const id = parseId(req.params.id);
  const target = await userRepo.getUserById(id);
  if (!target) throw new HttpError(404, 'User not found');

  // Never delete yourself, and never remove the last superadmin.
  if (target.username === req.user?.username) {
    throw new HttpError(400, 'You cannot delete your own account');
  }
  if (target.role === 'superadmin' && (await userRepo.countByRole('superadmin')) <= 1) {
    throw new HttpError(400, 'Cannot delete the last superadmin');
  }

  await userRepo.deleteUser(id);
  audit.record(req, { action: 'user.delete', entity: 'user', entity_id: String(id), details: target.username });
  return res.status(204).send();
});

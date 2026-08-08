import type { Request, Response } from 'express';
import { z } from 'zod';
import * as staffRepo from '../repositories/staffRepository.js';
import * as audit from '../services/auditService.js';
import { HttpError } from '../middleware/error.js';
import { parseDob } from '../lib/studentFields.js';
import type { RequestHandler, NextFunction } from 'express';
import * as userRepo from '../repositories/userRepository.js';
import bcrypt from 'bcrypt';

const staffSchema = z.object({
  emp_id: z.string().min(1),
  name: z.string().min(1),
  department: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  dob: z.string().optional(),
  photo_url: z.string().optional(),
});

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

export const getAllStaff = asyncWrap(async (req: Request, res: Response) => {
  const staff = await staffRepo.getAllStaff();
  return res.json(staff);
});

export const getStaffById = asyncWrap(async (req: Request, res: Response) => {
  const staff = await staffRepo.getStaffById(Number(req.params.id));
  if (!staff) throw new HttpError(404, 'Staff not found');
  return res.json(staff);
});

export const createStaff = asyncWrap(async (req: Request, res: Response) => {
  const parsed = staffSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid data');
  }

  const { emp_id, name, department, phone, email, dob, photo_url } = parsed.data;

  // Check if exists
  const existing = await staffRepo.getStaffByEmpId(emp_id);
  if (existing) {
    throw new HttpError(409, 'Staff with this ID already exists');
  }

  // Create associated user for login (optional but recommended for staff)
  // Let's create an admin user for them by default with password = DOB or "123456"
  const dobStr = dob ? String(parseDob(dob)) : null;
  const defaultPassword = dobStr ? `${dobStr.slice(8, 10)}${dobStr.slice(5, 7)}${dobStr.slice(0, 4)}` : 'password123';
  const hash = await bcrypt.hash(defaultPassword, 12);
  let userId: number | null = null;
  
  try {
    userId = await userRepo.createUser(emp_id, name, hash, 'admin', req.user?.username ?? 'system');
  } catch (e: any) {
    // If user already exists, it's fine, we just won't link, or we could look them up
    if (e.code === 'ER_DUP_ENTRY') {
       const u = await userRepo.findByUsername(emp_id);
       if (u) userId = u.id;
    }
  }

  const id = await staffRepo.createStaff({
    emp_id,
    name,
    department: department ?? null,
    phone: phone ?? null,
    email: email || null,
    dob: parseDob(dob) || null,
    photo_url: photo_url ?? null,
    user_id: userId,
  });

  audit.record(req, { action: 'staff.create', entity: 'staff', entity_id: String(id) });
  return res.status(201).json({ message: 'Staff created', id });
});

export const updateStaff = asyncWrap(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = staffSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid data');
  }

  const existing = await staffRepo.getStaffById(id);
  if (!existing) throw new HttpError(404, 'Staff not found');

  const updates: Partial<staffRepo.StaffCreatePayload> = {};
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.department !== undefined) updates.department = parsed.data.department;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.email !== undefined) updates.email = parsed.data.email || null;
  if (parsed.data.dob !== undefined) updates.dob = parseDob(parsed.data.dob) || null;
  if (parsed.data.photo_url !== undefined) updates.photo_url = parsed.data.photo_url;

  await staffRepo.updateStaff(id, updates);

  audit.record(req, { action: 'staff.update', entity: 'staff', entity_id: String(id) });
  return res.json({ message: 'Staff updated' });
});

export const deleteStaff = asyncWrap(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const existing = await staffRepo.getStaffById(id);
  if (!existing) throw new HttpError(404, 'Staff not found');

  await staffRepo.deleteStaff(id);
  
  if (existing.user_id) {
    // Optionally delete the user as well, but we'll leave it for now or delete it manually.
  }

  audit.record(req, { action: 'staff.delete', entity: 'staff', entity_id: String(id) });
  return res.json({ message: 'Staff deleted' });
});

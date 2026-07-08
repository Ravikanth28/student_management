import type { NextFunction, Request, RequestHandler, Response } from 'express';
import * as deviceRepo from '../repositories/deviceRepository.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

// POST /api/devices/register  { token, platform? }
export const registerDevice = asyncWrap(async (req, res) => {
  const token = String(req.body?.token ?? '').trim();
  if (!token) return res.status(400).json({ message: 'token is required' });
  const platform = req.body?.platform ? String(req.body.platform).slice(0, 20) : 'android';
  await deviceRepo.upsertToken(token, req.user?.username ?? null, req.user?.role ?? null, platform);
  return res.status(201).json({ ok: true });
});

// POST /api/devices/unregister  { token }
export const unregisterDevice = asyncWrap(async (req, res) => {
  const token = String(req.body?.token ?? '').trim();
  if (token) await deviceRepo.deleteTokens([token]);
  return res.json({ ok: true });
});

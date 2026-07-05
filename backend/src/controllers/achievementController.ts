import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../middleware/error.js';
import { achievementCreateSchema } from '../validators/activityValidator.js';
import * as achievementRepo from '../repositories/achievementRepository.js';
import * as audit from '../services/auditService.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

function parseId(raw: string | string[]) {
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

// POST /api/achievements
export const createAchievement = asyncWrap(async (req, res) => {
  const parsed = achievementCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid achievement', issues: parsed.error.flatten() });
  }
  const { member_ids, ...input } = parsed.data;

  const id = await achievementRepo.createAchievement(input, member_ids, req.user?.username ?? null);

  audit.record(req, {
    action: 'achievement.create',
    entity: 'achievement',
    entity_id: String(id),
    details: `${input.title} — ${input.result}${input.position ? ` (${input.position})` : ''}, ${member_ids.length} member(s)`,
  });

  return res.status(201).json({ message: 'Achievement added', id });
});

// GET /api/achievements
export const listAchievements = asyncWrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const q = req.query.q ? String(req.query.q) : undefined;
  const result = await achievementRepo.listAchievements(q, page, limit);
  return res.json(result);
});

// PUT /api/achievements/:id
export const updateAchievement = asyncWrap(async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = achievementCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid achievement', issues: parsed.error.flatten() });
  }
  const { member_ids, ...input } = parsed.data;
  const ok = await achievementRepo.updateAchievement(id, input, member_ids);
  if (!ok) throw new HttpError(404, 'Achievement not found');
  audit.record(req, {
    action: 'achievement.update',
    entity: 'achievement',
    entity_id: String(id),
    details: `${input.title} — ${input.result}, ${member_ids.length} member(s)`,
  });
  return res.json({ message: 'Achievement updated' });
});

// DELETE /api/achievements/:id
export const deleteAchievement = asyncWrap(async (req, res) => {
  const id = parseId(req.params.id);
  const ok = await achievementRepo.deleteAchievement(id);
  if (!ok) throw new HttpError(404, 'Achievement not found');
  audit.record(req, { action: 'achievement.delete', entity: 'achievement', entity_id: String(id) });
  return res.status(204).send();
});

// DELETE /api/achievements/:id/members/:studentId  (remove a student from an achievement)
export const removeAchievementMember = asyncWrap(async (req, res) => {
  const id = parseId(req.params.id);
  const studentId = parseId(req.params.studentId);
  const result = await achievementRepo.removeMember(id, studentId);
  if (!result.removed) throw new HttpError(404, 'Member not found on this achievement');
  audit.record(req, {
    action: 'achievement.member.remove',
    entity: 'achievement',
    entity_id: String(id),
    details: `removed student ${studentId}${result.achievementDeleted ? ' — achievement deleted (no members left)' : ''}`,
  });
  return res.json({ removed: true, achievementDeleted: result.achievementDeleted });
});

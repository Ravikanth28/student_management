import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, env.JWT_SECRET) as { sub: string; username: string; role: string };
    return next();
  } catch (err) {
    // Never log the token/header itself — only the failure reason.
    logger.debug('[Auth] Token validation failed:', (err as Error).message);
    return res.status(401).json({ message: 'Session expired or invalid token' });
  }
}

/** Restrict a route to specific roles. Use after requireAuth. */
export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    return next();
  };
}

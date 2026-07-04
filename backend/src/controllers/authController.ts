import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { loginSchema } from '../validators/authValidator.js';
import * as audit from '../services/auditService.js';

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid login payload', issues: parsed.error.flatten() });
  }

  const { username, password } = parsed.data;

  // Prefer the bcrypt hash; fall back to plaintext only for local dev.
  let passwordMatches = false;
  if (env.ADMIN_PASSWORD_HASH) {
    passwordMatches = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
  } else if (env.ADMIN_PASSWORD) {
    passwordMatches = password === env.ADMIN_PASSWORD;
  }

  // Compare both factors after doing the work so response timing doesn't
  // reveal whether the username was valid.
  if (username !== env.ADMIN_USERNAME || !passwordMatches) {
    audit.record(req, {
      action: 'auth.login',
      status: 'failure',
      actor: username,
      details: 'Invalid credentials',
    });
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  audit.record(req, { action: 'auth.login', status: 'success', actor: username });

  const token = jwt.sign(
    { sub: username, username, role: 'admin' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
  );

  return res.json({
    token,
    user: { username, role: 'admin' }
  });
}

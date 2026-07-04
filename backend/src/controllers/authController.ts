import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { loginSchema } from '../validators/authValidator.js';
import * as audit from '../services/auditService.js';
import * as userRepo from '../repositories/userRepository.js';

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid login payload', issues: parsed.error.flatten() });
  }

  const { username, password } = parsed.data;
  const user = await userRepo.findByUsername(username);

  // Compare against the stored hash. Run a dummy compare when the user is
  // missing so timing doesn't reveal whether the username exists.
  const hash = user?.password_hash ?? '$2b$12$0000000000000000000000000000000000000000000000000000';
  const passwordMatches = await bcrypt.compare(password, hash);

  if (!user || !passwordMatches) {
    audit.record(req, { action: 'auth.login', status: 'failure', actor: username, details: 'Invalid credentials' });
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { sub: username, username, name: user.name ?? username, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
  );

  audit.record(req, { action: 'auth.login', status: 'success', actor: username });

  return res.json({
    token,
    user: { username, name: user.name ?? username, role: user.role },
  });
}

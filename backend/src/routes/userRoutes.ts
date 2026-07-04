import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listUsers, createUser, deleteUser } from '../controllers/userController.js';

// User management is superadmin-only.
export const userRoutes = Router();
userRoutes.use(requireAuth, requireRole('superadmin'));

userRoutes.get('/', listUsers);
userRoutes.post('/', createUser);
userRoutes.delete('/:id', deleteUser);

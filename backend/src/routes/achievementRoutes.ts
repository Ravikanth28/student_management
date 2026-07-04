import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createAchievement, listAchievements, deleteAchievement, removeAchievementMember } from '../controllers/achievementController.js';

export const achievementRoutes = Router();
achievementRoutes.use(requireAuth, requireRole('superadmin', 'admin'));

achievementRoutes.post('/', createAchievement);
achievementRoutes.get('/', listAchievements);
achievementRoutes.delete('/:id/members/:studentId', removeAchievementMember);
achievementRoutes.delete('/:id', deleteAchievement);

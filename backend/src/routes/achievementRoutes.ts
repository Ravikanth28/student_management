import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createAchievement, listAchievements, achievementSummary, updateAchievement, deleteAchievement, removeAchievementMember } from '../controllers/achievementController.js';

export const achievementRoutes = Router();
achievementRoutes.use(requireAuth, requireRole('superadmin', 'admin'));

achievementRoutes.post('/', createAchievement);
achievementRoutes.get('/summary', achievementSummary);
achievementRoutes.get('/', listAchievements);
achievementRoutes.put('/:id', updateAchievement);
achievementRoutes.delete('/:id/members/:studentId', removeAchievementMember);
achievementRoutes.delete('/:id', deleteAchievement);

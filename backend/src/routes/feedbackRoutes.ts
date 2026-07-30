import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { submitFeedback, getFeedback } from '../controllers/feedbackController.js';

export const feedbackRoutes = Router();

// All feedback routes require authentication
feedbackRoutes.use(requireAuth);

// Students can submit feedback
feedbackRoutes.post('/', submitFeedback);

// Only superadmin can view feedback
feedbackRoutes.get('/', requireRole('superadmin'), getFeedback);

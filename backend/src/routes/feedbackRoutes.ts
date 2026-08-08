import { Router } from 'express';
import {
  submitFeedback,
  getPendingFeedback,
  forwardFeedback,
  deleteFeedback,
  getMyFeedback,
  getStaffList,
  getRepliedFeedback,
  getStudentMyFeedback,
  getFeedbackMessages,
  postFeedbackMessage
} from '../controllers/feedbackController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const feedbackRoutes = Router();

// Student/User submits feedback
feedbackRoutes.post('/', requireAuth, submitFeedback);
feedbackRoutes.get('/student/my', requireAuth, requireRole('student'), getStudentMyFeedback);

// Superadmin routes
feedbackRoutes.get('/pending', requireAuth, requireRole('superadmin'), getPendingFeedback);
feedbackRoutes.post('/:id/forward', requireAuth, requireRole('superadmin'), forwardFeedback);
feedbackRoutes.delete('/:id', requireAuth, requireRole('superadmin', 'admin'), deleteFeedback);
feedbackRoutes.get('/staff-list', requireAuth, requireRole('superadmin'), getStaffList);
feedbackRoutes.get('/replied', requireAuth, requireRole('superadmin'), getRepliedFeedback);

// Teacher/Admin route
feedbackRoutes.get('/my', requireAuth, requireRole('superadmin', 'admin'), getMyFeedback);

// Thread messages
feedbackRoutes.get('/:id/messages', requireAuth, getFeedbackMessages);
feedbackRoutes.post('/:id/messages', requireAuth, postFeedbackMessage);

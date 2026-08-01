import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createCard,
  listCards,
  getCard,
  updateCard,
  updateStatus,
  deleteCard,
  getStudentCards,
  saveMarks,
  getTestMarks,
} from '../controllers/examCardController.js';

export const examCardRoutes = Router();
examCardRoutes.use(requireAuth);

const superadminOnly = requireRole('superadmin');
const adminOrSuperadmin = requireRole('superadmin', 'admin');
const staffOrStudent  = requireRole('superadmin', 'admin', 'student');

// Superadmin CRUD
examCardRoutes.get('/',               adminOrSuperadmin, listCards);
examCardRoutes.post('/',              superadminOnly, createCard);
examCardRoutes.get('/:id(\\d+)',      adminOrSuperadmin, getCard);
examCardRoutes.put('/:id(\\d+)',      superadminOnly, updateCard);
examCardRoutes.patch('/:id/status',   superadminOnly, updateStatus);
examCardRoutes.delete('/:id',         superadminOnly, deleteCard);

// Marks view (superadmin)
examCardRoutes.get('/:cardId/marks',  superadminOnly, getTestMarks);

// Student access
examCardRoutes.get('/student/:studentId', staffOrStudent, getStudentCards);
examCardRoutes.put('/marks',              staffOrStudent, saveMarks);

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createDisciplineRecord, listDisciplineRecords, disciplineSummary, deleteDisciplineRecord } from '../controllers/disciplineController.js';

export const disciplineRoutes = Router();
disciplineRoutes.use(requireAuth, requireRole('superadmin', 'admin'));

disciplineRoutes.post('/', createDisciplineRecord);
disciplineRoutes.get('/summary', disciplineSummary);
disciplineRoutes.get('/', listDisciplineRecords);
disciplineRoutes.delete('/:id', deleteDisciplineRecord);

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createPlacement, listPlacements, updatePlacement, deletePlacement } from '../controllers/placementController.js';

// Placements are for staff (superadmin + admin).
export const placementRoutes = Router();
placementRoutes.use(requireAuth, requireRole('superadmin', 'admin'));

placementRoutes.post('/', createPlacement);
placementRoutes.get('/', listPlacements);
placementRoutes.put('/:id', updatePlacement);
placementRoutes.delete('/:id', deletePlacement);

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createPlacement, listPlacements, updatePlacement, deletePlacement, deleteBatchPlacements, uploadOfferLetter, deleteOfferLetter } from '../controllers/placementController.js';
import { singleDocumentUploadMiddleware } from '../middleware/fileUpload.js';

// Placements are for staff (superadmin + admin).
export const placementRoutes = Router();
placementRoutes.use(requireAuth, requireRole('superadmin', 'admin'));

placementRoutes.post('/', createPlacement);
placementRoutes.post('/batch-delete', deleteBatchPlacements);
placementRoutes.get('/', listPlacements);
placementRoutes.put('/:id', updatePlacement);
placementRoutes.post('/:id/offer-letter', singleDocumentUploadMiddleware, uploadOfferLetter);
placementRoutes.delete('/:id/offer-letter', deleteOfferLetter);
placementRoutes.delete('/:id', deletePlacement);

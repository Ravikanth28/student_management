import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { registerDevice, unregisterDevice } from '../controllers/deviceController.js';

// Any authenticated user can register their device to receive push notifications.
export const deviceRoutes = Router();
deviceRoutes.use(requireAuth);

deviceRoutes.post('/register', registerDevice);
deviceRoutes.post('/unregister', unregisterDevice);

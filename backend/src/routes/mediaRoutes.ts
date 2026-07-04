import { Router } from 'express';
import { proxyImage } from '../controllers/mediaController.js';

// Public (no auth): images loaded via <img src> can't send an Authorization
// header, and these are already-public Cloudinary URLs.
export const mediaRoutes = Router();
mediaRoutes.get('/image', proxyImage);

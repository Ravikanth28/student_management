import type { Request, Response } from 'express';
import { logger } from '../config/logger.js';
import * as circularService from '../services/circularService.js';

export async function listCirculars(_req: Request, res: Response): Promise<void> {
  try {
    const list = await circularService.getCirculars();
    res.json({ circulars: list });
  } catch (err) {
    logger.error('Failed to fetch circulars:', err);
    res.status(500).json({ message: 'Failed to fetch circulars' });
  }
}

export async function createCircular(req: Request, res: Response): Promise<void> {
  try {
    const { title, content, target_audience, priority } = req.body;
    if (!title || !content) {
      res.status(400).json({ message: 'Title and content are required' });
      return;
    }
    const createdBy = (req.user as any)?.name || (req.user as any)?.username || 'Admin';
    const circular = await circularService.broadcastCircular(
      title.trim(),
      content.trim(),
      target_audience?.trim() || 'ALL',
      priority?.trim() || 'Normal',
      createdBy
    );
    res.status(201).json({ circular });
  } catch (err) {
    logger.error('Failed to broadcast circular:', err);
    res.status(500).json({ message: (err as Error)?.message || 'Failed to broadcast circular' });
  }
}

export async function deleteCircular(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid circular ID' });
      return;
    }
    const success = await circularService.removeCircular(id);
    if (!success) {
      res.status(404).json({ message: 'Circular not found' });
      return;
    }
    res.json({ message: 'Circular deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete circular' });
  }
}

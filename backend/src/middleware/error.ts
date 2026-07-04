import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: 'Route not found' });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const rawStatus = typeof err === 'object' && err !== null && 'statusCode' in err
    ? Number((err as { statusCode?: number }).statusCode)
    : 500;
  const statusCode = rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;

  // Log full detail server-side; never expose internals of a 500 to clients.
  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} ->`, err);
    return res.status(statusCode).json({ message: 'Internal server error' });
  }

  const message = err instanceof Error ? err.message : 'Request failed';
  return res.status(statusCode).json({ message });
}

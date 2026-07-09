import type { Request, Response, NextFunction } from 'express';
import { insertAudit } from '../repositories/auditRepository.js';

export function apiAuditLogger(req: Request, res: Response, next: NextFunction) {
  // Only log state-mutating requests (POST, PUT, PATCH, DELETE).
  // GET requests are typically not audited to prevent log bloat, unless specifically needed.
  if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
    return next();
  }

  // Intercept when the response finishes to capture the final status code
  res.on('finish', () => {
    // Some routes (like auth) might not have req.user if they fail, or they are public
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor = (req as any).user?.username || 'system/anonymous';
    const status = res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failure';
    
    // Action format: e.g. "POST /students", "DELETE /users/5"
    // req.originalUrl contains the full path including /api
    let actionPath = req.originalUrl.split('?')[0]; // remove query strings
    if (actionPath.startsWith('/api/')) {
      actionPath = actionPath.substring(4); // Keep the slash, e.g. "/students"
    }
    const action = `${req.method} ${actionPath}`;
    
    // Try to extract entity and entity_id from the path
    const parts = actionPath.split('/').filter(Boolean);
    const entity = parts[0] || 'system';
    
    // Usually IDs are the second part (e.g., /students/123)
    let entity_id = null;
    if (parts.length > 1) {
      const maybeId = parts[1];
      if (!isNaN(Number(maybeId))) {
        entity_id = String(maybeId);
      } else {
        // If it's something like /students/lookup, keep entity_id empty
        if (parts.length > 2 && !isNaN(Number(parts[2]))) {
          entity_id = String(parts[2]);
        }
      }
    }

    // Capture basic details
    let details = `Status: ${res.statusCode}`;
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      // Don't log passwords
      const safeBody = { ...req.body };
      if (safeBody.password) safeBody.password = '***';
      if (safeBody.newPassword) safeBody.newPassword = '***';
      details += ` | Payload: ${JSON.stringify(safeBody).substring(0, 100)}`;
    }

    // Insert asynchronously (do not await, so we don't delay the response closure)
    insertAudit({
      action,
      entity,
      entity_id,
      actor,
      status,
      details,
      ip: req.ip
    }).catch(err => {
      console.error('[auditLogger] Failed to write audit log:', err);
    });
  });

  next();
}

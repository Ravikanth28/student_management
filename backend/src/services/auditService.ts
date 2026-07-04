import type { Request } from 'express';
import { logger } from '../config/logger.js';
import * as repository from '../repositories/auditRepository.js';
import type { AuditEntry, AuditListResult } from '../repositories/auditRepository.js';

function clientIp(req: Request): string {
  // `trust proxy` is enabled, so req.ip already resolves X-Forwarded-For.
  return (req.ip ?? '').replace('::ffff:', '') || 'unknown';
}

/**
 * Record an audit event. Best-effort: audit logging must never break the
 * request it is describing, so DB failures are logged and swallowed.
 */
export function record(
  req: Request,
  entry: Omit<AuditEntry, 'ip' | 'actor'> & { actor?: string | null }
): void {
  const full: AuditEntry = {
    ...entry,
    actor: entry.actor ?? req.user?.username ?? null,
    ip: clientIp(req),
  };

  // Also emit to the application log for real-time visibility / aggregation.
  logger.info(
    `[AUDIT] ${full.action} ${full.status ?? 'success'} actor=${full.actor ?? '-'} ` +
      `${full.entity ?? ''}${full.entity_id ? `#${full.entity_id}` : ''} ip=${full.ip}`
  );

  repository.insertAudit(full).catch((err) => {
    logger.error('[AUDIT] failed to persist audit entry:', err);
  });
}

export async function getAuditLogs(
  page: number,
  limit: number,
  action?: string
): Promise<AuditListResult> {
  return repository.listAudit(page, limit, action);
}

export async function getAuditActions(): Promise<string[]> {
  return repository.listAuditActions();
}

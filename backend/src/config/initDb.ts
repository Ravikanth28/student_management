import { pool } from './db.js';
import { logger } from './logger.js';

/**
 * Idempotently ensures auxiliary tables exist. Runs at startup so the
 * audit log and import history work on a fresh database without a manual
 * migration step. The core `students` table is managed via schema.sql.
 */
export async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS photo_import_history (
      id VARCHAR(50) NOT NULL,
      folder_url VARCHAR(500) NULL,
      successes JSON NULL,
      errors JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      action VARCHAR(64) NOT NULL,
      entity VARCHAR(64) NULL,
      entity_id VARCHAR(64) NULL,
      actor VARCHAR(120) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'success',
      details VARCHAR(500) NULL,
      ip VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_audit_created_at (created_at),
      KEY idx_audit_action (action)
    )
  `);

  logger.info('Database schema verified.');
}

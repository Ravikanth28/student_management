import type { RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { pool } from './db.js';
import { logger } from './logger.js';
import { env } from './env.js';

/**
 * Idempotently ensures auxiliary tables exist. Runs at startup so the
 * audit log and import history work on a fresh database without a manual
 * migration step. The core `students` table is managed via schema.sql.
 */
export async function ensureSchema(): Promise<void> {
  // Add newer student columns when upgrading an existing table (ignore "already exists").
  for (const sql of [
    "ALTER TABLE students ADD COLUMN blood_group VARCHAR(8) NULL AFTER photo_url",
    "ALTER TABLE students ADD COLUMN dob DATE NULL AFTER blood_group",
  ]) {
    try {
      await pool.query(sql);
    } catch (err) {
      const code = (err as { code?: string }).code;
      // ER_DUP_FIELDNAME = column already exists; ER_NO_SUCH_TABLE = fresh DB (schema.sql makes it).
      if (code !== 'ER_DUP_FIELDNAME' && code !== 'ER_NO_SUCH_TABLE') throw err;
    }
  }

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

  // Late-comer records. One record per student/period/day (uniqueness guard).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS late_records (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id BIGINT UNSIGNED NOT NULL,
      period VARCHAR(24) NOT NULL,
      scheduled_time VARCHAR(8) NULL,
      late_time VARCHAR(8) NULL,
      minutes_late INT NULL,
      late_date DATE NOT NULL,
      marked_by VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_late_student_period_day (student_id, period, late_date),
      KEY idx_late_student (student_id),
      KEY idx_late_date (late_date)
    )
  `);

  // Add columns when upgrading an existing table (ignore "already exists").
  for (const sql of [
    "ALTER TABLE late_records ADD COLUMN late_time VARCHAR(8) NULL AFTER period",
    "ALTER TABLE late_records ADD COLUMN scheduled_time VARCHAR(8) NULL AFTER period",
    "ALTER TABLE late_records ADD COLUMN minutes_late INT NULL AFTER late_time",
  ]) {
    try {
      await pool.query(sql);
    } catch (err) {
      if ((err as { code?: string }).code !== 'ER_DUP_FIELDNAME') throw err;
    }
  }

  // Achievements (may belong to a team of students via achievement_members).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS achievements (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_type VARCHAR(40) NULL,
      title VARCHAR(200) NOT NULL,
      venue VARCHAR(200) NULL,
      duration VARCHAR(120) NULL,
      result VARCHAR(20) NOT NULL DEFAULT 'participated',
      position VARCHAR(60) NULL,
      prize VARCHAR(200) NULL,
      event_date DATE NULL,
      created_by VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ach_created_at (created_at)
    )
  `);

  // Add event_type when upgrading an existing achievements table.
  try {
    await pool.query('ALTER TABLE achievements ADD COLUMN event_type VARCHAR(40) NULL AFTER id');
  } catch (err) {
    if ((err as { code?: string }).code !== 'ER_DUP_FIELDNAME') throw err;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS achievement_members (
      achievement_id BIGINT UNSIGNED NOT NULL,
      student_id BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (achievement_id, student_id),
      KEY idx_am_student (student_id)
    )
  `);

  // Placements (one student per record).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS placements (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id BIGINT UNSIGNED NOT NULL,
      company VARCHAR(200) NOT NULL,
      position VARCHAR(200) NULL,
      package VARCHAR(60) NULL,
      placement_type VARCHAR(20) NOT NULL DEFAULT 'on_campus',
      offer_type VARCHAR(30) NULL,
      location VARCHAR(200) NULL,
      placed_date DATE NULL,
      created_by VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_placement_student (student_id),
      KEY idx_placement_created (created_at)
    )
  `);

  // Registered device push tokens (for FCM push notifications).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_tokens (
      token VARCHAR(255) NOT NULL,
      username VARCHAR(120) NULL,
      role VARCHAR(20) NULL,
      platform VARCHAR(20) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (token)
    )
  `);

  // Application users with roles (superadmin / admin / user).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(120) NOT NULL,
      name VARCHAR(120) NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_by VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_username (username)
    )
  `);

  // Add the display-name column when upgrading an already-created users table.
  try {
    await pool.query('ALTER TABLE users ADD COLUMN name VARCHAR(120) NULL AFTER username');
  } catch (err) {
    if ((err as { code?: string }).code !== 'ER_DUP_FIELDNAME') throw err;
  }

  logger.info('Database schema verified.');
}

/**
 * Seeds the first superadmin from the ADMIN_* env vars if the users table is
 * empty — so the existing admin credentials become the superadmin and nothing
 * breaks on upgrade.
 */
export async function seedSuperadmin(): Promise<void> {
  const [rows] = await pool.query<Array<{ c: number } & RowDataPacket>>('SELECT COUNT(*) AS c FROM users');
  if (Number(rows[0]?.c ?? 0) > 0) return;

  const hash = env.ADMIN_PASSWORD_HASH
    ? env.ADMIN_PASSWORD_HASH
    : env.ADMIN_PASSWORD
      ? bcrypt.hashSync(env.ADMIN_PASSWORD, 12)
      : null;

  if (!hash) {
    logger.warn('No ADMIN_PASSWORD or ADMIN_PASSWORD_HASH set — cannot seed the superadmin account.');
    return;
  }

  await pool.query(
    'INSERT INTO users (username, name, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?)',
    [env.ADMIN_USERNAME, 'Administrator', hash, 'superadmin', 'system']
  );
  logger.info(`Seeded superadmin account "${env.ADMIN_USERNAME}".`);
}

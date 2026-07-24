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
    "ALTER TABLE students ADD COLUMN year VARCHAR(16) NULL AFTER section",
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

  // Discipline records table.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS discipline_records (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id BIGINT UNSIGNED NOT NULL,
      reason VARCHAR(255) NOT NULL,
      details TEXT NULL,
      record_date DATE NOT NULL,
      record_time VARCHAR(8) NULL,
      marked_by VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_disc_student (student_id),
      KEY idx_disc_date (record_date)
    )
  `);

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

  // Daily attendance — one row per student per day (present/absent).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      student_id BIGINT UNSIGNED NOT NULL,
      att_date DATE NOT NULL,
      status VARCHAR(10) NOT NULL DEFAULT 'present',
      year VARCHAR(16) NULL,
      section VARCHAR(40) NULL,
      marked_by VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_att_student_day (student_id, att_date),
      KEY idx_att_date (att_date),
      KEY idx_att_student (student_id)
    )
  `);

  // Promotion (year-rollover) history — enables a precise one-click undo.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promotion_batches (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      created_by VARCHAR(120) NULL,
      promoted_count INT NOT NULL DEFAULT 0,
      reverted TINYINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reverted_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      KEY idx_promo_created (created_at)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promotion_changes (
      batch_id BIGINT UNSIGNED NOT NULL,
      student_id BIGINT UNSIGNED NOT NULL,
      from_year VARCHAR(16) NULL,
      PRIMARY KEY (batch_id, student_id),
      KEY idx_promo_changes_batch (batch_id)
    )
  `);

  // System settings (key-value store, e.g. period schedules).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      s_key VARCHAR(64) NOT NULL,
      s_val TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (s_key)
    )
  `);

  // Circulars / Announcements table.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS circulars (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      target_audience VARCHAR(100) NOT NULL DEFAULT 'ALL',
      priority VARCHAR(20) NOT NULL DEFAULT 'Normal',
      created_by VARCHAR(120) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_circ_created_at (created_at)
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

export async function seedSuperadmin(): Promise<void> {
  const superadminHash = bcrypt.hashSync('Hodaids@smvec', 12);
  const adminHash = bcrypt.hashSync('Staffaids@smvec', 12);
  const crHash = bcrypt.hashSync('Cr@aids123', 12);
  const viewerHash = bcrypt.hashSync('viewer@aids123', 12);

  const defaultUsers = [
    { username: 'superadmin', name: 'Super Administrator', role: 'superadmin', hash: superadminHash },
    { username: 'admin', name: 'System Admin', role: 'admin', hash: adminHash },
    { username: 'cr', name: 'Class Representative', role: 'cr', hash: crHash },
    { username: 'viewer', name: 'Viewer User', role: 'user', hash: viewerHash },
    { username: 'user', name: 'View-Only User', role: 'user', hash: viewerHash },
  ];

  for (const u of defaultUsers) {
    await pool.query(
      `INSERT INTO users (username, name, password_hash, role, created_by)
       VALUES (?, ?, ?, ?, 'system')
       ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), password_hash = VALUES(password_hash)`,
      [u.username, u.name, u.hash, u.role]
    );
  }
  logger.info('Seeded/verified default role accounts (superadmin, admin, cr, viewer, user).');
}

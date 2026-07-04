/**
 * Run this script once to create all required tables in TiDB.
 * Usage: node migrate.mjs
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  uri: process.env.TIDB_URL,
  ssl: { rejectUnauthorized: true },
  connectionLimit: 1,
});

const sql = `
CREATE DATABASE IF NOT EXISTS student_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
`;

const tableSql = `
CREATE TABLE IF NOT EXISTS student_portal.students (
  id                 BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(255) NOT NULL,
  register_number    VARCHAR(100) NOT NULL UNIQUE,
  enrollment_number  VARCHAR(100),
  department         VARCHAR(255) NOT NULL,
  batch              VARCHAR(100) NOT NULL,
  phone              VARCHAR(20)  NOT NULL,
  parent_phone       VARCHAR(20)  NOT NULL,
  address            TEXT         NOT NULL,
  college_email      VARCHAR(255),
  personal_email     VARCHAR(255),
  photo_url          TEXT,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name            (name),
  INDEX idx_register_number (register_number),
  INDEX idx_department      (department),
  INDEX idx_batch           (batch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function main() {
  const conn = await pool.getConnection();
  try {
    console.log('Creating database student_portal...');
    await conn.query(sql);
    console.log('Creating students table...');
    await conn.query(tableSql);
    console.log('✅  Database and table ready in TiDB.');
  } finally {
    conn.release();
    await pool.end();
  }
}


main().catch(err => {
  console.error('❌  Migration failed:', err.message);
  process.exit(1);
});

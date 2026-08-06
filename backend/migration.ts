import { pool } from './src/config/db.js';

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS github_stats (
        student_id BIGINT NOT NULL,
        github_username VARCHAR(120) NOT NULL,
        total_repos INT NOT NULL DEFAULT 0,
        total_commits INT NOT NULL DEFAULT 0,
        last_active TIMESTAMP NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (student_id),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);
    console.log('Success!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();

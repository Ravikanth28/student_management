import { pool } from './src/config/db.js';

async function fixTable() {
  try {
    await pool.query('DROP TABLE IF EXISTS feedbacks;');
    await pool.query('DROP TABLE IF EXISTS feedback;');
    
    console.log('Dropped tables, creating feedbacks...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        student_id BIGINT NULL,
        staff_id INT NULL,
        content TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_feedback_student (student_id),
        KEY idx_feedback_staff (staff_id),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
      )
    `);
    console.log('Created feedbacks table correctly.');
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

fixTable();

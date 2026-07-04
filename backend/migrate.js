import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.TIDB_URL) {
  console.error('TIDB_URL is not set. Add it to backend/.env before running this migration.');
  process.exit(1);
}

const pool = mysql.createPool({
  uri: process.env.TIDB_URL,
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
});

async function run() {
  try {
    console.log('Adding section column...');
    await pool.query("ALTER TABLE students ADD COLUMN section VARCHAR(40) NOT NULL DEFAULT 'A' AFTER enrollment_number;");
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') console.log('section column already exists.');
    else throw err;
  }
  
  try {
    console.log('Updating NULL enrollment_numbers to N/A...');
    await pool.query("UPDATE students SET enrollment_number = 'N/A' WHERE enrollment_number IS NULL OR enrollment_number = '';");
    
    console.log('Modifying enrollment_number to NOT NULL...');
    await pool.query("ALTER TABLE students MODIFY COLUMN enrollment_number VARCHAR(40) NOT NULL;");
  } catch (err) {
    console.log('Error updating enrollment_number:', err.message);
  }

  console.log('Done!');
  process.exit(0);
}
run();

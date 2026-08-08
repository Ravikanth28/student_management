import { pool } from './src/config/db.js';

async function checkSchema() {
  try {
    const [rows] = await pool.query('DESCRIBE attendance');
    console.log(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkSchema();

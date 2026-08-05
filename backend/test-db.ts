import { pool } from './src/db.js';

async function test() {
  try {
    const [rows] = await pool.query(
      `SELECT s.section, a.status, s.id as student_id, s.name, s.register_number
       FROM students s
       LEFT JOIN attendance a ON s.id = a.student_id AND a.att_date = ?
       WHERE s.year = ?
       ORDER BY s.section ASC, s.name ASC`,
      ['2026-08-05', '2']
    );
    console.log(`Query succeeded, rows returned: ${rows.length}`);
    if (rows.length === 0) {
      console.log('Zero rows for year=2, let us check if any students exist for year=2...');
      const [all] = await pool.query(`SELECT COUNT(*) as count FROM students WHERE year = '2'`);
      console.log(`Total students for year=2:`, all);
    }
  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    process.exit(0);
  }
}
test();

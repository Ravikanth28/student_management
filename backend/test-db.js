import mysql from 'mysql2/promise';

async function test() {
  const pool = mysql.createPool({
    uri: "mysql://32guEX43yCErFn2.root:zuGj0WD1XWSGi9pY@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/student_portal",
    ssl: { rejectUnauthorized: true }
  });
  
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
        console.log("Zero rows! Checking all students for year 2...");
        const [all] = await pool.query("SELECT COUNT(*) FROM students WHERE year = '2'");
        console.log(all);
    } else {
        console.log(rows[0]);
    }
  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    process.exit(0);
  }
}
test();

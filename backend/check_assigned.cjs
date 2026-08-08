const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({ 
    uri: 'mysql://32guEX43yCErFn2.root:zuGj0WD1XWSGi9pY@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/student_portal',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });
  
  const [feedbacks] = await pool.query(`
    SELECT f.id, f.status, f.created_at, s.name as staff_name, s.id as staff_id
    FROM feedbacks f
    LEFT JOIN staff s ON f.staff_id = s.id
    ORDER BY f.id DESC LIMIT 10
  `);
  console.log('Latest feedbacks:', feedbacks);
  process.exit(0);
}
run();

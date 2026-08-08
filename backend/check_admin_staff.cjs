const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({ 
    uri: 'mysql://32guEX43yCErFn2.root:zuGj0WD1XWSGi9pY@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/student_portal',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });
  
  const [users] = await pool.query("SELECT * FROM users WHERE role = 'admin'");
  console.log('Admin Users:', users);
  
  const [staff] = await pool.query("SELECT * FROM staff WHERE user_id = ?", [users[0].id]);
  console.log('Staff for Admin:', staff);
  
  process.exit(0);
}
run();

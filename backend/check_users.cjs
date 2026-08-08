const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({ 
    uri: 'mysql://32guEX43yCErFn2.root:zuGj0WD1XWSGi9pY@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/student_portal',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });
  
  const [users] = await pool.query("SELECT id, username, role FROM users");
  console.log(users);
  process.exit(0);
}
run();

const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({ 
    uri: 'mysql://32guEX43yCErFn2.root:zuGj0WD1XWSGi9pY@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/student_portal',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });
  
  await pool.query("UPDATE staff SET name = 'Rajan' WHERE emp_id = 'EMP001'");
  console.log('Successfully updated System Admin name to Rajan');
  process.exit(0);
}
run();

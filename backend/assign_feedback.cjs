const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({ 
    uri: 'mysql://32guEX43yCErFn2.root:zuGj0WD1XWSGi9pY@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/student_portal',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });
  
  const [staff] = await pool.query("SELECT id FROM staff WHERE emp_id = 'EMP001'");
  if (staff.length > 0) {
    const staffId = staff[0].id;
    await pool.query("UPDATE feedbacks SET staff_id = ? WHERE status = 'forwarded'", [staffId]);
    console.log('Successfully assigned all forwarded feedbacks to Rajan (staff_id: ' + staffId + ')');
  } else {
    console.log('Staff EMP001 not found');
  }
  process.exit(0);
}
run();

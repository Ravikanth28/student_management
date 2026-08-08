const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({ 
    uri: 'mysql://32guEX43yCErFn2.root:zuGj0WD1XWSGi9pY@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/student_portal',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });
  
  // get admin user
  const [users] = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  const userId = users[0].id;
  
  // get staff profile
  const [staff] = await pool.query("SELECT id FROM staff WHERE user_id = ?", [userId]);
  const profileId = staff[0].id;
  
  // query feedbacks
  const [feedbacks] = await pool.query(`
    SELECT id, content, created_at 
    FROM feedbacks 
    WHERE staff_id = ? AND status = 'forwarded'
    ORDER BY created_at DESC
  `, [profileId]);
  
  console.log('Result for admin (profileId: ' + profileId + '):', feedbacks);
  process.exit(0);
}
run();

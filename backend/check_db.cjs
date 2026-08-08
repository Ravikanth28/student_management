const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({ uri: 'mysql://32guEX43yCErFn2.root:zuGj0WD1XWSGi9pY@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/student_portal' });
  const [users] = await pool.query("SELECT id, username, role FROM users");
  const [staff] = await pool.query('SELECT id, user_id, name, department FROM staff');
  const [feedbacks] = await pool.query('SELECT * FROM feedbacks');
  console.log('Users:', users);
  console.log('Staff:', staff);
  console.log('Feedbacks:', feedbacks);
  process.exit(0);
}
run();

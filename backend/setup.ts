import { pool } from './src/config/db.js';

pool.query(`
  CREATE TABLE IF NOT EXISTS photo_import_history (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    folder_url VARCHAR(500),
    successes JSON,
    errors JSON
  )
`).then(() => {
  console.log('Table created');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

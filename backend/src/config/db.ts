import mysql from 'mysql2/promise';
import { env } from './env.js';

// TiDB Cloud requires SSL — when using the connection string, the driver handles it
// automatically. When using individual params we set ssl explicitly.
export const pool = env.TIDB_URL
  ? mysql.createPool({
      uri: env.TIDB_URL,
      connectionLimit: 10,
      ssl: { rejectUnauthorized: true },
    })
  : mysql.createPool({
      host:            env.DB_HOST,
      port:            env.DB_PORT,
      user:            env.DB_USER,
      password:        env.DB_PASSWORD,
      database:        env.DB_NAME,
      connectionLimit: 10,
      ssl:             { rejectUnauthorized: true },
      namedPlaceholders: true,
    });

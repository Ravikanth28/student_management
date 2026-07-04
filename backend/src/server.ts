import { createServer } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { pool } from './config/db.js';
import { ensureSchema } from './config/initDb.js';

const server = createServer(app);

// Verify/create auxiliary tables before accepting traffic.
ensureSchema()
  .catch((err) => logger.error('Schema init failed (continuing):', err))
  .finally(() => {
    server.listen(env.PORT, () => {
      logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    });
  });

/**
 * Graceful shutdown: stop accepting new connections, drain the DB pool,
 * then exit. Triggered by orchestrators (Docker/Kubernetes/systemd) and Ctrl+C.
 */
let shuttingDown = false;
async function shutdown(signal: string, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Force-exit if cleanup hangs.
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      await pool.end();
    } catch (err) {
      logger.error('Error closing DB pool:', err);
    }
    clearTimeout(forceExit);
    process.exit(code);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// A crashed process is in an undefined state — log and exit so the
// supervisor restarts a clean instance instead of serving corrupt data.
process.on('uncaughtException', (err) => {
  logger.error('[UNCAUGHT EXCEPTION]', err);
  void shutdown('uncaughtException', 1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[UNHANDLED REJECTION]', reason);
  void shutdown('unhandledRejection', 1);
});

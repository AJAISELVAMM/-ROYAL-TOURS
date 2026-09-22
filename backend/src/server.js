// =============================================================================
// server.js — HTTP + Socket.IO bootstrap with graceful shutdown.
// =============================================================================

import http from 'http';
import config from './config/env.js';
import logger from './utils/logger.js';
import app from './app.js';
import { initSocket } from './realtime/socket.js';
import prisma from './config/database.js';

const server = http.createServer(app);
const io = initSocket(server);

const PORT = config.port;

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`TourGuard AI API listening on port ${PORT} (${config.nodeEnv})`);
});

// Graceful shutdown on SIGTERM/SIGINT.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully.`);

  server.close(async () => {
    io.close();
    await prisma.$disconnect();
    logger.info('HTTP server, Socket.IO and database closed.');
    process.exit(0);
  });

  // Force-exit fallback.
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at promise:', { reason: reason?.message || reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { error: error?.message || error });
});

export { server, io };

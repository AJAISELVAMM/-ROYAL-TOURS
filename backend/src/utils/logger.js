// =============================================================================
// logger.js — lightweight structured JSON logger.
// =============================================================================

import config from '../config/env.js';

function log(level, message, meta = {}) {
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  // In production emit pure JSON; in development pretty-print.
  const line = config.isProd ? JSON.stringify(entry) : `[${entry.time}] ${level.toUpperCase()} ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`.trim();
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta)
};

export default logger;

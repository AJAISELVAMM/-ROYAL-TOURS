// =============================================================================
// errorMiddleware.js — 404 handler + global error handler.
// =============================================================================

import config from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { fail } from '../utils/response.js';
import logger from '../utils/logger.js';

export function notFoundHandler(req, res) {
  return fail(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`);
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error(err.message, { code: err.code, stack: err.stack });
    return fail(res, err.status, err.code, err.message, err.details);
  }

  // Zod validation errors are converted by controllers; anything reaching here
  // is unexpected.
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  const status = err.status || err.statusCode || 500;
  return fail(
    res,
    status,
    'INTERNAL_ERROR',
    config.isProd ? 'Something went wrong.' : err.message
  );
}

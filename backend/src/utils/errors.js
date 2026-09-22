// =============================================================================
// errors.js — application error type + helpers.
// =============================================================================

export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const badRequest = (message, code = 'BAD_REQUEST', details) =>
  new AppError(400, code, message, details);
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);
export const forbidden = (message = 'You do not have permission', code = 'FORBIDDEN') =>
  new AppError(403, code, message);
export const notFound = (message = 'Resource not found', code = 'NOT_FOUND') =>
  new AppError(404, code, message);
export const conflict = (message = 'Conflict', code = 'CONFLICT') =>
  new AppError(409, code, message);
export const tooManyRequests = (message = 'Too many requests', code = 'RATE_LIMITED') =>
  new AppError(429, code, message);
export const serviceUnavailable = (
  message = 'This service is temporarily unavailable.',
  code = 'SERVICE_NOT_CONFIGURED'
) => new AppError(503, code, message);
export const validationError = (message, details) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);
export const otpExpired = () =>
  new AppError(400, 'OTP_EXPIRED', 'This code has expired. Please request a new one.');
export const otpInvalid = () =>
  new AppError(400, 'OTP_INVALID', 'Incorrect code. Please check and try again.');

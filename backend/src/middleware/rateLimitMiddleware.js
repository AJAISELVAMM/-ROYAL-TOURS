// =============================================================================
// rateLimitMiddleware.js — per-endpoint rate limiters.
// =============================================================================

import rateLimit from 'express-rate-limit';

const IS_TEST = process.env.NODE_ENV === 'test';

const base = (windowMs, max, message) => {
  // In tests, rate limits are disabled so the suite can log in repeatedly.
  if (IS_TEST) {
    return (_req, _res, next) => next();
  }
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: message || 'Too many requests. Please try again later.' }
      })
  });
};

export const loginLimiter = base(15 * 60 * 1000, 20, 'Too many login attempts. Try again later.');
export const registerLimiter = base(60 * 60 * 1000, 10, 'Too many registration attempts.');
export const otpLimiter = base(15 * 60 * 1000, 10, 'Too many OTP requests. Try again later.');
export const translationLimiter = base(60 * 1000, 30, 'Translation rate limit reached.');
export const routeLimiter = base(60 * 1000, 120, 'Route request rate limit reached.');
// SOS must be spam-protected but remain available for genuine emergencies.
export const sosLimiter = base(60 * 1000, 10, 'Too many SOS requests. Contact emergency services directly if needed.');
// ML / intelligence endpoints (fare/safety prediction, route optimization).
export const intelligenceLimiter = base(60 * 1000, 60, 'Intelligence request rate limit reached.');

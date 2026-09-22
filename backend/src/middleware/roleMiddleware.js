// =============================================================================
// roleMiddleware.js — role-based authorization.
// =============================================================================

import { forbidden } from '../utils/errors.js';

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(forbidden('Authentication required.'));
    if (!roles.includes(req.user.role)) {
      return next(forbidden('You do not have permission to perform this action.'));
    }
    next();
  };
}

export const requireAdmin = requireRole('ADMIN');
export const requireTourist = requireRole('TOURIST', 'ADMIN');

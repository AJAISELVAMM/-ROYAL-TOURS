// =============================================================================
// response.js — consistent API response helpers.
// =============================================================================

export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function created(res, data) {
  return res.status(201).json({ success: true, data });
}

export function fail(res, status, code, message, details) {
  return res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) }
  });
}

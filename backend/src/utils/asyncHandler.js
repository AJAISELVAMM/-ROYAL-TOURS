// Wraps an async route handler so thrown/rejected errors reach the global
// error middleware (Express 4 does not catch async errors automatically).

export default function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

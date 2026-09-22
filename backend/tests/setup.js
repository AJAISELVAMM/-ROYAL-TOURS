// Ensure a non-production environment for tests so JWT/secrets are lenient and
// mock provider fallbacks (devOtp etc.) are available.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

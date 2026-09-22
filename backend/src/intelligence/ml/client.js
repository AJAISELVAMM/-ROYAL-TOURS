// =============================================================================
// ml/client.js — thin HTTP client for the (optional) ML inference service.
//
// The Node backend talks to a FastAPI service that serves the trained
// Random Forest models. If ML_SERVICE_URL is unset or the service is down,
// callers catch the returned failure and fall back to deterministic engines.
// The application NEVER crashes because the ML service is unavailable.
// =============================================================================

import config from '../../config/env.js';

export function mlConfigured() {
  return !!(config.mlServiceUrl && String(config.mlServiceUrl).trim());
}

export function mlServiceUrl() {
  return String(config.mlServiceUrl || '').trim().replace(/\/+$/, '');
}

// POST to {base}/predict/{model}; returns parsed JSON or throws on any failure.
export async function predict(model, payload, { timeoutMs = 3000 } = {}) {
  const base = mlServiceUrl();
  if (!base) {
    const e = new Error('ML service is not configured.');
    e.code = 'ML_NOT_CONFIGURED';
    throw e;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/predict/${model}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!res.ok) {
      const e = new Error(`ML service returned ${res.status}.`);
      e.code = 'ML_SERVICE_ERROR';
      throw e;
    }
    return await res.json();
  } catch (err) {
    if (err && err.name === 'AbortError') {
      const e = new Error('ML service timed out.');
      e.code = 'ML_TIMEOUT';
      throw e;
    }
    if (err.code) throw err;
    const e = new Error('ML service unavailable.');
    e.code = 'ML_UNAVAILABLE';
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function health() {
  const base = mlServiceUrl();
  if (!base) return { configured: false };
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
    return { configured: true, healthy: res.ok };
  } catch {
    return { configured: true, healthy: false };
  }
}

// ============================================================================
// api.js — thin fetch wrapper for the TourGuard AI backend.
// Handles the JSON envelope ({ success, data, error }), Authorization header,
// and transparent access-token refresh on 401.
// ============================================================================

const envApiUrl = import.meta.env?.VITE_API_URL?.trim();
const API_BASE = envApiUrl
  ? (envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl.replace(/\/+$/, '')}/api`)
  : '/api';

// Read initial tokens synchronously from localStorage so requests on reload are authenticated
function readStoredTokens() {
  try {
    const raw = localStorage.getItem('tourguard_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        accessToken: parsed?.accessToken || null,
        refreshToken: parsed?.refreshToken || null
      };
    }
  } catch {}
  return { accessToken: null, refreshToken: null };
}

const initialTokens = readStoredTokens();
let accessToken = initialTokens.accessToken;
let refreshToken = initialTokens.refreshToken;
let onUnauthorized = null; // set by AuthContext to force logout on refresh failure

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function setTokens({ accessToken: at, refreshToken: rt }) {
  accessToken = at || null;
  refreshToken = rt || null;
  try {
    const raw = localStorage.getItem('tourguard_session');
    if (raw) {
      const sess = JSON.parse(raw);
      if (sess && typeof sess === 'object') {
        if (at !== undefined) sess.accessToken = at;
        if (rt !== undefined) sess.refreshToken = rt;
        localStorage.setItem('tourguard_session', JSON.stringify(sess));
      }
    }
  } catch {}
}

export function getAccessToken() {
  return accessToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function fetchWithRetry(url, options = {}, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      // If Render returns 502/503/504 while waking up from cold start, retry
      if (!res.ok && [502, 503, 504].includes(res.status) && i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

let refreshPromise = null;

async function tryRefresh() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      if (!refreshToken) {
        const stored = readStoredTokens();
        if (stored.refreshToken) {
          refreshToken = stored.refreshToken;
          accessToken = stored.accessToken;
        } else {
          return false;
        }
      }

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json?.data?.accessToken) {
        return false;
      }

      setTokens({
        accessToken: json.data.accessToken,
        refreshToken: json.data.refreshToken || refreshToken
      });
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

let isBackendWarm = false;
let backendReadyPromise = null;

export async function pingBackendHealth() {
  if (isBackendWarm) return true;
  try {
    const rootUrl = envApiUrl ? envApiUrl.replace(/\/api\/?$/, '') : '';
    const target = rootUrl ? `${rootUrl}/health` : '/health';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(target, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      isBackendWarm = true;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function waitForBackendReady({ timeoutMs = 45000, initialIntervalMs = 2000 } = {}) {
  if (isBackendWarm) return true;
  if (backendReadyPromise) return backendReadyPromise;

  backendReadyPromise = (async () => {
    const startTime = Date.now();
    let currentInterval = initialIntervalMs;
    const rootUrl = envApiUrl ? envApiUrl.replace(/\/api\/?$/, '') : '';
    const target = rootUrl ? `${rootUrl}/health` : '/health';

    while (Date.now() - startTime < timeoutMs) {
      const controller = new AbortController();
      const perReqTimeout = Math.min(7000, timeoutMs - (Date.now() - startTime));
      const timer = setTimeout(() => controller.abort(), Math.max(1000, perReqTimeout));

      try {
        const res = await fetch(target, { method: 'GET', signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          isBackendWarm = true;
          return true;
        }
      } catch {
        clearTimeout(timer);
      }

      if (Date.now() - startTime >= timeoutMs) break;

      // Controlled backoff delay between wake-up attempts (no request storm)
      await new Promise((resolve) => setTimeout(resolve, currentInterval));
      currentInterval = Math.min(currentInterval * 1.25, 3500);
    }

    backendReadyPromise = null;
    return false;
  })();

  try {
    const result = await backendReadyPromise;
    return result;
  } finally {
    if (!isBackendWarm) {
      backendReadyPromise = null;
    }
  }
}

export async function apiFetch(path, { method = 'GET', body, auth = true, signal } = {}) {
  const build = () => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return headers;
  };

  let res = await fetchWithRetry(API_BASE + path, {
    method,
    headers: build(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal
  });

  // Attempt a single transparent deduplicated refresh + retry on 401.
  if (res.status === 401 && auth && (refreshToken || readStoredTokens().refreshToken)) {
    const ok = await tryRefresh();
    if (ok) {
      res = await fetchWithRetry(API_BASE + path, {
        method,
        headers: build(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal
      });
    } else if (onUnauthorized) {
      onUnauthorized();
    }
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      json?.error?.code || 'ERROR',
      json?.error?.message || 'Something went wrong. Please try again.',
      res.status
    );
  }

  return json?.data ?? null;
}

export const api = {
  get: (path, opts) => apiFetch(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiFetch(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => apiFetch(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => apiFetch(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => apiFetch(path, { ...opts, method: 'DELETE' })
};

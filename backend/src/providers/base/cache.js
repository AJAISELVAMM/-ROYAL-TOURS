// =============================================================================
// cache.js — In-memory TTL & LRU cache for external API/dataset queries.
// Prevents duplicate external requests, respects free-tier limits, and speeds up
// repeat location queries.
// =============================================================================

class MemoryCache {
  constructor({ defaultTtlMs = 15 * 60 * 1000, maxEntries = 500 } = {}) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  _generateKey(category, query) {
    if (typeof query === 'string') return `${category}:${query.trim().toLowerCase()}`;
    if (typeof query === 'object' && query !== null) {
      // Normalize coordinate precision to 3 decimals (~110m) for cache hits in same locality
      const normalized = { ...query };
      if (normalized.lat != null) normalized.lat = +Number(normalized.lat).toFixed(3);
      if (normalized.lon != null) normalized.lon = +Number(normalized.lon).toFixed(3);
      if (normalized.latitude != null) normalized.latitude = +Number(normalized.latitude).toFixed(3);
      if (normalized.longitude != null) normalized.longitude = +Number(normalized.longitude).toFixed(3);
      return `${category}:${JSON.stringify(normalized)}`;
    }
    return `${category}:${String(query)}`;
  }

  get(category, query) {
    const key = this._generateKey(category, query);
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Refresh LRU order (delete and re-insert)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(category, query, value, ttlMs = this.defaultTtlMs) {
    const key = this._generateKey(category, query);

    // Evict oldest item if capacity is exceeded
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      cachedAt: new Date().toISOString()
    });
    return value;
  }

  has(category, query) {
    return this.get(category, query) !== null;
  }

  clear() {
    this.store.clear();
  }

  size() {
    return this.store.size;
  }
}

export const providerCache = new MemoryCache({
  defaultTtlMs: 20 * 60 * 1000, // 20 minutes default TTL
  maxEntries: 1000
});

export default providerCache;

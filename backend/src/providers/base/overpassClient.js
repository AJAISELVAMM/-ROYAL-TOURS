// =============================================================================
// overpassClient.js — OpenStreetMap Overpass API client with mirror rotation.
// Supports node + way + relation queries with center coordinate extraction.
// =============================================================================

import providerCache from './cache.js';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

let activeEndpointIndex = 0;

/**
 * Execute an Overpass QL query with mirror fallback and caching.
 * The query body should be the full [out:json]... string.
 * @param {string} fullQuery - Complete Overpass QL query
 * @param {object} options
 * @returns {Promise<Array>} List of raw OSM elements
 */
export async function queryOverpass(fullQuery, { timeoutMs, cacheKey = null, ttlMs } = {}) {
  const isMock = String(process.env.MOCK_EXTERNAL_SERVICES || 'false').toLowerCase() === 'true';
  if (isMock) return [];

  const effectiveTimeout = Math.min(timeoutMs || 7000, 10000);

  if (cacheKey) {
    const cached = providerCache.get('overpass', cacheKey);
    if (cached) return cached;
  }

  const totalEndpoints = OVERPASS_ENDPOINTS.length;
  for (let attempt = 0; attempt < totalEndpoints; attempt++) {
    const idx = (activeEndpointIndex + attempt) % totalEndpoints;
    const endpoint = OVERPASS_ENDPOINTS[idx];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TourGuard-App/1.0 (https://tourguard.ai; dev@tourguard.ai)',
          'From': 'dev@tourguard.ai'
        },
        body: `data=${encodeURIComponent(fullQuery)}`,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        continue;
      }

      const json = await response.json();
      const elements = json?.elements || [];

      // Remember working mirror for subsequent requests
      activeEndpointIndex = idx;

      if (cacheKey && elements.length > 0) {
        providerCache.set('overpass', cacheKey, elements, ttlMs || 20 * 60 * 1000);
      }

      if (elements.length > 0) {
        return elements;
      }
    } catch {
      clearTimeout(timeoutId);
      // Failover to next mirror
    }
  }

  return [];
}

/**
 * Build a union query (node + way) for given tags around coordinates.
 * Notice: Nodes and ways represent 99.9% of real POIs. Omitting relations avoids
 * heavy regional relation scans that cause Overpass timeouts over 60km.
 * @param {number} lat
 * @param {number} lon
 * @param {number} radius - meters
 * @param {string[]} tagFilters - OSM tag filter strings e.g. ['"tourism"="hotel"', '"amenity"="cafe"']
 * @param {number} timeoutSecs - Overpass query timeout in seconds
 * @param {number} limit - maximum elements to return (defaults to 150)
 * @returns {string} Full Overpass QL query string
 */
export function buildUnionQuery(lat, lon, radius = 60000, tagFilters = [], timeoutSecs = 15, limit = 150) {
  const parts = [];
  for (const tag of tagFilters) {
    parts.push(`  node[${tag}](around:${radius},${lat},${lon});`);
    parts.push(`  way[${tag}](around:${radius},${lat},${lon});`);
  }
  return `[out:json][timeout:${timeoutSecs}];\n(\n${parts.join('\n')}\n);\nout center tags ${limit};\n`;
}

/**
 * Legacy helper kept for backward compatibility — builds node+way selector lines only.
 * Prefer buildUnionQuery for new code.
 */
export function buildAroundQuery(lat, lon, radius = 5000, selectors = [], timeoutSecs = 15, limit = 50) {
  const parts = selectors.map((sel) => {
    const trimmed = sel.trim().replace(/;$/, '');
    if (trimmed.includes('(around:')) return `  ${trimmed};`;
    return `  ${trimmed}(around:${radius},${lat},${lon});`;
  }).join('\n');
  return `[out:json][timeout:${timeoutSecs}];\n(\n${parts}\n);\nout center tags ${limit};\n`;
}

/**
 * Extract lat/lon from an OSM element (node or center of way/relation).
 */
export function getElementCoords(el) {
  if (el.lat != null && el.lon != null) {
    return { latitude: el.lat, longitude: el.lon };
  }
  if (el.center && el.center.lat != null && el.center.lon != null) {
    return { latitude: el.center.lat, longitude: el.center.lon };
  }
  return { latitude: null, longitude: null };
}

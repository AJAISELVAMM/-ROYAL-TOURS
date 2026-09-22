// =============================================================================
// weatherService.js — Frontend Weather API Service with in-memory caching.
// =============================================================================

import { api } from './api.js';

const weatherCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export async function getLiveWeather(latitude, longitude) {
  const roundedLat = latitude != null ? Number(latitude).toFixed(2) : null;
  const roundedLon = longitude != null ? Number(longitude).toFixed(2) : null;
  const cacheKey = `${roundedLat},${roundedLon}`;

  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const params = new URLSearchParams();
  if (latitude != null) params.append('latitude', latitude);
  if (longitude != null) params.append('longitude', longitude);

  const data = await api.get(`/weather?${params.toString()}`);
  if (data) {
    weatherCache.set(cacheKey, { data, timestamp: Date.now() });
  }
  return data;
}


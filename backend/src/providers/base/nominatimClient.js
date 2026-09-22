// =============================================================================
// nominatimClient.js — OpenStreetMap Nominatim bounded POI search client.
// High-reliability no-API-key fallback for local places, hotels, food & shopping.
// =============================================================================

import providerCache from './cache.js';
import { normalizePoi, haversineDistanceKm } from './normalizer.js';

/**
 * Search real OpenStreetMap POIs within a bounded geographic viewbox around coordinates.
 * @param {object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {number} params.radiusMeters
 * @param {string[]} params.keywords - Search terms (e.g. ['attraction', 'museum'])
 * @param {number} params.limit
 * @param {string} params.category
 * @returns {Promise<Array>} List of normalized POI objects
 */
export async function queryNominatimPois({
  latitude,
  longitude,
  radiusMeters = 60000,
  keywords = [],
  limit = 25,
  category = 'facility'
}) {
  if (latitude == null || longitude == null) return [];

  const lat = Number(latitude);
  const lon = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return [];

  const radiusKm = Math.min(Math.max(radiusMeters / 1000, 3), 65);
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.1));
  const viewbox = `${lon - lonDelta},${lat + latDelta},${lon + lonDelta},${lat - latDelta}`;

  const cacheKey = `nominatim_pois_v2:${lat.toFixed(3)}:${lon.toFixed(3)}:${radiusKm}:${keywords.join(',')}:${limit}`;
  const cached = providerCache.get('nominatim_poi', cacheKey);
  if (cached) return cached;

  const results = [];
  const seenIds = new Set();
  const searchTerms = keywords.length > 0 ? keywords.slice(0, 3) : ['point_of_interest'];

  for (const term of searchTerms) {
    if (results.length >= limit) break;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(term)}&viewbox=${viewbox}&bounded=1&format=json&limit=${Math.min(limit, 20)}&addressdetails=1`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'TourGuard-AI/1.0 (Public Safety & Tourism Assistant; admin@tourguard.ai)',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        let items = [];
        try {
          items = JSON.parse(text);
        } catch {
          items = [];
        }

        if (Array.isArray(items)) {
          for (const item of items) {
            const itemLat = parseFloat(item.lat);
            const itemLon = parseFloat(item.lon);
            if (Number.isNaN(itemLat) || Number.isNaN(itemLon)) continue;

            const dist = haversineDistanceKm(lat, lon, itemLat, itemLon);
            if (dist == null || dist > radiusKm) continue;

            const id = `${item.osm_type || 'node'}_${item.osm_id || item.place_id}`;
            if (seenIds.has(id)) continue;
            seenIds.add(id);

            const displayName = item.display_name || '';
            const rawName = item.name || (displayName ? displayName.split(',')[0].trim() : '');
            if (!rawName || rawName.length < 2) continue;

            results.push(normalizePoi({
              id: `nominatim_${id}`,
              name: rawName,
              category: item.type || category,
              address: displayName || null,
              latitude: itemLat,
              longitude: itemLon,
              phone: null,
              rating: null,
              reviews: 0,
              openingHours: null,
              description: null,
              source: 'nominatim_osm',
              sourceUrl: `https://www.openstreetmap.org/${item.osm_type || 'node'}/${item.osm_id || item.place_id}`,
              verified: true,
              distanceKm: Math.round(dist * 10) / 10
            }));
          }
        }
      }
    } catch {
      // Graceful fallback to next term
    }
  }

  // Sort ascending by distance
  results.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

  if (results.length > 0) {
    providerCache.set('nominatim_poi', cacheKey, results, 15 * 60 * 1000);
  }

  return results.slice(0, limit);
}

export default {
  queryNominatimPois
};

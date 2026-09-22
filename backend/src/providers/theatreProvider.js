// =============================================================================
// theatreProvider.js — Theatres, Cinemas & Multiplexes POI provider.
// Queries OpenStreetMap Overpass (amenity=cinema, amenity=theatre) with
// node+way+relation for a 60km radius. No mock/fake data. No DB wrong-city fallback.
// =============================================================================

import prisma from '../config/database.js';
import config from '../config/env.js';
import { queryOverpass, buildUnionQuery, getElementCoords } from './base/overpassClient.js';
import { queryNominatimPois } from './base/nominatimClient.js';
import { normalizePoi, formatAddressFromOsmTags, haversineDistanceKm } from './base/normalizer.js';
import providerCache from './base/cache.js';
import * as geoapifyProvider from './geoapifyProvider.js';

export const PROVIDER_NAME = 'theatreProvider';

const DEFAULT_RADIUS = 60000; // 60 km
const DISTANCE_LIMIT_KM = 65; // Approximately 60 km with border tolerance

export async function searchTheatres({
  latitude,
  longitude,
  radius = DEFAULT_RADIUS,
  search = '',
  limit = 50
} = {}) {
  const effectiveRadius = Math.min(Number(radius) || DEFAULT_RADIUS, DEFAULT_RADIUS);
  const latStr = latitude != null ? Number(latitude).toFixed(3) : '';
  const lonStr = longitude != null ? Number(longitude).toFixed(3) : '';
  const cacheKey = `theatres_v4:${latStr}:${lonStr}:${effectiveRadius}`;

  const cached = providerCache.get('theatres', cacheKey);
  if (cached) {
    let results = cached;
    if (search) {
      const q = search.toLowerCase();
      results = results.filter((t) => t.name.toLowerCase().includes(q) || (t.address && t.address.toLowerCase().includes(q)));
    }
    return results.slice(0, limit);
  }

  let results = [];

  // Tier 1a: Geoapify if configured
  if (config.geoapifyApiKey) {
    try {
      results = await geoapifyProvider.searchCategory({
        category: 'entertainment.cinema,entertainment.culture.theatre',
        latitude,
        longitude,
        radiusMeters: effectiveRadius,
        search,
        limit
      });
      // Filter by actual 60km distance
      if (results.length > 0 && latitude != null && longitude != null) {
        results = results.filter((r) => {
          if (r.distanceKm == null) return true;
          return r.distanceKm <= DISTANCE_LIMIT_KM;
        });
      }
    } catch {
      // continue to Overpass
    }
  }

  // Tier 1b: Live Overpass query (node + way, 60km)
  if (results.length === 0 && latitude != null && longitude != null) {
    results = await fetchFromOverpass(latitude, longitude, effectiveRadius, limit);
  }

  // Tier 2: Nominatim POI live query fallback
  if (results.length === 0 && latitude != null && longitude != null) {
    try {
      const nomTheatres = await queryNominatimPois({
        latitude,
        longitude,
        radiusMeters: effectiveRadius,
        keywords: ['cinema', 'theatre', 'movie theatre', 'multiplex'],
        limit: 25,
        category: 'Cinema & Multiplex'
      });
      if (nomTheatres && nomTheatres.length > 0) {
        results = nomTheatres;
      }
    } catch (nomErr) {
      console.warn(`[theatreProvider] Nominatim fallback failed: ${nomErr.message}`);
    }
  }

  // Tier 3: Database fallback — strictly within 65km distance
  if (results.length === 0 && latitude != null && longitude != null) {
    results = await fetchFromDatabase({ latitude, longitude, limit });
  }

  // Cache raw results (before search filter)
  if (results.length > 0) {
    providerCache.set('theatres', cacheKey, results, 20 * 60 * 1000);
    results.forEach((it) => {
      if (it?.id) providerCache.set('poi_item', it.id, it);
    });
  }

  // Apply search filter
  if (search && results.length > 0) {
    const q = search.toLowerCase();
    results = results.filter((t) => t.name.toLowerCase().includes(q) || (t.address && t.address.toLowerCase().includes(q)));
  }

  return results.slice(0, limit);
}

async function fetchFromOverpass(lat, lon, radius, limit) {
  const fullQuery = `[out:json][timeout:25];
(
  node["amenity"~"^(cinema|theatre)$"](around:${radius},${lat},${lon});
  way["amenity"~"^(cinema|theatre)$"](around:${radius},${lat},${lon});
);
out center tags 60;\n`;

  const cacheKey = `overpass_theatres_v3:${lat.toFixed(3)}:${lon.toFixed(3)}:${radius}`;

  let elements;
  try {
    elements = await queryOverpass(fullQuery, {
      cacheKey,
      timeoutMs: 12000,
      ttlMs: 20 * 60 * 1000
    });
  } catch (err) {
    console.warn(`[theatreProvider:overpass] Request failed: ${err.message}`);
    return [];
  }

  if (!elements || elements.length === 0) return [];

  const seen = new Set();
  const results = [];

  for (const el of elements) {
    const coords = getElementCoords(el);
    const tags = el.tags || {};

    if (coords.latitude == null || coords.longitude == null) continue;

    // Skip unnamed theatres/cinemas
    const name = tags.name || tags['name:en'] || tags['name:ta'] || tags['name:hi'] || tags['name:ml'];
    if (!name || name.trim().length < 2) continue;

    // Dedup by OSM type+id (a node and way can share the same numeric id)
    const osmKey = `${el.type}_${el.id}`;
    if (seen.has(osmKey)) continue;
    seen.add(osmKey);

    const distanceKm = haversineDistanceKm(lat, lon, coords.latitude, coords.longitude);
    if (distanceKm != null && distanceKm > DISTANCE_LIMIT_KM) continue;

    const screens = tags.screens ? parseInt(tags.screens, 10) : undefined;

    results.push(normalizePoi({
      id: `theatre_osm_${el.type}_${el.id}`,
      name: name.trim(),
      category: tags.amenity === 'theatre' ? 'Theatre & Performing Arts' : 'Cinema & Multiplex',
      type: 'THEATRE',
      address: formatAddressFromOsmTags(tags),
      latitude: coords.latitude,
      longitude: coords.longitude,
      distanceKm: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
      phone: tags.phone || tags['contact:phone'] || null,
      website: tags.website || tags['contact:website'] || null,
      openingHours: tags.opening_hours || null,
      screens,
      rating: null, // OSM does not provide reliable ratings — no fake data
      source: 'OpenStreetMap',
      sourceUrl: tags.website || `https://www.openstreetmap.org/${el.type}/${el.id}`,
      verified: Boolean(tags.wikidata || tags.operator)
    }));
  }

  return results.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999)).slice(0, limit);
}

async function fetchFromDatabase({ latitude, longitude, search, limit }) {
  if (latitude == null || longitude == null) return [];
  try {
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (latitude != null && longitude != null) {
      const latDelta = (DISTANCE_LIMIT_KM / 111) * 1.05;
      const lonDelta = (DISTANCE_LIMIT_KM / (111 * Math.max(0.1, Math.cos(Number(latitude) * Math.PI / 180)))) * 1.05;
      where.latitude = { gte: Number(latitude) - latDelta, lte: Number(latitude) + latDelta };
      where.longitude = { gte: Number(longitude) - lonDelta, lte: Number(longitude) + lonDelta };
    }

    const dbItems = await prisma.theatre.findMany({
      where,
      take: (limit || 50) * 2,
      orderBy: { rating: 'desc' }
    });

    return dbItems
      .map((t) => {
        const dist =
          latitude != null && longitude != null && t.latitude != null && t.longitude != null
            ? haversineDistanceKm(latitude, longitude, t.latitude, t.longitude)
            : t.distanceKm;

        if (dist != null && dist > DISTANCE_LIMIT_KM) return null;

        return {
          ...t,
          category: 'Cinema & Multiplex',
          distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
          source: 'database'
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  } catch {
    return [];
  }
}

export default {
  PROVIDER_NAME,
  searchTheatres
};

// =============================================================================
// shoppingProvider.js — Shopping / Supermarkets / Markets / Malls provider.
// Uses OpenStreetMap Overpass (node+way+relation) with 60km radius.
// No mock data. No fake ratings. Haversine distance filtering.
// =============================================================================

import prisma from '../config/database.js';
import { queryOverpass, buildUnionQuery, getElementCoords } from './base/overpassClient.js';
import { queryNominatimPois } from './base/nominatimClient.js';
import { normalizePoi, formatAddressFromOsmTags, haversineDistanceKm } from './base/normalizer.js';
import providerCache from './base/cache.js';

export const PROVIDER_NAME = 'shoppingProvider';

const DEFAULT_RADIUS = 60000; // 60 km
const DISTANCE_LIMIT_KM = 65; // Approximately 60 km with border tolerance

export async function searchShopping({
  latitude,
  longitude,
  radius = DEFAULT_RADIUS,
  search = '',
  category = null,
  limit = 50
} = {}) {
  const effectiveRadius = Math.min(Number(radius) || DEFAULT_RADIUS, DEFAULT_RADIUS);
  const latStr = latitude != null ? Number(latitude).toFixed(3) : '';
  const lonStr = longitude != null ? Number(longitude).toFixed(3) : '';
  const cacheKey = `shopping_v3:${latStr}:${lonStr}:${effectiveRadius}`;

  const cached = providerCache.get('shopping', cacheKey);
  if (cached) {
    let results = cached;
    if (search) results = results.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
    return results.slice(0, limit);
  }

  let results = [];

  // Tier 1: Overpass live query (node + way, 60km)
  if (latitude != null && longitude != null) {
    results = await fetchFromOverpass(latitude, longitude, effectiveRadius);
  }

  // Tier 2: Nominatim POI live query fallback
  if (results.length === 0 && latitude != null && longitude != null) {
    try {
      const nomShopping = await queryNominatimPois({
        latitude,
        longitude,
        radiusMeters: effectiveRadius,
        keywords: ['mall', 'supermarket', 'market', 'shopping'],
        limit: 30,
        category: 'Shopping Spot'
      });
      if (nomShopping && nomShopping.length > 0) {
        results = nomShopping;
      }
    } catch (nomErr) {
      console.warn(`[shoppingProvider] Nominatim fallback failed: ${nomErr.message}`);
    }
  }

  // Tier 3: Database fallback — strictly within distance
  if (results.length === 0 && latitude != null && longitude != null) {
    results = await fetchFromDatabase({ latitude, longitude, limit: limit * 2 });
  }

  // Cache raw results
  if (results.length > 0) {
    providerCache.set('shopping', cacheKey, results, 20 * 60 * 1000);
  }

  // Apply filters
  if (search) results = results.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return results.slice(0, limit);
}

async function fetchFromOverpass(lat, lon, radius) {
  const query = `[out:json][timeout:25];
(
  node["shop"~"^(mall|shopping_centre|department_store|supermarket|convenience|market|marketplace|clothes|gift|shoes|electronics|jewellery|textiles|handicraft)$"](around:${radius},${lat},${lon});
  way["shop"~"^(mall|shopping_centre|department_store|supermarket|convenience|market|marketplace|clothes|gift|shoes|electronics|jewellery|textiles|handicraft)$"](around:${radius},${lat},${lon});
  node["amenity"="marketplace"](around:${radius},${lat},${lon});
  way["amenity"="marketplace"](around:${radius},${lat},${lon});
);
out center tags 100;`;

  const elements = await queryOverpass(query, {
    cacheKey: `overpass_shopping_${lat.toFixed(3)}_${lon.toFixed(3)}_${radius}`,
    timeoutMs: 12000
  });

  const seen = new Set();
  const results = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const coords = getElementCoords(el);
    if (coords.latitude == null || coords.longitude == null) continue;

    // Skip unnamed
    const name = tags.name || tags['name:en'] || tags['name:ta'] || '';
    if (!name || name.length < 2) continue;

    // Dedup by OSM id
    const osmKey = `${el.type}_${el.id}`;
    if (seen.has(osmKey)) continue;
    seen.add(osmKey);

    const dist = haversineDistanceKm(lat, lon, coords.latitude, coords.longitude);
    if (dist != null && dist > DISTANCE_LIMIT_KM) continue;

    let shopType = 'Shopping Spot';
    if (tags.shop === 'mall') shopType = 'Shopping Mall';
    else if (tags.shop === 'department_store') shopType = 'Department Store';
    else if (tags.shop === 'supermarket') shopType = 'Supermarket';
    else if (tags.shop === 'convenience') shopType = 'Convenience Store';
    else if (tags.shop === 'clothes' || tags.shop === 'textiles') shopType = 'Clothing & Textiles';
    else if (tags.shop === 'gift' || tags.shop === 'handicraft') shopType = 'Gifts & Handicrafts';
    else if (tags.shop === 'shoes') shopType = 'Footwear';
    else if (tags.shop === 'electronics') shopType = 'Electronics';
    else if (tags.shop === 'jewellery') shopType = 'Jewellery';
    else if (tags.shop === 'marketplace' || tags.amenity === 'marketplace') shopType = 'Market / Bazaar';

    results.push(normalizePoi({
      id: `osm_shop_${el.type}_${el.id}`,
      name,
      category: shopType,
      address: formatAddressFromOsmTags(tags),
      latitude: coords.latitude,
      longitude: coords.longitude,
      phone: tags['phone'] || tags['contact:phone'] || null,
      rating: null, // No fake ratings
      reviews: 0,
      openingHours: tags.opening_hours || null,
      description: tags.description || null,
      source: 'open_public_osm',
      sourceUrl: tags.website || (tags['wikidata'] ? `https://www.wikidata.org/wiki/${tags['wikidata']}` : 'https://www.openstreetmap.org'),
      verified: Boolean(tags.wikidata || tags.operator),
      distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
      extra: {
        shopType,
        brand: tags.brand || null
      }
    }));
  }

  return results.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
}

async function fetchFromDatabase({ latitude, longitude, limit }) {
  if (latitude == null || longitude == null) return [];
  try {
    const latDelta = (DISTANCE_LIMIT_KM / 111) * 1.05;
    const lonDelta = (DISTANCE_LIMIT_KM / (111 * Math.max(0.1, Math.cos(Number(latitude) * Math.PI / 180)))) * 1.05;
    const where = {
      latitude: { gte: Number(latitude) - latDelta, lte: Number(latitude) + latDelta },
      longitude: { gte: Number(longitude) - lonDelta, lte: Number(longitude) + lonDelta }
    };

    let records = await prisma.shopping.findMany({ where, take: limit || 60, orderBy: { rating: 'desc' } });

    // Also check places table for verified markets & shopping spots if few records
    if (records.length < 5 && latitude != null && longitude != null) {
      const latDelta = (DISTANCE_LIMIT_KM / 111) * 1.05;
      const lonDelta = (DISTANCE_LIMIT_KM / (111 * Math.max(0.1, Math.cos(Number(latitude) * Math.PI / 180)))) * 1.05;
      const extraPlaces = await prisma.place.findMany({
        where: {
          category: { contains: 'Shopping', mode: 'insensitive' },
          latitude: { gte: Number(latitude) - latDelta, lte: Number(latitude) + latDelta },
          longitude: { gte: Number(longitude) - lonDelta, lte: Number(longitude) + lonDelta }
        },
        take: 20
      });
      if (extraPlaces.length > 0) {
        records = [...records, ...extraPlaces];
      }
    }

    return records
      .map((s) => {
        const dist = latitude != null && longitude != null && s.latitude != null && s.longitude != null
          ? haversineDistanceKm(latitude, longitude, s.latitude, s.longitude)
          : null;
        if (dist != null && dist > DISTANCE_LIMIT_KM) return null;

        return normalizePoi({
          id: s.id,
          name: s.name,
          category: s.category || 'Shopping',
          address: s.address || s.location || null,
          latitude: s.latitude,
          longitude: s.longitude,
          phone: s.contact || null,
          rating: s.rating,
          reviews: 0,
          openingHours: s.openingHours || null,
          description: s.description,
          source: s.source || 'seed_database',
          sourceUrl: null,
          verified: s.verified,
          distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
          extra: { shopType: s.category || 'Shopping Spot' }
        });
      })
      .filter(Boolean)
      .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  } catch (err) {
    console.warn(`[shoppingProvider] DB fallback failed: ${err.message}`);
    return [];
  }
}

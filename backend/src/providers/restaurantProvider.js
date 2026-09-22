// =============================================================================
// restaurantProvider.js — Restaurant / Food data provider.
// Uses OpenStreetMap Overpass (node+way+relation) with 60km radius.
// No mock data. No fake ratings. Haversine distance filtering.
// =============================================================================

import prisma from '../config/database.js';
import { queryOverpass, getElementCoords } from './base/overpassClient.js';
import { queryNominatimPois } from './base/nominatimClient.js';
import { normalizePoi, formatAddressFromOsmTags, haversineDistanceKm } from './base/normalizer.js';
import providerCache from './base/cache.js';

export const PROVIDER_NAME = 'restaurantProvider';

const DEFAULT_RADIUS = 60000; // 60 km
const DISTANCE_LIMIT_KM = 65; // Approximately 60 km with border tolerance

export async function searchRestaurants({
  latitude,
  longitude,
  radius = DEFAULT_RADIUS,
  search = '',
  cuisine = '',
  vegOnly = false,
  limit = 50
} = {}) {
  const effectiveRadius = Math.min(Number(radius) || DEFAULT_RADIUS, DEFAULT_RADIUS);
  const latStr = latitude != null ? Number(latitude).toFixed(3) : '';
  const lonStr = longitude != null ? Number(longitude).toFixed(3) : '';
  const cacheKey = `restaurants_v3:${latStr}:${lonStr}:${effectiveRadius}`;

  const cached = providerCache.get('restaurants', cacheKey);
  if (cached) {
    let results = cached;
    if (search) results = results.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) || (r.cuisine && r.cuisine.toLowerCase().includes(search.toLowerCase())));
    if (vegOnly) results = results.filter((r) => r.veg === true);
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
      const nomRestaurants = await queryNominatimPois({
        latitude,
        longitude,
        radiusMeters: effectiveRadius,
        keywords: ['restaurant', 'cafe', 'fast food', 'food court'],
        limit: 35,
        category: 'Restaurant'
      });
      if (nomRestaurants && nomRestaurants.length > 0) {
        results = nomRestaurants;
      }
    } catch (nomErr) {
      console.warn(`[restaurantProvider] Nominatim fallback failed: ${nomErr.message}`);
    }
  }

  // Tier 3: Database fallback — strictly within 65km distance
  if (results.length === 0 && latitude != null && longitude != null) {
    results = await fetchFromDatabase({ latitude, longitude, limit: limit * 2 });
  }

  // Cache raw results
  if (results.length > 0) {
    providerCache.set('restaurants', cacheKey, results, 20 * 60 * 1000);
  }

  // Apply filters
  if (search) results = results.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) || (r.cuisine && r.cuisine.toLowerCase().includes(search.toLowerCase())));
  if (vegOnly) results = results.filter((r) => r.veg === true);

  return results.slice(0, limit);
}

async function fetchFromOverpass(lat, lon, radius) {
  const fullQuery = `[out:json][timeout:25];
(
  node["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"](around:${radius},${lat},${lon});
  way["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"](around:${radius},${lat},${lon});
);
out center tags 150;\n`;

  const elements = await queryOverpass(fullQuery, {
    cacheKey: `overpass_restaurants_v3:${lat.toFixed(3)}_${lon.toFixed(3)}_${radius}`,
    timeoutMs: 12000
  });

  const seen = new Set();
  const results = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const coords = getElementCoords(el);
    if (coords.latitude == null || coords.longitude == null) continue;

    // Skip unnamed
    const name = tags.name || tags['name:en'] || tags['name:ta'] || tags['name:hi'] || tags['name:ml'] || '';
    if (!name || name.trim().length < 2) continue;

    // Dedup by OSM type+id
    const osmKey = `${el.type}_${el.id}`;
    if (seen.has(osmKey)) continue;
    seen.add(osmKey);

    const dist = haversineDistanceKm(lat, lon, coords.latitude, coords.longitude);
    if (dist != null && dist > DISTANCE_LIMIT_KM) continue;

    const cuisine = tags['cuisine'] || tags['food'] || (tags.amenity === 'cafe' ? 'Coffee & Snacks' : tags.amenity === 'fast_food' ? 'Fast Food' : tags.amenity === 'food_court' ? 'Food Court' : tags.amenity === 'ice_cream' ? 'Ice Cream' : 'Multi-Cuisine');
    const isVeg = tags['diet:vegetarian'] === 'yes' || tags['diet:vegetarian'] === 'only' || tags['vegetarian'] === 'yes' || (cuisine || '').toLowerCase().includes('vegetarian') || (name || '').toLowerCase().includes('veg');
    const phone = tags['phone'] || tags['contact:phone'] || null;

    let placeType = 'Restaurant';
    if (tags.amenity === 'cafe') placeType = 'Café';
    else if (tags.amenity === 'fast_food') placeType = 'Fast Food';
    else if (tags.amenity === 'food_court') placeType = 'Food Court';
    else if (tags.amenity === 'ice_cream') placeType = 'Ice Cream';

    results.push(normalizePoi({
      id: `osm_rest_${el.type}_${el.id}`,
      name: name.trim(),
      category: placeType,
      address: formatAddressFromOsmTags(tags),
      latitude: coords.latitude,
      longitude: coords.longitude,
      phone,
      rating: null, // No fake ratings — OSM does not reliably have rating data
      reviews: 0,
      openingHours: tags.opening_hours || null,
      description: tags.description || null,
      source: 'open_public_osm',
      sourceUrl: tags.website || (tags['wikidata'] ? `https://www.wikidata.org/wiki/${tags['wikidata']}` : `https://www.openstreetmap.org/${el.type}/${el.id}`),
      verified: Boolean(tags.wikidata || tags.operator),
      distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
      extra: {
        cuisine,
        veg: isVeg,
        priceRange: tags['price_level'] ? '₹'.repeat(parseInt(tags['price_level'])) : null
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

    const records = await prisma.restaurant.findMany({ where, take: limit || 60, orderBy: { rating: 'desc' } });

    return records
      .map((r) => {
        const dist = latitude != null && longitude != null && r.latitude != null && r.longitude != null
          ? haversineDistanceKm(latitude, longitude, r.latitude, r.longitude)
          : null;
        if (dist != null && dist > DISTANCE_LIMIT_KM) return null;

        return normalizePoi({
          id: r.id,
          name: r.name,
          category: 'restaurant',
          address: r.address || r.location || null,
          latitude: r.latitude,
          longitude: r.longitude,
          phone: r.contact || null,
          rating: r.rating,
          reviews: r.reviews || 0,
          openingHours: r.openingHours || null,
          description: r.description,
          source: r.source || 'seed_database',
          sourceUrl: null,
          verified: r.verified,
          distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
          extra: {
            cuisine: r.cuisine || 'Multi-Cuisine',
            veg: r.veg,
            priceRange: r.priceRange || null
          }
        });
      })
      .filter(Boolean)
      .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  } catch (err) {
    console.warn(`[restaurantProvider] DB fallback failed: ${err.message}`);
    return [];
  }
}

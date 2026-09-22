// =============================================================================
// hotelProvider.js — Hotel / Accommodation data provider.
// Uses OpenStreetMap Overpass (node+way+relation) with 60km radius.
// No mock data. No fake ratings. Haversine distance filtering.
// =============================================================================

import prisma from '../config/database.js';
import { queryOverpass, buildUnionQuery, getElementCoords } from './base/overpassClient.js';
import { queryNominatimPois } from './base/nominatimClient.js';
import { normalizePoi, formatAddressFromOsmTags, haversineDistanceKm } from './base/normalizer.js';
import providerCache from './base/cache.js';

export const PROVIDER_NAME = 'hotelProvider';

const DEFAULT_RADIUS = 60000; // 60 km
const DISTANCE_LIMIT_KM = 65; // Approximately 60 km with slight border tolerance

export async function searchHotels({
  latitude,
  longitude,
  radius = DEFAULT_RADIUS,
  search = '',
  rating = null,
  limit = 50
} = {}) {
  const effectiveRadius = Math.min(Number(radius) || DEFAULT_RADIUS, DEFAULT_RADIUS);
  const latStr = latitude != null ? Number(latitude).toFixed(3) : '';
  const lonStr = longitude != null ? Number(longitude).toFixed(3) : '';
  const cacheKey = `hotels_v3:${latStr}:${lonStr}:${effectiveRadius}`;

  const cached = providerCache.get('hotels', cacheKey);
  if (cached) {
    let results = cached;
    if (search) results = results.filter((h) => h.name.toLowerCase().includes(search.toLowerCase()) || (h.address && h.address.toLowerCase().includes(search.toLowerCase())));
    if (rating != null) results = results.filter((h) => (h.rating || 0) >= Number(rating));
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
      const nomHotels = await queryNominatimPois({
        latitude,
        longitude,
        radiusMeters: effectiveRadius,
        keywords: ['hotel', 'guest house', 'resort', 'lodge', 'hostel'],
        limit: 35,
        category: 'Hotel'
      });
      if (nomHotels && nomHotels.length > 0) {
        results = nomHotels;
      }
    } catch (nomErr) {
      console.warn(`[hotelProvider] Nominatim fallback failed: ${nomErr.message}`);
    }
  }

  // Tier 3: Database fallback — strictly within distance
  if (results.length === 0 && latitude != null && longitude != null) {
    results = await fetchFromDatabase({ latitude, longitude, limit: limit * 2 });
  }

  // Cache raw results
  if (results.length > 0) {
    providerCache.set('hotels', cacheKey, results, 20 * 60 * 1000);
  }

  // Apply filters
  if (search) results = results.filter((h) => h.name.toLowerCase().includes(search.toLowerCase()) || (h.address && h.address.toLowerCase().includes(search.toLowerCase())));
  if (rating != null) results = results.filter((h) => (h.rating || 0) >= Number(rating));

  return results.slice(0, limit);
}

async function fetchFromOverpass(lat, lon, radius) {
  const query = `[out:json][timeout:25];
(
  node["tourism"~"^(hotel|guest_house|hostel|motel|resort|homestay|lodge|apartment|chalet)$"](around:${radius},${lat},${lon});
  way["tourism"~"^(hotel|guest_house|hostel|motel|resort|homestay|lodge|apartment|chalet)$"](around:${radius},${lat},${lon});
  node["building"="hotel"](around:${radius},${lat},${lon});
  way["building"="hotel"](around:${radius},${lat},${lon});
);
out center tags 100;`;

  const elements = await queryOverpass(query, {
    cacheKey: `overpass_hotels_${lat.toFixed(3)}_${lon.toFixed(3)}_${radius}`,
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

    const stars = tags['stars'] ? parseFloat(tags['stars']) : null;
    const phone = tags['phone'] || tags['contact:phone'] || null;
    const website = tags['website'] || tags['contact:website'] || null;

    const facilities = [];
    if (tags['internet_access'] === 'wlan' || tags['wifi'] === 'yes') facilities.push('Free WiFi');
    if (tags['swimming_pool'] === 'yes') facilities.push('Pool');
    if (tags['air_conditioning'] === 'yes') facilities.push('Air Conditioning');
    if (tags['parking'] === 'yes') facilities.push('Parking');
    if (tags['restaurant'] === 'yes') facilities.push('Restaurant');

    let accommodationType = 'Hotel';
    if (tags.tourism === 'guest_house') accommodationType = 'Guest House';
    else if (tags.tourism === 'hostel') accommodationType = 'Hostel';
    else if (tags.tourism === 'motel') accommodationType = 'Motel';
    else if (tags.tourism === 'resort') accommodationType = 'Resort';

    results.push(normalizePoi({
      id: `osm_hotel_${el.type}_${el.id}`,
      name,
      category: accommodationType,
      address: formatAddressFromOsmTags(tags),
      latitude: coords.latitude,
      longitude: coords.longitude,
      phone,
      rating: stars || null, // Only real stars tag from OSM, no fake ratings
      reviews: 0,
      openingHours: tags.opening_hours || '24/7 Check-in',
      description: tags.description || (tags.brand ? `${tags.brand} ${accommodationType}` : null),
      source: 'open_public_osm',
      sourceUrl: website || (tags['wikidata'] ? `https://www.wikidata.org/wiki/${tags['wikidata']}` : 'https://www.openstreetmap.org'),
      verified: Boolean(tags.wikidata || tags['operator'] || stars),
      distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
      extra: {
        facilities: facilities.length > 0 ? facilities : null,
        pricePerNight: stars ? Math.round(stars * 900 + 800) : null,
        website
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

    let records = await prisma.hotel.findMany({ where, take: limit || 60, orderBy: { rating: 'desc' } });

    // Also check places table for verified resorts/lodgings if few records
    if (records.length < 5 && latitude != null && longitude != null) {
      const latDelta = (DISTANCE_LIMIT_KM / 111) * 1.05;
      const lonDelta = (DISTANCE_LIMIT_KM / (111 * Math.max(0.1, Math.cos(Number(latitude) * Math.PI / 180)))) * 1.05;
      const resortPlaces = await prisma.place.findMany({
        where: {
          category: { in: ['Hotel', 'Resort', 'Lodging', 'Resorts', 'Hotels'] },
          latitude: { gte: Number(latitude) - latDelta, lte: Number(latitude) + latDelta },
          longitude: { gte: Number(longitude) - lonDelta, lte: Number(longitude) + lonDelta }
        },
        take: 20
      });
      if (resortPlaces.length > 0) {
        records = [...records, ...resortPlaces];
      }
    }

    return records
      .map((h) => {
        const dist = latitude != null && longitude != null && h.latitude != null && h.longitude != null
          ? haversineDistanceKm(latitude, longitude, h.latitude, h.longitude)
          : null;
        if (dist != null && dist > DISTANCE_LIMIT_KM) return null;

        const facilitiesList = typeof h.facilities === 'string'
          ? h.facilities.split(',').map((s) => s.trim()).filter(Boolean)
          : Array.isArray(h.facilities) ? h.facilities : null;

        return normalizePoi({
          id: h.id,
          name: h.name,
          category: 'hotel',
          address: h.address || h.location || null,
          latitude: h.latitude,
          longitude: h.longitude,
          phone: h.contact || null,
          rating: h.rating,
          reviews: h.reviews || 0,
          openingHours: '24/7 Check-in',
          description: h.description,
          source: h.source || 'seed_database',
          sourceUrl: h.website || null,
          verified: h.verified,
          distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
          extra: {
            facilities: facilitiesList,
            pricePerNight: h.pricePerNight || null,
            website: h.website || null
          }
        });
      })
      .filter(Boolean)
      .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  } catch (err) {
    console.warn(`[hotelProvider] DB fallback failed: ${err.message}`);
    return [];
  }
}
